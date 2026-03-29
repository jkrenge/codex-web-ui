import type { ClaudeSession, ClaudeMessage } from '../../types/claude'
import type { CommandExecutionData, UiMessage, UiProjectGroup, UiThread } from '../../types/codex'
import { normalizePathForUi, toProjectName } from '../../pathUtils.js'

export function claudeSessionToUiThread(session: ClaudeSession): UiThread {
  const cwd = normalizePathForUi(session.cwd)
  const projectName = toProjectName(cwd)
  const updatedAtMs = session.lastModified
  const updatedAtIso = new Date(updatedAtMs).toISOString()

  return {
    id: session.id,
    backend: 'claude' as const,
    title: session.title,
    projectName,
    cwd,
    hasWorktree: false,
    createdAtIso: updatedAtIso,
    updatedAtIso,
    preview: session.firstPrompt ?? '',
    unread: false,
    inProgress: false,
    kanbanBoard: 'primary',
    kanbanStatus: 'backlog',
    kanbanPosition: Math.max(0, updatedAtMs),
  }
}

export function mergeClaudeSessionsIntoGroups(
  existingGroups: UiProjectGroup[],
  sessions: ClaudeSession[],
): UiProjectGroup[] {
  const claudeThreads = sessions.map(claudeSessionToUiThread)

  // Build a map of projectName → threads from existing groups
  const groupMap = new Map<string, UiThread[]>()
  for (const group of existingGroups) {
    groupMap.set(group.projectName, [...group.threads])
  }

  // Merge claude threads into the map
  for (const thread of claudeThreads) {
    const existing = groupMap.get(thread.projectName)
    if (existing) {
      // Replace if already present (by id), otherwise append
      const idx = existing.findIndex((t) => t.id === thread.id)
      if (idx >= 0) {
        existing[idx] = thread
      } else {
        existing.push(thread)
      }
    } else {
      groupMap.set(thread.projectName, [thread])
    }
  }

  // Sort threads within each group by updatedAt desc
  for (const threads of groupMap.values()) {
    threads.sort((a, b) => new Date(b.updatedAtIso).getTime() - new Date(a.updatedAtIso).getTime())
  }

  // Build sorted groups
  return Array.from(groupMap.entries())
    .map(([projectName, threads]) => ({ projectName, threads }))
    .sort((a, b) => {
      const aLast = new Date(a.threads[0]?.updatedAtIso ?? 0).getTime()
      const bLast = new Date(b.threads[0]?.updatedAtIso ?? 0).getTime()
      return bLast - aLast
    })
}

function normalizeToolUseStatus(value: string | undefined): CommandExecutionData['status'] {
  if (value === 'completed' || value === 'failed' || value === 'declined' || value === 'interrupted') return value
  if (value === 'inProgress' || value === 'in_progress') return 'inProgress'
  return 'completed'
}

export function claudeMessageToUiMessage(msg: ClaudeMessage, index: number): UiMessage {
  const uiMsg: UiMessage = {
    id: msg.id || `claude-msg-${index}`,
    role: msg.role,
    text: msg.text,
    messageType: 'claudeMessage',
  }

  if (msg.toolUse) {
    const commandExecution: CommandExecutionData = {
      command: msg.toolUse.name,
      cwd: null,
      status: normalizeToolUseStatus(msg.toolUse.status),
      aggregatedOutput: msg.toolUse.output ?? '',
      exitCode: null,
    }
    uiMsg.commandExecution = commandExecution
    uiMsg.messageType = 'commandExecution'
  }

  return uiMsg
}

export function normalizeClaudeMessages(messages: ClaudeMessage[]): UiMessage[] {
  return messages.map((msg, index) => claudeMessageToUiMessage(msg, index))
}
