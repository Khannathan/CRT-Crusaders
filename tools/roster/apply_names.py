"""Renames Sisters across the game from an id -> old -> new map, in one pass.

Usage (from the repo root):
    python3 -I tools/roster/apply_names.py /mnt/project-files/sister-bible/rename-map-2026-11-24.csv [--dry]

Every old full name and old first name (each unique in the roster) is matched in a
single regex pass and swapped for the same Sister's new full or first name, so a
new name that equals another Sister's old one is never renamed twice. Runs over
src/**/*.ts. Single-word new names (URs) stand in for both forms.
"""
import csv
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
rows = list(csv.DictReader(open(sys.argv[1], encoding='utf-8')))
dry = '--dry' in sys.argv

swap = {}
for r in rows:
    old, new = r['old_name'].strip(), r['new_name'].strip()
    if old == new:
        continue
    of, nf = old.split()[0], new.split()[0]
    for a, b in ((old, new), (of, nf)):
        if a in swap and swap[a] != b:
            sys.exit(f'{a} is not unique in the map')
        swap[a] = b
# possessives and plain words alike; longest first so full names win
pat = re.compile(r"\b(" + '|'.join(sorted(map(re.escape, swap), key=len, reverse=True)) + r")\b")

# Old Chapter AI member names live here on purpose (they are not Sisters).
SKIP = {'src/systems/chapter.ts', 'src/data/crusaders.test.ts'}

hits = {}
for f in sorted((ROOT / 'src').rglob('*.ts')):
    if str(f.relative_to(ROOT)) in SKIP:
        continue
    text = f.read_text(encoding='utf-8')
    n = [0]

    def sub(m):
        n[0] += 1
        return swap[m.group(1)]

    out = pat.sub(sub, text)
    if n[0]:
        hits[str(f.relative_to(ROOT))] = n[0]
        if not dry:
            f.write_text(out, encoding='utf-8')
for k, v in hits.items():
    print(f'{v:5d}  {k}')
