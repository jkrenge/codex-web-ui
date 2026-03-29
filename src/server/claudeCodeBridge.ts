import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type NotificationListener = (value: { method: string; params: unknown; atIso: string }) => void

type ClaudeBridgeMiddleware = ((req: IncomingMessage, res: ServerResponse, next: () => void) => Promise<void>) & {
  dispose: () => void
  subscribeNotifications: (listener: NotificationListener) => () => void
}

type ActiveQuery = {
  interrupt: () => Promise<void>
  close: () => void
}

type SessionsCache = {
  sessions: unknown[]
  expiresAt: number
}

// ---------------------------------------------------------------------------
// SDK lazy-load
// ---------------------------------------------------------------------------

type AgentSdk = typeof import('@anthropic-ai/claude-agent-sdk')

let sdkCache: AgentSdk | null = null
let sdkLoadError: Error | null = null

async function loadSdk(): Promise<AgentSdk | null> {
  if (sdkCache) return sdkCache
  if (sdkLoadError) return null
  try {
    sdkCache = await import('@anthropic-ai/claude-agent-sdk')
    return sdkCache
  } catch (err) {
    sdkLoadError = err instanceof Error ? err : new Error(String(err))
    return null
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw.trim()) {
        resolve(null)
        return
      }
      try {
        resolve(JSON.parse(raw))
      } catch {
        resolve(null)
      }
    })
    req.on('error', reject)
  })
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

// ---------------------------------------------------------------------------
// Config paths
// ---------------------------------------------------------------------------

function getConfigDir(): string {
  return join(homedir(), '.codex-web-ui')
}

function getScanDirsPath(): string {
  return join(getConfigDir(), 'claude-scan-dirs.json')
}

function getClaudeProjectsDir(): string {
  return join(homedir(), '.claude', 'projects')
}

// ---------------------------------------------------------------------------
// Decode Claude project directory names back to absolute paths.
// Claude encodes paths by replacing '/' with '-'.
// E.g. "-Users-julian-myproject" => "/Users/julian/myproject"
// ---------------------------------------------------------------------------

function decodeClaudeProjectDirName(dirName: string): string {
  return dirName.replace(/-/g, '/')
}

// ---------------------------------------------------------------------------
// Scan directories config
// ---------------------------------------------------------------------------

async function readScanDirs(): Promise<string[]> {
  try {
    const content = await readFile(getScanDirsPath(), 'utf8')
    const parsed = JSON.parse(content) as unknown
    const record = asRecord(parsed)
    if (record && Array.isArray(record.directories)) {
      return record.directories.filter((d): d is string => typeof d === 'string')
    }
    return []
  } catch {
    return []
  }
}

async function writeScanDirs(directories: string[]): Promise<void> {
  await mkdir(getConfigDir(), { recursive: true })
  await writeFile(getScanDirsPath(), JSON.stringify({ directories }, null, 2), 'utf8')
}

// ---------------------------------------------------------------------------
// Session discovery
// ---------------------------------------------------------------------------

function getClaudeSessionsDir(): string {
  return join(homedir(), '.claude', 'sessions')
}

async function getActiveSessionIds(): Promise<Set<string>> {
  const sessionsDir = getClaudeSessionsDir()
  const activeIds = new Set<string>()
  try {
    const entries = await readdir(sessionsDir)
    const jsonFiles = entries.filter((e) => e.endsWith('.json'))
    const results = await Promise.allSettled(
      jsonFiles.map(async (file) => {
        const content = await readFile(join(sessionsDir, file), 'utf8')
        const parsed = JSON.parse(content) as unknown
        const record = asRecord(parsed)
        if (record && typeof record.sessionId === 'string') {
          return record.sessionId
        }
        return null
      }),
    )
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        activeIds.add(result.value)
      }
    }
  } catch {
    // ~/.claude/sessions may not exist
  }
  return activeIds
}

async function discoverProjectDirs(): Promise<string[]> {
  const projectsDir = getClaudeProjectsDir()
  try {
    const entries = await readdir(projectsDir, { withFileTypes: true })
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => decodeClaudeProjectDirName(e.name))
      .filter((p) => p.startsWith('/'))
  } catch {
    return []
  }
}

