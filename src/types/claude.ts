export type ClaudeSession = {
  id: string
  title: string
  cwd: string
  lastModified: number
  gitBranch: string | null
  tag: string | null
  firstPrompt: string | null
  isActive: boolean
}

export type ClaudeMessage = {
  id: string
  role: 'user' | 'assistant' | 'system'
  text: string
  toolUse?: {
    name: string
    input: string
    output?: string
    status?: 'inProgress' | 'completed' | 'failed'
  }
  createdAt: string | null
}

export type ClaudeScanConfig = {
  directories: string[]
}
