#!/usr/bin/env python3
"""
Locked GAME DATA blocks in the Sister cards (art-bible/roster/cards/<code>/<id>.md).

ChatGPT owns every card's design text and may rewrite it freely. The block
between the two markers below is game data the code depends on (id, name,
epithet, rarity, Order, class, age, weapon and relic names, the kit). Only
Claude changes it, and the Art lane guard fails any art PR that edits it.

Usage:
    python3 tools/art_bible_data.py write     # (re)write every card's block from src/data + the card's KIT lines
    python3 tools/art_bible_data.py check     # every card has exactly one block (CI-friendly)

The guard imports block() from here.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CARDS = ROOT / 'art-bible' / 'roster' / 'cards'
START = '<!-- GAME DATA (locked by the Coding Lead: keep this block word for word; the Art lane guard checks it) -->'
END = '<!-- END GAME DATA -->'
BLOCK_RE = re.compile(re.escape(START) + r'.*?' + re.escape(END), re.S)

ORDER_ID = {
    'Iron Vigil': 'iron-vigil', 'Ashen Mercy': 'ashen-mercy', 'Veiled Tribunal': 'veiled-tribunal',
    'Sepulcher Watch': 'sepulcher-watch', 'Choir of the Pyre': 'candle-choir', 'Verdant Martyrdom': 'thorn-covenant',
    'Drowned Litany': 'drowned-litany', 'Confessors of Glass': 'glass-confession',
    'Crimson Inquisition': 'red-pilgrimage', 'Hallowed Belfry': 'hollow-bell',
}
RANK = {'R': 'Commander', 'SR': 'Legend', 'SSR': 'Demigoddess', 'UR': 'Deity'}
TIER = {'epic': 'Epic', 'legendary': 'Legendary', 'mythic': 'Mythic', 'divine': 'Divine Arsenal'}


def block(text):
    """The locked block of a card's text, or None."""
    m = BLOCK_RE.search(text)
    return m.group(0) if m else None


def _ts_field(line, key):
    m = re.search(key + r': (?:"((?:[^"\\]|\\.)*)"|(\w+))', line)
    return None if not m else (m.group(1) if m.group(1) is not None else m.group(2))


def game_data():
    roster = {}
    for line in (ROOT / 'src/data/roster.ts').read_text().splitlines():
        sid = _ts_field(line, 'id')
        if sid and line.strip().startswith('{id:'):
            roster[sid] = {k: _ts_field(line, k) for k in ('name', 'classId', 'title', 'rarity', 'order', 'age', 'relic', 'limited')}
    weapons = {}
    for m in re.finditer(r'"([A-Z]{2}-[A-Z0-9-]+)": \{ name: "((?:[^"\\]|\\.)*)", tier: "(\w+)"', (ROOT / 'src/data/weapons.ts').read_text()):
        weapons[m.group(1)] = (m.group(2), m.group(3))
    classes = {}
    for m in re.finditer(r"(\w+): \{ id: '(\w+)', name: '([^']+)', role: '([^']+)'", (ROOT / 'src/data/classes.ts').read_text()):
        classes[m.group(2)] = (m.group(3), m.group(4))
    return roster, weapons, classes


def kit_lines(body):
    """The card's KIT lines (game text), minus the visual 'HOW HER SKILLS LOOK' line."""
    lines = body.split('\n')
    try:
        i = next(n for n, l in enumerate(lines) if l.startswith('KIT'))
    except StopIteration:
        return []
    out = []
    for l in lines[i + 1:]:
        if not l.startswith('- '):
            break
        if l.startswith('- HOW HER SKILLS LOOK'):
            continue
        out.append(l)
    return out


def make_block(sid, r, weapons, classes, kit):
    cls_name, role = classes[r['classId']]
    rank = 'Patron Deity' if sid.endswith('-LUR') else RANK[r['rarity']]
    order = r['order']
    rows = [
        f'id: {sid}',
        f'name: {r["name"]}',
        f'epithet: {r["title"]}',
        f'rarity: {r["rarity"]}{" (Limited)" if r.get("limited") == "true" else ""}',
        f'rank: {rank}',
        f'order: {order} (order id {ORDER_ID[order]}, code {sid[:2]})',
        f'class: {cls_name} (class id {r["classId"]}, role {role})',
        f'age: {r["age"]}',
    ]
    if sid in weapons:
        name, tier = weapons[sid]
        rows.append(f'weapon: {name} ({TIER[tier]})')
    rows.append(f'relic: {r["relic"]} (a game item)')
    if kit:
        rows.append('kit:')
        rows += kit
    return START + '\n```text\n' + '\n'.join(rows) + '\n```\n' + END


def write():
    roster, weapons, classes = game_data()
    n = 0
    for f in sorted(CARDS.glob('*/*.md')):
        sid = f.stem
        text = f.read_text()
        old = block(text)
        if old:
            kit = [l for l in old.split('\n') if l.startswith('- ')]
            rest = text.replace(old + '\n\n', '').replace(old, '')
        else:
            kit = kit_lines(text)
            rest = text
            # The kit moves into the locked block; drop it from the design text.
            rest = re.sub(r'\nKIT \(her battle identity[^\n]*\n(?:- (?!HOW HER SKILLS LOOK)[^\n]*\n)*', '\nKIT: see the GAME DATA block at the top of this card.\n', rest)
        new = make_block(sid, roster[sid], weapons, classes, kit)
        # The block goes right after the card's first comment line.
        head, sep, tail = rest.partition('\n\n')
        if head.startswith('<!--'):
            out = head + '\n\n' + new + '\n\n' + tail
        else:
            out = new + '\n\n' + rest
        f.write_text(out)
        n += 1
    print(f'wrote GAME DATA blocks in {n} cards')


def check():
    bad = [str(f) for f in sorted(CARDS.glob('*/*.md')) if f.read_text().count(START) != 1]
    for b in bad:
        print('missing or doubled GAME DATA block:', b)
    return 1 if bad else 0


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'write':
        write()
    elif cmd == 'check':
        sys.exit(check())
    else:
        print(__doc__)
        sys.exit(2)
