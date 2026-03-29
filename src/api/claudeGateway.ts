import type { ClaudeSession, ClaudeMessage } from '../types/claude'

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`)
  }
  return res.json() as Promise<T>
}

export function extractMessageText(message: { content?: unknown }): string {
  const content = message.content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .filter((block): block is { type: string; text: string } => block?.type === 'text' && typeof block?.text === 'string')
      .map((block) => block.text)
      .join('\n')
  }
  return ''
}

export function extractToolUse(message: { content?: unknown }): { name: string; input: unknown } | null {
  const content = message.content
  if (!Array.isArray(content)) return null
  const block = content.find((b): b is { type: string; name: string; input: unknown } => b?.type === 'tool_use')
  if (!block) return null
  return { name: block.name, input: block.input }
}

type SessionsResponse = {
  sessions: Array<{
    sessionId: string
    customTitle?: string | null
    summary?: string | null
    firstPrompt?: string | null
    cwd: string
    lastModified: number
    gitBranch?: string | null
    tag?: string | null
    isActive?: boolean
  }>
}

export async function getClaudeSessions(): Promise<ClaudeSession[]> {
  const data = await fetchJson<SessionsResponse>('/claude-api/sessions')
  const sessions = Array.isArray(data.sessions) ? data.sessions : []
  return sessions.map((s) => ({
    id: s.sessionId,
    title: s.customTitle ?? s.summary ?? s.firstPrompt ?? 'Untitled',
    cwd: s.cwd,
    lastModified: s.lastModified,
    gitBranch: s.gitBranch ?? null,
    tag: s.tag ?? null,
    firstPrompt: s.firstPrompt ?? null,
    isActive: s.isActive ?? false,
  }))
}

type RawMessage = {
  uuid?: string
  id?: string
  type?: string
  role?: string
  message?: {
    content?: unknown
    role?: string
  }
  content?: unknown
  timestamp?: string | null
}

type MessagesResponse = {
  messages?: RawMessage[]
}

function normalizeRawMessage(raw: RawMessage, index: number): ClaudeMessage {
  const id = raw.uuid ?? raw.id ?? `msg-${index}`
  const messageContent = raw.message?.content ?? raw.content
  const rawWithContent = { content: messageContent }
  const text = extractMessageText(rawWithContent)
  const toolUseBlock = extractToolUse(rawWithContent)

  // Determine role: raw.type === 'user' → 'user', else 'assistant'
  // Also check raw.role or raw.message.role as fallback
  let role: ClaudeMessage['role'] = 'assistant'
  const rawRole = raw.type ?? raw.role ?? raw.message?.role
  if (rawRole === 'user') role = 'user'
  else if (rawRole === 'system') role = 'system'

  const msg: ClaudeMessage = {
    id,
    role,
    text,
    createdAt: raw.timestamp ?? null,
  }

  if (toolUseBlock) {
    msg.toolUse = {
      name: toolUseBlock.name,
      input: typeof toolUseBlock.input === 'string' ? toolUseBlock.input : JSON.stringify(toolUseBlock.input),
    }
  }

  return msg
}

export async function getClaudeSessionMessages(sessionId: string): Promise<ClaudeMessage[]> {
  const data = await fetchJson<MessagesResponse>(`/claude-api/sessions/${sessionId}/messages`)
  const messages = Array.isArray(data.messages) ? data.messages : []
  return messages.map((raw, index) => normalizeRawMessage(raw, index))
}

export async function sendClaudePrompt(sessionId: string, prompt: string): Promise<void> {
  await fetchJson<unknown>(`/claude-api/sessions/${sessionId}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  })
}

type CreateSessionResponse = {
  sessionId: string
}

export async function createClaudeSession(cwd: string, prompt: string): Promise<string> {
  const data = await fetchJson<CreateSessionResponse>('/claude-api/sessions/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cwd, prompt }),
  })
  return data.sessionId
}

export async function interruptClaudeSession(sessionId: string): Promise<void> {
  await fetchJson<unknown>(`/claude-api/sessions/${sessionId}/interrupt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function renameClaudeSession(sessionId: string, title: string): Promise<void> {
  await fetchJson<unknown>(`/claude-api/sessions/${sessionId}/rename`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
}

type DirectoriesResponse = {
  directories: string[]
}

export async function getClaudeScanDirectories(): Promise<string[]> {
  const data = await fetchJson<DirectoriesResponse>('/claude-api/config/directories')
  return Array.isArray(data.directories) ? data.directories : []
}

export async function setClaudeScanDirectories(dirs: string[]): Promise<void> {
  await fetchJson<unknown>('/claude-api/config/directories', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ directories: dirs }),
  })
}
