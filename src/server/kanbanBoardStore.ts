import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { toProjectName } from '../pathUtils.js'

export const KANBAN_STATUSES = ['backlog', 'in_progress', 'review', 'closed_followup', 'archived'] as const

export type KanbanStatus = typeof KANBAN_STATUSES[number]

export type KanbanThreadSnapshot = {
  title: string
  cwd: string
  projectName: string
}

export type KanbanBoardItem = {
  threadId: string
  status: KanbanStatus
  lanePosition: number
  createdAt: string
  updatedAt: string
  lastMovedAt: string
  archivedAt: string | null
  snapshot: KanbanThreadSnapshot
}

export type KanbanBoardState = {
  version: 1
  updatedAt: string
  itemsByThreadId: Record<string, KanbanBoardItem>
}

export type KanbanLiveThread = {
  threadId: string
  title: string
  cwd: string
  projectName?: string
  updatedAtMs: number
  createdAtMs: number
}

export type KanbanThreadUpdate = {
  threadId: string
  status?: KanbanStatus
  lanePosition?: number
  snapshot?: Partial<KanbanThreadSnapshot>
}

type KanbanBoardStoreOptions = {
  codexHomeDir: string
}

const EMPTY_BOARD_STATE: KanbanBoardState = {
  version: 1,
  updatedAt: '',
  itemsByThreadId: {},
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function normalizeIsoString(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : fallback
}

function normalizeSnapshot(value: unknown): KanbanThreadSnapshot {
  const record = asRecord(value)
  const title = typeof record?.title === 'string' ? record.title.trim() : ''
  const cwd = typeof record?.cwd === 'string' ? record.cwd.trim() : ''
  const projectNameRaw = typeof record?.projectName === 'string' ? record.projectName.trim() : ''
  return {
    title,
    cwd,
    projectName: projectNameRaw || toProjectName(cwd),
  }
}

function normalizeBoardItem(threadId: string, value: unknown): KanbanBoardItem | null {
  const record = asRecord(value)
  if (!record) return null

  const normalizedThreadId = typeof record.threadId === 'string' && record.threadId.trim().length > 0
    ? record.threadId.trim()
    : threadId.trim()
  if (!normalizedThreadId) return null

  const snapshot = normalizeSnapshot(record.snapshot)
  const createdAtFallback = new Date(0).toISOString()
  const updatedAtFallback = createdAtFallback

  return {
    threadId: normalizedThreadId,
    status: isKanbanStatus(record.status) ? record.status : 'backlog',
    lanePosition: typeof record.lanePosition === 'number' && Number.isFinite(record.lanePosition) ? record.lanePosition : 0,
    createdAt: normalizeIsoString(record.createdAt, createdAtFallback),
    updatedAt: normalizeIsoString(record.updatedAt, updatedAtFallback),
    lastMovedAt: normalizeIsoString(record.lastMovedAt, updatedAtFallback),
    archivedAt: typeof record.archivedAt === 'string' && record.archivedAt.trim().length > 0
      ? record.archivedAt.trim()
      : null,
    snapshot,
  }
}

function normalizeBoardState(value: unknown): KanbanBoardState {
  const record = asRecord(value)
  if (!record) return EMPTY_BOARD_STATE

  const itemsRaw = asRecord(record.itemsByThreadId)
  const itemsByThreadId: Record<string, KanbanBoardItem> = {}
  if (itemsRaw) {
    for (const [threadId, itemValue] of Object.entries(itemsRaw)) {
      const item = normalizeBoardItem(threadId, itemValue)
      if (!item) continue
      itemsByThreadId[item.threadId] = item
    }
  }

  return {
    version: 1,
    updatedAt: normalizeIsoString(record.updatedAt, ''),
    itemsByThreadId,
  }
}

function normalizeLiveSnapshot(thread: KanbanLiveThread): KanbanThreadSnapshot {
  const cwd = thread.cwd.trim()
  const projectName = thread.projectName?.trim() || toProjectName(cwd)
  return {
    title: thread.title.trim(),
    cwd,
    projectName,
  }
}

function cloneBoardState(state: KanbanBoardState): KanbanBoardState {
  return {
    version: 1,
    updatedAt: state.updatedAt,
    itemsByThreadId: Object.fromEntries(
      Object.entries(state.itemsByThreadId).map(([threadId, item]) => [
        threadId,
        {
          ...item,
          snapshot: { ...item.snapshot },
        },
      ]),
    ) as Record<string, KanbanBoardItem>,
  }
}

function buildThreadItem(thread: KanbanLiveThread, nowIso: string): KanbanBoardItem {
  const fallbackPosition = thread.updatedAtMs || thread.createdAtMs || Date.now()
  return {
    threadId: thread.threadId,
    status: 'backlog',
    lanePosition: fallbackPosition,
    createdAt: nowIso,
    updatedAt: nowIso,
    lastMovedAt: nowIso,
    archivedAt: null,
    snapshot: normalizeLiveSnapshot(thread),
  }
}

function snapshotsEqual(first: KanbanThreadSnapshot, second: KanbanThreadSnapshot): boolean {
  return (
    first.title === second.title &&
    first.cwd === second.cwd &&
    first.projectName === second.projectName
  )
}

function reconcileBoardState(state: KanbanBoardState, liveThreads: KanbanLiveThread[]): { state: KanbanBoardState; changed: boolean } {
  const nextState = cloneBoardState(state)
  let changed = false
  const nowIso = new Date().toISOString()

  for (const liveThread of liveThreads) {
    const existing = nextState.itemsByThreadId[liveThread.threadId]
    if (!existing) {
      nextState.itemsByThreadId[liveThread.threadId] = buildThreadItem(liveThread, nowIso)
      changed = true
      continue
    }

    const nextSnapshot = normalizeLiveSnapshot(liveThread)
    if (!snapshotsEqual(existing.snapshot, nextSnapshot)) {
      nextState.itemsByThreadId[liveThread.threadId] = {
        ...existing,
        snapshot: nextSnapshot,
        updatedAt: nowIso,
      }
      changed = true
    }
  }

  if (changed) {
    nextState.updatedAt = nowIso
  }

  return { state: nextState, changed }
}

function mergePartialSnapshot(
  current: KanbanThreadSnapshot,
  partial: Partial<KanbanThreadSnapshot> | undefined,
): KanbanThreadSnapshot {
  if (!partial) return current
  const title = typeof partial.title === 'string' ? partial.title.trim() : current.title
  const cwd = typeof partial.cwd === 'string' ? partial.cwd.trim() : current.cwd
  const rawProjectName = typeof partial.projectName === 'string' ? partial.projectName.trim() : current.projectName
  return {
    title,
    cwd,
    projectName: rawProjectName || toProjectName(cwd),
  }
}

function updateBoardItem(state: KanbanBoardState, update: KanbanThreadUpdate): { state: KanbanBoardState; item: KanbanBoardItem; changed: boolean } {
  const normalizedThreadId = update.threadId.trim()
  if (!normalizedThreadId) {
    throw new Error('Missing threadId')
  }

  const nextState = cloneBoardState(state)
  const nowIso = new Date().toISOString()
  const existing = nextState.itemsByThreadId[normalizedThreadId]
  const snapshot = mergePartialSnapshot(
    existing?.snapshot ?? { title: '', cwd: '', projectName: '' },
    update.snapshot,
  )

  const nextStatus = update.status ?? existing?.status ?? 'backlog'
  const nextLanePosition =
    typeof update.lanePosition === 'number' && Number.isFinite(update.lanePosition)
      ? update.lanePosition
      : update.status && update.status !== existing?.status
        ? Date.now()
        : existing?.lanePosition ?? Date.now()

  const nextItem: KanbanBoardItem = {
    threadId: normalizedThreadId,
    status: nextStatus,
    lanePosition: nextLanePosition,
    createdAt: existing?.createdAt ?? nowIso,
    updatedAt: nowIso,
    lastMovedAt: update.status && update.status !== existing?.status ? nowIso : (existing?.lastMovedAt ?? nowIso),
    archivedAt: nextStatus === 'archived' ? nowIso : null,
    snapshot,
  }

  const changed =
    !existing ||
    existing.status !== nextItem.status ||
    existing.lanePosition !== nextItem.lanePosition ||
    existing.archivedAt !== nextItem.archivedAt ||
    existing.lastMovedAt !== nextItem.lastMovedAt ||
    !snapshotsEqual(existing.snapshot, nextItem.snapshot)

  if (!changed) {
    return {
      state,
      item: existing,
      changed: false,
    }
  }

  nextState.itemsByThreadId[normalizedThreadId] = nextItem
  nextState.updatedAt = nowIso
  return {
    state: nextState,
    item: nextItem,
    changed: true,
  }
}

async function readBoardState(statePath: string): Promise<KanbanBoardState> {
  try {
    const raw = await readFile(statePath, 'utf8')
    return normalizeBoardState(JSON.parse(raw) as unknown)
  } catch {
    return EMPTY_BOARD_STATE
  }
}

async function writeBoardState(statePath: string, state: KanbanBoardState): Promise<void> {
  await mkdir(dirname(statePath), { recursive: true })
  const tempPath = `${statePath}.${process.pid}.${Date.now()}.tmp`
  await writeFile(tempPath, JSON.stringify(state), 'utf8')
  await rename(tempPath, statePath)
}

export function isKanbanStatus(value: unknown): value is KanbanStatus {
  return typeof value === 'string' && (KANBAN_STATUSES as readonly string[]).includes(value)
}

export function createKanbanBoardStore(options: KanbanBoardStoreOptions) {
  const statePath = join(options.codexHomeDir, 'codexapp', 'kanban-state.json')
  let mutationQueue: Promise<void> = Promise.resolve()

  async function withLock<T>(task: () => Promise<T>): Promise<T> {
    const resultPromise = mutationQueue.then(task, task)
    mutationQueue = resultPromise.then(() => undefined, () => undefined)
    return resultPromise
  }

  return {
    getStatePath(): string {
      return statePath
    },
    async getBoard(liveThreads: KanbanLiveThread[]): Promise<KanbanBoardState> {
      return withLock(async () => {
        const current = await readBoardState(statePath)
        const { state, changed } = reconcileBoardState(current, liveThreads)
        if (changed) {
          await writeBoardState(statePath, state)
        }
        return state
      })
    },
    async updateThread(update: KanbanThreadUpdate): Promise<KanbanBoardItem> {
      return withLock(async () => {
        const current = await readBoardState(statePath)
        const { state, item, changed } = updateBoardItem(current, update)
        if (changed) {
          await writeBoardState(statePath, state)
        }
        return item
      })
    },
  }
}
