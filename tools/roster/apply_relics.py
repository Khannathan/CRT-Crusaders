"""Re-syncs each Sister's relic text in src/data/roster.ts from her sister-bible card.

Usage (from the repo root):
    python3 -I tools/roster/apply_relics.py /mnt/project-files/sister-bible/roster-500

Reads "7 Relic (...): <text>" (locked references) or "Relic: <text>. Expression:"
from each card, drops a leading article, and rewrites only relics that changed.
"""
import glob
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ROSTER = ROOT / 'src' / 'data' / 'roster.ts'
rel = {}
for f in sorted(glob.glob(str(Path(sys.argv[1]) / '[A-Z][A-Z]-*.md'))):
    sid = None
    for line in open(f, encoding='utf-8'):
        h = re.match(r'^### ([A-Z]{2}-[A-Z0-9]+(?:-[A-Z0-9]+)?):', line)
        if h:
            sid = h.group(1)
            continue
        if not sid or sid in rel:
            continue
        m = re.match(r'^7 Relic \([^)]*\): (.+)$', line.strip()) or re.search(r' Relic: (.+?)\. Expression:', line)
        if m:
            rel[sid] = re.sub(r'^(a|an|the) ', '', m.group(1).strip())

changed = 0


def fix(m):
    global changed
    line, sid = m.group(0), m.group(1)
    r = re.search(r'relic: ("(?:[^"\\]|\\.)*")', line)
    if not r or sid not in rel or json.loads(r.group(1)) == rel[sid]:
        return line
    changed += 1
    return line.replace(r.group(0), 'relic: ' + json.dumps(rel[sid], ensure_ascii=False), 1)


text = re.sub(r'^  \{id: "([^"]+)".*$', fix, ROSTER.read_text(encoding='utf-8'), flags=re.M)
ROSTER.write_text(text, encoding='utf-8')
print(f'{changed} relics updated.')
