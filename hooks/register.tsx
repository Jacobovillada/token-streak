import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Stats } from '../types'

const PANE = 'token-streak'
const TITLE = 'Streak & tokens'
const WEEKS = 26
const stats = atom({ plugin: 'token-streak', key: 'stats' } as const, null, { shape: 'stats-1' })

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function tokens(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}b`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}m`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`
  return String(n)
}

function modelName(id: string | null): string {
  if (!id) return '—'
  const bits = id.replace(/^claude-/, '').replace(/-\d{8}$/, '').split('-')
  const name = bits.filter(b => !/^\d+$/.test(b))
  const ver = bits.filter(b => /^\d+$/.test(b)).join('.')
  return `${name.map(b => b.charAt(0).toUpperCase() + b.slice(1)).join(' ')} ${ver}`.trim()
}

function hour(h: number | null): string {
  if (h === null) return '—'
  const f = (x: number) => `${x % 12 === 0 ? 12 : x % 12} ${x % 24 < 12 ? 'AM' : 'PM'}`
  return `${f(h)}-${f(h + 1)}`
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const WEEK = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const BLOCKS = [' ', '▁', '▂', '▃', '▄', '▅', '▆', '▇', '█']

function parse(day: string): Date {
  const [y = 1970, mo = 1, da = 1] = day.split('-').map(Number)
  return new Date(y, mo - 1, da)
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(d.getDate() + n)
  return x
}

function sumDays(s: Stats, today: Date, n: number): number {
  let total = 0
  for (let i = 0; i < n; i++) total += s.daily[iso(addDays(today, -i))] ?? 0
  return total
}

let isRunning = false

// Reads the logs through scripts/stats.py. Any failure (no python3, a bad run)
// leaves the last stats in place: the band and the panel just keep what they had.
async function refresh($: EngineInterface) {
  if (isRunning) return
  isRunning = true
  try {
    const run = await $.process.run(['python3', '-I', `${$.plugin.root}/scripts/stats.py`], { timeoutMs: 600000 })
    if (run.exitCode !== 0) return
    const next = JSON.parse(run.stdout) as Stats
    await update($, stats, () => next)
  } catch {
    // keep the last stats
  } finally {
    isRunning = false
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'streak', description: 'Open the streak & tokens panel' })
    void $.ui.open({ id: PANE, title: TITLE })
    void refresh($)
    $.clock.every(5 * 60 * 1000, () => void refresh($))
    return next(e)
  })

  on('command.run', { command: 'streak' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })
    await refresh($)
    return { text: 'Streak panel opened.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const s = await read($, stats)
    if (!s || e.props.hasSurvey) return next(e)
    const { Button, Text } = $.ui.resolve(e)
    const week = sumDays(s, parse(s.today), 7)

    return (
      <Button key="open" plain onPress={() => void $.ui.open({ id: PANE, title: TITLE })}>
        🔥 <Text color="claude" weight="bold">{s.streak}</Text>{' '}
        <Text dimColor>day streak</Text>
        {'    '}
        <Text color="claude" weight="bold">{tokens(s.daily[s.today] ?? 0)}</Text> <Text dimColor>tokens today</Text>
        {'    '}
        <Text color="claude" weight="bold">{tokens(week)}</Text> <Text dimColor>last 7 days</Text>
      </Button>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const s = await read($, stats)
    if (!s) return <Text dimColor>Crunching your stats…</Text>

    const today = parse(s.today)
    const active = new Set(s.activeDays)
    const isOn = (d: Date) => active.has(iso(d)) || (s.daily[iso(d)] ?? 0) > 0

    // This week, Monday to Sunday.
    const monday0 = addDays(today, -((today.getDay() + 6) % 7))
    const weekDays = WEEK.map((label, i) => {
      const d = addDays(monday0, i)
      return { label, isDone: isOn(d), isToday: iso(d) === s.today, isFuture: d > today }
    })

    // Activity heatmap: columns are weeks, rows are Monday to Sunday.
    const monday = addDays(monday0, -(WEEKS - 1) * 7)
    const values = Object.values(s.daily).filter(v => v > 0).sort((x, y) => x - y)
    const q = (p: number) => values[Math.floor(p * (values.length - 1))] ?? 0
    const c1 = q(0.25)
    const c2 = q(0.5)
    const c3 = q(0.75)
    const cell = (d: Date) => {
      if (d > today) return { ch: ' ', on: false }
      const v = s.daily[iso(d)] ?? 0
      if (!v && !isOn(d)) return { ch: '·', on: false }
      return { ch: v <= c1 ? '░' : v <= c2 ? '▒' : v <= c3 ? '▓' : '█', on: true }
    }
    let header = ''
    let last = -1
    for (let w = 0; w < WEEKS; w++) {
      const d = addDays(monday, w * 7)
      if (d.getMonth() !== last && header.length <= w) header = header.padEnd(w) + (MONTHS[d.getMonth()] ?? '')
      last = d.getMonth()
    }

    // Tokens per day, last 14 days.
    const lastDays = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13))
    const series = lastDays.map(d => s.daily[iso(d)] ?? 0)
    const top = Math.max(1, ...series)
    const ROWS = 5
    const bar = (v: number, r: number) => {
      const h = (v / top) * ROWS - (ROWS - 1 - r)
      return h >= 1 ? '█' : h > 0 ? (BLOCKS[Math.floor(h * 8)] ?? '▁') : ' '
    }

    const stat = (value: string, label: string) => (
      <Box flexDirection="column" width={16}>
        <Text size="heading" weight="bold" color="claude">{value}</Text>
        <Text size="caption" dimColor>{label}</Text>
      </Box>
    )

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="row" gap={3}>
          <Box flexDirection="column">
            <Text size="title" weight="bold">
              🔥 <Text color="claude">{s.streak}</Text>
            </Text>
            <Text dimColor>day streak</Text>
          </Box>
          <Box flexDirection="row" gap={1}>
            {weekDays.map(d => (
              <Box flexDirection="column" alignItems="center">
                {d.isDone ? (
                  <Text color="claude" weight="bold">●</Text>
                ) : (
                  <Text dimColor>{d.isFuture ? '·' : '○'}</Text>
                )}
                <Text size="caption" dimColor={!d.isToday} weight={d.isToday ? 'bold' : 'regular'}>{d.label}</Text>
              </Box>
            ))}
          </Box>
        </Box>

        <Box flexDirection="row">
          {stat(tokens(s.daily[s.today] ?? 0), 'tokens today')}
          {stat(tokens(sumDays(s, today, 7)), 'last 7 days')}
          {stat(tokens(s.totalTokens), 'total')}
        </Box>

        <Box flexDirection="column">
          <Text size="caption" dimColor>Tokens per day, last 14 days</Text>
          {Array.from({ length: ROWS }, (_, r) => (
            <Text mono color="claude">{series.map(v => bar(v, r) + ' ').join('')}</Text>
          ))}
          <Text mono dimColor>{lastDays.map(d => String(d.getDate()).padStart(2, '0').slice(-1) + ' ').join('')}</Text>
        </Box>

        <Box flexDirection="column">
          <Text mono dimColor>{'  ' + header}</Text>
          {WEEK.map((label, r) => (
            <Box flexDirection="row">
              <Text mono dimColor>{label + ' '}</Text>
              {Array.from({ length: WEEKS }, (_, w) => {
                const c = cell(addDays(monday, w * 7 + r))
                return c.on ? <Text mono color="claude">{c.ch}</Text> : <Text mono dimColor>{c.ch}</Text>
              })}
            </Box>
          ))}
        </Box>

        <Box flexDirection="column">
          <Text>Longest streak: <Text color="claude">{s.longestStreak} days</Text></Text>
          <Text>Active days: <Text color="claude">{s.activeCount}/{s.spanDays}</Text></Text>
          <Text>Sessions: <Text color="claude">{s.sessions}</Text></Text>
          <Text>Favorite model: <Text color="claude">{modelName(s.favoriteModel)}</Text></Text>
          <Text>Peak hour: <Text color="claude">{hour(s.peakHour)}</Text></Text>
        </Box>
      </Box>
    )
  })
}