async function listAllSessions(
  sdk: AgentSdk,
  cache: SessionsCache | null,
): Promise<{ sessions: unknown[]; cache: SessionsCache }> {
  const now = Date.now()
  if (cache && cache.expiresAt > now) {
    return { sessions: cache.sessions, cache }
  }

  const [projectDirs, scanDirs] = await Promise.all([discoverProjectDirs(), readScanDirs()])

  const allDirs = [...new Set([...projectDirs, ...scanDirs])]

  const results = await Promise.allSettled(allDirs.map((dir) => sdk.listSessions({ dir })))

  const sessionMap = new Map<string, unknown>()

  // Also list sessions globally (no dir filter) to pick up any not covered by dirs
  try {
    const globalSessions = await sdk.listSessions()
    for (const s of globalSessions) {
      const info = asRecord(s)
      if (info && typeof info.sessionId === 'string') {
        sessionMap.set(info.sessionId, s)
      }
    }
  } catch {
    // ignore
  }

  for (const result of results) {
    if (result.status !== 'fulfilled') continue
    for (const s of result.value) {
      const info = asRecord(s)
      if (info && typeof info.sessionId === 'string') {
        sessionMap.set(info.sessionId, s)
      }
    }
  }

  const sessions = Array.from(sessionMap.values())
  const newCache: SessionsCache = { sessions, expiresAt: now + 30_000 }
  return { sessions, cache: newCache }
}

// ---------------------------------------------------------------------------
// Streaming helper
// ---------------------------------------------------------------------------

