"""Streak and token stats for Claude Code, counted from ~/.claude/projects/**.jsonl.

- "Tokens" means total usage, the way Claude Code's old /stats counted it: for every
  assistant line in the logs, input + output + cache read + cache write, across all
  sessions and subagents.
- Days are in local time. An active day is any day with a message from you or Claude.
- A per-file cache (mtime + size) keeps later runs near-instant.
- Prints one JSON object on stdout; nothing leaves your machine.
"""
import json, os, glob
from datetime import datetime, date, timedelta

HOME = os.path.expanduser('~')
CACHE = os.path.join(HOME, '.claude', 'state', 'token-streak-cache.json')
VERSION = 4
KEYS = ('input_tokens', 'output_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens')

def scan(path):
    days, tok, start = set(), {}, None
    with open(path, 'r', encoding='utf-8', errors='replace') as f:
        for line in f:
            if '"timestamp"' not in line:
                continue
            try:
                d = json.loads(line)
                t = datetime.fromisoformat(d['timestamp'].replace('Z', '+00:00')).astimezone()
            except Exception:
                continue
            typ = d.get('type')
            if typ not in ('user', 'assistant'):
                continue
            start = start or t
            day = t.date().isoformat()
            days.add(day)
            if typ != 'assistant':
                continue
            m = d.get('message') or {}
            u = m.get('usage') or {}
            total = sum(int(u.get(k) or 0) for k in KEYS)
            if total:
                e = tok.setdefault(day, {})
                model = m.get('model') or '?'
                e[model] = e.get(model, 0) + total
    return {'days': sorted(days), 'tok': tok, 'start': start.isoformat() if start else None,
            'sub': os.sep + 'subagents' + os.sep in path}

def main():
    try:
        cache = json.load(open(CACHE))
        if cache.get('v') != VERSION:
            cache = {}
    except Exception:
        cache = {}
    old = cache.get('files', {})
    files = {}
    for p in glob.glob(os.path.join(HOME, '.claude', 'projects', '**', '*.jsonl'), recursive=True):
        try:
            st = os.stat(p)
        except OSError:
            continue
        key = f'{st.st_mtime_ns}:{st.st_size}'
        c = old.get(p)
        files[p] = c if c and c.get('k') == key else {'k': key, **scan(p)}
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    tmp = f'{CACHE}.{os.getpid()}.tmp'  # one per process: two chats may refresh at once
    with open(tmp, 'w') as f:
        json.dump({'v': VERSION, 'files': files}, f)
    os.replace(tmp, CACHE)

    act, daily, models, sessions, hours = set(), {}, {}, 0, {}
    for c in files.values():
        act.update(c['days'])
        for day, by in c['tok'].items():
            for model, n in by.items():
                daily[day] = daily.get(day, 0) + n
                models[model] = models.get(model, 0) + n
        if c['start'] and not c['sub']:
            sessions += 1
            h = datetime.fromisoformat(c['start']).hour
            hours[h] = hours.get(h, 0) + 1

    today = date.today()
    cur = 0
    d = today if today.isoformat() in act else today - timedelta(days=1)
    while d.isoformat() in act:
        cur += 1; d -= timedelta(days=1)
    best = run = 0; prev = None
    for x in sorted(act):
        dx = date.fromisoformat(x)
        run = run + 1 if prev and dx - prev == timedelta(days=1) else 1
        best = max(best, run); prev = dx
    first = min(act) if act else None
    total = sum(daily.values())
    print(json.dumps({
        'daily': daily, 'activeDays': sorted(act),
        'favoriteModel': max(models, key=models.get) if models else None,
        'totalTokens': total, 'outputTokens': total,
        'sessions': sessions,
        'streak': cur, 'longestStreak': best,
        'activeCount': len(act),
        'spanDays': (today - date.fromisoformat(first)).days + 1 if first else 0,
        'peakHour': max(hours, key=hours.get) if hours else None,
        'today': today.isoformat(),
    }))

if __name__ == '__main__':
    main()
