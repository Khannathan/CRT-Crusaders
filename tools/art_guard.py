#!/usr/bin/env python3
"""
Art lane guard for ChatGPT's pull requests (art-bible/specs/GITHUB_LANE.md).

A pull request is an ART PR when its branch starts with `art/` or its title
starts with `Art:`. An art PR may:
  - add or replace image files in the art folders below (never delete or rename them);
  - add, edit, rename or delete the design docs in art-bible/ (ChatGPT is the art
    lead and owns them), EXCEPT the Coding Lead's locked files (LOCKED below);
  - edit a Sister card's design text, but never its GAME DATA block, and never
    add, delete or rename a card (the 200 slots are game data).
It may never touch code, data, configs, tests, workflows or other docs.
Any other pull request passes untouched.

Usage (CI): python3 tools/art_guard.py <base sha> <head sha> <branch> <title>
"""
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from art_bible_data import block  # noqa: E402

MAX_BYTES = 12 * 1024 * 1024

# (pattern, may it be a brand new file?)
ALLOWED = [
    (r'src/assets/portraits/[^/]+\.png', True),
    (r'src/assets/splash/[^/]+\.png', True),
    (r'src/assets/splash/[^/]+\.webp', False),     # replace an existing .webp only
    (r'src/assets/ui/[^/]+\.png', True),
    (r'src/assets/enemies/[^/]+\.png', True),
    (r'src/assets/enemy-full/[^/]+\.png', True),
    (r'art-inbox/full-body/[^/]+_raw\.png', True),
    (r'art-inbox/props/[^/]+_props\.png', True),
    (r'art-inbox/review/[^/]+\.png', True),
    (r'art-inbox/ui-concepts/[^/]+\.png', True),       # UI redesign concepts (UI_BIBLE.md)
    (r'art-inbox/ART_LOG\.md', True),
]
# art-bible/: ChatGPT's design docs. Text and images only.
BIBLE = re.compile(r'art-bible/.+\.(md|txt|png|csv)')
# Inside art-bible/, only the Coding Lead (Claude) changes these.
LOCKED = [
    r'art-bible/specs/.*',                                  # the locks, asset/sprite/UI specs, the lane
    r'art-bible/CHATGPT_PROJECT_INSTRUCTIONS\.txt',        # ChatGPT's system prompt (Aaron + Claude)
    r'art-bible/roster/names-and-epithets\.csv',           # names the game reads
    r'art-bible/sprite-plan/sprite-template-1024x1536\.png',  # registration lines the rig expects
    r'art-bible/ui-screens/.*',                             # screenshots of the game as built
]
CARD = re.compile(r'art-bible/roster/cards/[A-Z]{2}/[A-Z]{2}-[A-Z0-9-]+\.md')

# The intake bot writes src/assets/full-body/<id>.png from art-inbox/full-body/<id>_raw.png.
INTAKE_OUT = re.compile(r'src/assets/full-body/([^/]+)\.png')

PNG = b'\x89PNG\r\n\x1a\n'


def git(*args, binary=False):
    out = subprocess.run(['git', *args], check=True, capture_output=True)
    return out.stdout if binary else out.stdout.decode()


def is_art_pr(branch, title):
    return branch.startswith('art/') or title.strip().lower().startswith('art:')


def check(base, head):
    problems = []
    rows = [r.split('\t') for r in git('diff', '--name-status', '-M', f'{base}...{head}').splitlines() if r]
    changed = {r[-1] for r in rows}
    raws = {re.sub(r'_raw\.png$', '', p.split('/')[-1]).upper()
            for p in changed if p.startswith('art-inbox/full-body/')}
    for row in rows:
        status, path = row[0][0], row[-1]
        paths = [row[1], path] if status in 'RC' else [path]
        if any(p.startswith('art-bible/') for p in paths):
            problems += check_bible(base, head, status, paths)
            continue
        if status == 'D':
            problems.append(f'{path}: deleted. Art PRs may not delete files.')
            continue
        if status in 'RC':
            problems.append(f'{row[1]} -> {path}: renamed or copied. Art PRs may not rename files.')
            continue
        m = INTAKE_OUT.fullmatch(path)
        if m and m.group(1).upper() in raws:
            rule = (None, True)
        else:
            rule = next(((p, new) for p, new in ALLOWED if re.fullmatch(p, path)), None)
        if rule is None:
            problems.append(f'{path}: outside the art lane (art-bible/specs/GITHUB_LANE.md lists the allowed paths).')
            continue
        if status == 'A' and not rule[1]:
            problems.append(f'{path}: new .webp file. Only replace an existing .webp; new art is .png.')
            continue
        if path.endswith('.md'):
            continue
        data = git('show', f'{head}:{path}', binary=True)
        if len(data) > MAX_BYTES:
            problems.append(f'{path}: {len(data) // 1024} KB, over the {MAX_BYTES // 1048576} MB limit.')
        if path.endswith('.png') and not data.startswith(PNG):
            problems.append(f'{path}: not a real PNG file.')
        if path.endswith('.webp') and not (data[:4] == b'RIFF' and data[8:12] == b'WEBP'):
            problems.append(f'{path}: not a real WebP file.')
    return rows, problems


def check_bible(base, head, status, paths):
    """A change inside art-bible/: ChatGPT's docs, minus the locked files and card data."""
    out = []
    for p in paths:
        if any(re.fullmatch(l, p) for l in LOCKED):
            return [f'{p}: locked by the Coding Lead (art-bible/specs/LOCKS.md). Ask in a for-claude issue instead.']
        if not BIBLE.fullmatch(p):
            return [f'{p}: art-bible/ takes only .md, .txt, .png and .csv files.']
    path = paths[-1]
    if any(CARD.fullmatch(p) for p in paths):
        if status != 'M':
            return [f'{path}: cards may be edited but never added, deleted or renamed (the 200 slots are game data).']
        old = block(git('show', f'{base}:{path}'))
        new = block(git('show', f'{head}:{path}'))
        if old is not None and old != new:
            out.append(f'{path}: the GAME DATA block changed. Keep it word for word; ask for game changes in a for-claude issue.')
        return out
    if status == 'D':
        return out
    data = git('show', f'{head}:{path}', binary=True)
    if len(data) > MAX_BYTES:
        out.append(f'{path}: {len(data) // 1024} KB, over the {MAX_BYTES // 1048576} MB limit.')
    if path.endswith('.png') and not data.startswith(PNG):
        out.append(f'{path}: not a real PNG file.')
    return out


def main(argv):
    if len(argv) != 4:
        print(__doc__)
        return 2
    base, head, branch, title = argv
    if not is_art_pr(branch, title):
        print(f'Not an art PR (branch {branch!r}); nothing to check.')
        return 0
    rows, problems = check(base, head)
    print(f'Art PR on {branch!r}: {len(rows)} file(s) changed.')
    for r in rows:
        print('  ' + ' '.join(r))
    if problems:
        print('\nART LANE CHECK FAILED. Fix these on this branch (put back what you may not change):')
        for p in problems:
            print('  - ' + p)
            print(f'::error::{p}')
        return 1
    print('\nAll files are inside the art lane.')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