function streamQueryToNotifications(
  sessionId: string,
  queryInstance: import('@anthropic-ai/claude-agent-sdk').Query,
  activeQueries: Map<string, ActiveQuery>,
  listeners: Set<NotificationListener>,
): void {
  const notify = (method: string, params: unknown) => {
    const notification = { method, params, atIso: new Date().toISOString() }
    for (const listener of listeners) {
      try {
        listener(notification)
      } catch {
        // ignore listener errors
      }
    }
  }

  void (async () => {
    try {
      for await (const message of queryInstance) {
        const msg = asRecord(message)
        const msgType = typeof msg?.type === 'string' ? msg.type : 'unknown'

        if (msgType === 'assistant') {
          notify('claude/session/message', { sessionId, message })
        } else if (msgType === 'result') {
          notify('claude/session/completed', { sessionId, message })
        } else {
          notify(`claude/session/${msgType}`, { sessionId, message })
        }
      }
    } catch (err) {
      notify('claude/session/error', {
        sessionId,
        error: err instanceof Error ? err.message : String(err),
      })
    } finally {
      activeQueries.delete(sessionId)
      queryInstance.close()
    }
  })()
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createClaudeBridgeMiddleware(): ClaudeBridgeMiddleware {
  const listeners = new Set<NotificationListener>()
  const activeQueries = new Map<string, ActiveQuery>()
  let sessionsCache: SessionsCache | null = null

  function invalidateCache(): void {
    sessionsCache = null
  }

  const middleware = async (req: IncomingMessage, res: ServerResponse, next: () => void): Promise<void> => {
    try {
      if (!req.url) {
        next()
        return
      }

      const url = new URL(req.url, 'http://localhost')
      const { pathname } = url
      const method = req.method ?? 'GET'

      // Only handle /claude-api/* routes
      if (!pathname.startsWith('/claude-api/')) {
        next()
        return
      }

      // -----------------------------------------------------------------------
      // GET /claude-api/config/directories
      // -----------------------------------------------------------------------
      if (method === 'GET' && pathname === '/claude-api/config/directories') {
        const directories = await readScanDirs()
        setJson(res, 200, { directories })
        return
      }

      // -----------------------------------------------------------------------
      // PUT /claude-api/config/directories
      // -----------------------------------------------------------------------
      if (method === 'PUT' && pathname === '/claude-api/config/directories') {
        const body = asRecord(await readJsonBody(req))
        if (!body || !Array.isArray(body.directories)) {
          setJson(res, 400, { error: 'Expected { directories: string[] }' })
          return
        }
        const directories = (body.directories as unknown[]).filter((d): d is string => typeof d === 'string')
        await writeScanDirs(directories)
        invalidateCache()
        setJson(res, 200, { directories })
        return
      }

      // -----------------------------------------------------------------------
      // GET /claude-api/sessions
      // -----------------------------------------------------------------------
      if (method === 'GET' && pathname === '/claude-api/sessions') {
        const sdk = await loadSdk()
        if (!sdk) {
          setJson(res, 503, { error: 'Claude Agent SDK not available' })
          return
        }
        const [{ sessions, cache }, activeIds] = await Promise.all([
          listAllSessions(sdk, sessionsCache),
          getActiveSessionIds(),
        ])
        sessionsCache = cache
        const enriched = sessions.map((s) => {
          const info = asRecord(s)
          const sessionId = info && typeof info.sessionId === 'string' ? info.sessionId : ''
          return { ...info, isActive: activeIds.has(sessionId) }
        })
        setJson(res, 200, { sessions: enriched })
        return
      }

      // -----------------------------------------------------------------------
      // POST /claude-api/sessions/create  — MUST come before /:id routes
      // -----------------------------------------------------------------------
      if (method === 'POST' && pathname === '/claude-api/sessions/create') {
        const sdk = await loadSdk()
        if (!sdk) {
          setJson(res, 503, { error: 'Claude Agent SDK not available' })
          return
        }

        const body = asRecord(await readJsonBody(req))
        if (!body || typeof body.prompt !== 'string' || !body.prompt.trim()) {
          setJson(res, 400, { error: 'Expected { prompt: string, cwd?: string }' })
          return
        }

        const prompt = body.prompt as string
        const cwd = typeof body.cwd === 'string' ? body.cwd : undefined

        // Pre-assign a session ID so we can return it immediately
        const sessionId = randomUUID()

        const queryInstance = sdk.query({
          prompt,
          options: {
            cwd,
            sessionId,
            permissionMode: 'bypassPermissions',
            allowDangerouslySkipPermissions: true,
            includePartialMessages: true,
          },
        })

        // Register active query
        activeQueries.set(sessionId, {
          interrupt: () => queryInstance.interrupt(),
          close: () => queryInstance.close(),
        })

        invalidateCache()

        // Start streaming in background
        streamQueryToNotifications(sessionId, queryInstance, activeQueries, listeners)

        setJson(res, 200, { sessionId })
        return
      }

      // -----------------------------------------------------------------------
      // Routes with /:id — extract session ID
      // -----------------------------------------------------------------------
      const sessionRouteMatch = pathname.match(/^\/claude-api\/sessions\/([^/]+)\/(.+)$/)
      if (sessionRouteMatch) {
        const sessionId = decodeURIComponent(sessionRouteMatch[1] ?? '')
        const action = sessionRouteMatch[2] ?? ''

        // ---------------------------------------------------------------------
        // GET /claude-api/sessions/:id/messages
        // ---------------------------------------------------------------------
        if (method === 'GET' && action === 'messages') {
          const sdk = await loadSdk()
          if (!sdk) {
            setJson(res, 503, { error: 'Claude Agent SDK not available' })
            return
          }
          const messages = await sdk.getSessionMessages(sessionId)
          setJson(res, 200, { messages })
          return
        }

        // ---------------------------------------------------------------------
        // POST /claude-api/sessions/:id/send
        // ---------------------------------------------------------------------
        if (method === 'POST' && action === 'send') {
          const sdk = await loadSdk()
          if (!sdk) {
            setJson(res, 503, { error: 'Claude Agent SDK not available' })
            return
          }

          const body = asRecord(await readJsonBody(req))
          if (!body || typeof body.prompt !== 'string' || !body.prompt.trim()) {
            setJson(res, 400, { error: 'Expected { prompt: string }' })
            return
          }

          const prompt = body.prompt as string

          // Interrupt any existing active query for this session
          const existing = activeQueries.get(sessionId)
          if (existing) {
            try {
              await existing.interrupt()
            } catch {
              // ignore
            }
            try {
              existing.close()
            } catch {
              // ignore
            }
            activeQueries.delete(sessionId)
          }

          const queryInstance = sdk.query({
            prompt,
            options: {
              resume: sessionId,
              permissionMode: 'bypassPermissions',
              allowDangerouslySkipPermissions: true,
              includePartialMessages: true,
            },
          })

          // Register active query
          activeQueries.set(sessionId, {
            interrupt: () => queryInstance.interrupt(),
            close: () => queryInstance.close(),
          })

          // Start streaming in background
          streamQueryToNotifications(sessionId, queryInstance, activeQueries, listeners)

          setJson(res, 200, { sessionId })
          return
        }

        // ---------------------------------------------------------------------
        // POST /claude-api/sessions/:id/rename
        // ---------------------------------------------------------------------
        if (method === 'POST' && action === 'rename') {
          const sdk = await loadSdk()
          if (!sdk) {
            setJson(res, 503, { error: 'Claude Agent SDK not available' })
            return
          }

          const body = asRecord(await readJsonBody(req))
          if (!body || typeof body.title !== 'string') {
            setJson(res, 400, { error: 'Expected { title: string }' })
            return
          }

          await sdk.renameSession(sessionId, body.title as string)
          invalidateCache()
          setJson(res, 200, { ok: true })
          return
        }

        // ---------------------------------------------------------------------
        // POST /claude-api/sessions/:id/interrupt
        // ---------------------------------------------------------------------
        if (method === 'POST' && action === 'interrupt') {
          const active = activeQueries.get(sessionId)
          if (!active) {
            setJson(res, 404, { error: 'No active query for this session' })
            return
          }

          try {
            await active.interrupt()
          } catch {
            // ignore interrupt errors
          }
          try {
            active.close()
          } catch {
            // ignore close errors
          }
          activeQueries.delete(sessionId)
          setJson(res, 200, { ok: true })
          return
        }
      }

      // No route matched
      next()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown bridge error'
      setJson(res, 502, { error: message })
    }
  }

  middleware.dispose = () => {
    for (const [, active] of activeQueries) {
      try {
        active.close()
      } catch {
        // ignore
      }
    }
    activeQueries.clear()
    listeners.clear()
  }

  middleware.subscribeNotifications = (listener: NotificationListener): (() => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  return middleware as ClaudeBridgeMiddleware
}
