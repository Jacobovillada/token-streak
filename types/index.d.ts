export type Stats = {
  daily: Record<string, number>
  activeDays: string[]
  favoriteModel: string | null
  totalTokens: number
  outputTokens: number
  sessions: number
  streak: number
  longestStreak: number
  activeCount: number
  spanDays: number
  peakHour: number | null
  today: string
}

declare module 'claude-code' {
  interface PluginState {
    'token-streak': { stats: Shaped<Stats | null> }
  }
}
