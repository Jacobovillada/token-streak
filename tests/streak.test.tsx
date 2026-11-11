import { expect, test } from 'claude-code/testing'

const today = '2026-11-11'
const STATS = {
  daily: { '2026-11-09': 2_000_000_000, '2026-11-10': 1_000_000_000, '2026-11-11': 774_900_000 },
  activeDays: ['2026-11-09', '2026-11-10', '2026-11-11'],
  favoriteModel: 'claude-opus-5-5',
  totalTokens: 31_600_000_000,
  outputTokens: 31_600_000_000,
  sessions: 323,
  streak: 3,
  longestStreak: 40,
  activeCount: 107,
  spanDays: 182,
  peakHour: 8,
  today,
}

const PANE = {
  plugin: 'token-streak',
  component: 'Pane',
  requestId: 'token-streak',
  props: {
    title: 'Streak & tokens',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const BAND = { plugin: 'token-streak', component: 'AbovePrompt', props: {} } as const

function engine(on: any, stdout: string, exitCode = 0) {
  on('command.register', () => ({ value: { command: 'streak' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('process.run', () => ({ value: { exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('session.start', (_: unknown, e: any) => ({ cwd: e.cwd }))
}

test('the band shows the streak and tokens on every surface', async ($, on) => {
  engine(on, JSON.stringify(STATS))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'streak' })

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect((await ui.find({ type: 'Text', text: /^3$/ }))?.text).toBe('3')
    expect((await ui.find({ type: 'Text', text: /774\.9m/ }))?.text).toBe('774.9m')
    expect((await ui.find({ type: 'Text', text: /3\.8b/ }))?.text).toBe('3.8b')
    await ui.unmount()
  }
})

test('the panel draws the stats on every surface', async ($, on) => {
  engine(on, JSON.stringify(STATS))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'streak' })

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /31\.6b/ }))?.text).toBe('31.6b')
    expect((await ui.find({ type: 'Text', text: /Longest streak/ }))?.text).toBe('Longest streak: 40 days')
    expect((await ui.find({ type: 'Text', text: /Favorite model/ }))?.text).toBe('Favorite model: Opus 5.5')
    expect((await ui.find({ type: 'Text', text: /Peak hour/ }))?.text).toBe('Peak hour: 8 AM-9 AM')
    expect((await ui.find({ type: 'Text', text: /Active days/ }))?.text).toBe('Active days: 107/182')
    await ui.unmount()
  }
})

test('a failed run keeps the panel waiting instead of breaking', async ($, on) => {
  engine(on, 'not json', 1)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'streak' })

  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await pane.find({ type: 'Text', text: /Crunching/ }))?.text).toBe('Crunching your stats…')
  await pane.unmount()
})

test('bad output from the script is ignored', async ($, on) => {
  engine(on, 'not json', 0)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const r = await $.command.run({ command: 'streak' })
  expect(r.text).toBe('Streak panel opened.')
})
