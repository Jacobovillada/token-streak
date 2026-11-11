# Claude Streak 🔥

**Let's bring back the good old days, and the motivation those stats used to give us. 😭**

Remember opening Claude and seeing your streak and your token count staring back at you? Then one day they were gone. This mod brings them back.

## What you get

**A band above the prompt**, always visible:

```
🔥 3 day streak    774.9m tokens today    3.3b last 7 days
```

Click it to open **the panel**, docked beside the chat:

- Your current streak, big, with this week's days marked (`● ● ● ○ · · ·`)
- Tokens today, last 7 days and all time
- A bar chart of tokens per day for the last 14 days
- A 26-week activity heatmap (`·░▒▓█`)
- Longest streak, active days, sessions, favorite model and peak hour

You can also open it with `/streak`. It refreshes every 5 minutes.

## Install

At the prompt of a terminal session:

```
/plugin install token-streak --marketplace Jacobovillada/token-streak
```

From a shell:

```bash
claude plugin install token-streak --marketplace Jacobovillada/token-streak
```

In the desktop app, where `/plugin` does not run: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `Jacobovillada/token-streak`, then **Add plugin**.

Pick the **user** scope so it shows up in every chat. Chats that were already open pick it up after a restart.

**Requires** `python3` on your `PATH` (it ships with macOS and most Linux distros).

## How the numbers are counted

Everything is read locally from Claude Code's own session logs in `~/.claude/projects/`. Nothing is sent anywhere.

- **Tokens** are total usage, counted the way the old `/stats` did: input + output + cache reads + cache writes, for every assistant line, across all sessions and subagents. That is why the numbers are huge: most of it is the conversation context Claude re-reads on every step.
- **Streak** counts consecutive days (local time) with at least one message. If you haven't used Claude yet today, yesterday still keeps it alive.
- **Sessions** and **peak hour** come from when each main session started.

The first run reads every log and can take a few seconds. After that, a cache in `~/.claude/state/token-streak-cache.json` only re-reads files that changed, so refreshes take a fraction of a second.

Claude Code deletes old logs after a while (30 days by default, see `cleanupPeriodDays`), so the history only goes back as far as your logs do.

## Files

- `hooks/register.tsx`: the band, the panel and the `/streak` command
- `scripts/stats.py`: reads the logs and prints the stats as JSON
- `types/index.d.ts`: the shape of the stats the panel draws

## License

MIT
