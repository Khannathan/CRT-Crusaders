#!/usr/bin/env python3
"""
Art lane guard for ChatGPT's art pull requests (ASSETS_GUIDE section 5).

A pull request is an ART PR when its branch starts with `art/` or its title
starts with `Art:`. An art PR may only add or replace image files in the art
folders below. It may never delete or rename a file, and may never touch code,
data, configs, tests, workflows or docs. Any other pull request passes untouched.

Usage (CI): python3 tools/art_guard.py <base sha> <head sha> <branch> <title>
"""
import re
import subprocess
import sys

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
            problems.append(f'{path}: outside the art lane (ASSETS_GUIDE section 5 lists the allowed paths).')
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
        print('\nART LANE CHECK FAILED. Fix these by replacing only your own art files on this branch:')
        for p in problems:
            print('  - ' + p)
            print(f'::error::{p}')
        return 1
    print('\nAll files are inside the art lane.')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
