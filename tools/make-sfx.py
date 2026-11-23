"""Makes every sound effect in src/assets/sfx: dark 16-bit chip sounds played
through an old CRT TV's small speaker (no deep bass, muffled top, boxy).

  python3 tools/make-sfx.py <out-wav-folder>
  then tools/encode-sfx.sh <out-wav-folder>  (writes .ogg + .mp3 into src/assets/sfx)

Seeded, so the same file comes out every run. Change a recipe, rerun.
"""
import numpy as np, wave, sys, os

SR = 44100
rng = np.random.default_rng(13)

# ---------- building blocks ----------
def env(n, a=0.003, k=4.0):
    e = np.exp(-np.linspace(0, k, n)); na = max(1, int(a * SR)); e[:na] *= np.linspace(0, 1, na); return e
def osc(f0, f1, d, shape='sq', duty=0.5, vol=0.5, k=4, a=0.003, detune=0):
    n = int(d * SR); f = np.geomspace(f0, f1 or f0, n) * (1 + detune); ph = np.cumsum(f) / SR % 1
    w = {'sq': np.where(ph < duty, 1., -1.), 'tri': 4 * np.abs(ph - 0.5) - 1, 'saw': 2 * ph - 1, 'sin': np.sin(2 * np.pi * ph)}[shape]
    return vol * w * env(n, a, k)
def thick(f0, f1, d, shape='saw', vol=0.4, k=4, a=0.003, spread=0.012):
    return sum(osc(f0, f1, d, shape, vol=vol / 3, k=k, a=a, detune=x) for x in (-spread, 0, spread))
def lp(x, fc):
    a = np.exp(-2 * np.pi * fc / SR); y = np.empty_like(x); s = 0.
    for i, v in enumerate(x): s = (1 - a) * v + a * s; y[i] = s
    return y
def nz(d, vol=0.5, k=5, fc=None, hold=1):
    n = int(d * SR); v = np.repeat(rng.uniform(-1, 1, n // hold + 1), hold)[:n]
    if fc: v = lp(v, fc) * 3
    return vol * v * env(n, 0.001, k)
def bell(f, d, vol=0.5):  # inharmonic iron bell
    return sum(osc(f * r, None, d, 'sin', vol=vol * g, k=3 + r) for r, g in [(0.5, .5), (1, .6), (1.19, .35), (1.56, .3), (2, .25), (2.74, .15), (3.76, .08)])
def choir(freqs, d, vol=0.3, a=0.15):
    return lp(sum(thick(f, None, d, 'saw', vol / len(freqs), k=1.5, a=a, spread=0.008) for f in freqs), 1400)
def mix(parts):
    L = max(int(at * SR) + len(p) for at, p in parts); b = np.zeros(L)
    for at, p in parts: i = int(at * SR); b[i:i + len(p)] += p
    return b
def arp(notes, step, d, vol=0.25, shape='sq', start=0, k=3):
    return [(start + i * step, thick(f, None, d, shape, vol, k=k)) for i, f in enumerate(notes)]
IR = {}
def reverb(x, size=2.0, wet=0.4):
    if size not in IR:
        n = int(size * SR); ir = rng.standard_normal(n) * np.exp(-np.linspace(0, 7, n)); ir = lp(ir, 3500); IR[size] = ir
    ir = IR[size]; L = len(x) + len(ir); N = 1 << (L - 1).bit_length()
    y = np.fft.irfft(np.fft.rfft(x, N) * np.fft.rfft(ir, N), N)[:L]
    xx = np.concatenate([x, np.zeros(len(ir))]); y = y / (np.abs(y).max() + 1e-9) * np.abs(x).max()
    return (1 - wet) * xx + wet * y
def biquad(x, kind, f, q=0.707, gain_db=0):
    w = 2 * np.pi * f / SR; al = np.sin(w) / (2 * q); c = np.cos(w); A = 10 ** (gain_db / 40)
    if kind == 'hp': b = [(1 + c) / 2, -(1 + c), (1 + c) / 2]; a = [1 + al, -2 * c, 1 - al]
    elif kind == 'lp': b = [(1 - c) / 2, 1 - c, (1 - c) / 2]; a = [1 + al, -2 * c, 1 - al]
    else: b = [1 + al * A, -2 * c, 1 - al * A]; a = [1 + al / A, -2 * c, 1 - al / A]
    b = [v / a[0] for v in b]; a = [v / a[0] for v in a]
    y = np.zeros_like(x); x1 = x2 = y1 = y2 = 0.
    for i, v in enumerate(x):
        o = b[0] * v + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2; x2, x1, y2, y1 = x1, v, y1, o; y[i] = o
    return y
def tv(x):
    """An old CRT TV's own speaker: no deep bass, muffled top, a boxy plastic cabinet."""
    x = np.tanh(x * 2.2) / np.tanh(2.2)
    x = biquad(x, 'hp', 170, 0.9); x = biquad(x, 'hp', 170, 0.6)
    x = biquad(x, 'pk', 900, 1.2, 5); x = biquad(x, 'pk', 2400, 2.0, 2)
    x = biquad(x, 'lp', 4200, 0.7); x = biquad(x, 'lp', 5000, 0.6)
    d1, d2 = int(0.0011 * SR), int(0.0023 * SR)
    y = x.copy(); y[d1:] += 0.25 * x[:-d1]; y[d2:] -= 0.12 * x[:-d2]
    return y
def finish(x, room, wet, maxlen, level):
    """Room, then the TV speaker, then cut to maxlen with a short fade, at a peak level."""
    x = tv(reverb(x, room, wet) if room else x)
    x = x[:int(maxlen * SR)]
    # trim near-silence at the end, then fade
    thr = np.abs(x).max() * 0.004; idx = np.nonzero(np.abs(x) > thr)[0]
    x = x[:idx[-1] + 1] if len(idx) else x
    f = min(len(x) // 3, int(0.04 * SR)); x[-f:] *= np.linspace(1, 0, f) ** 2
    return x / (np.abs(x).max() + 1e-9) * level

# ---------- recipes: (sound, room size, wet, max length s, peak level) ----------
R = {}
# Part A: the sounds the game already plays
R['tap'] = (mix([(0, nz(0.03, 0.5, k=8, fc=2500)), (0, osc(220, 150, 0.04, 'sq', 0.3, 0.4, k=6))]), 0.3, 0.12, 0.09, 0.32)
R['hit'] = (mix([(0, nz(0.1, 0.9, k=6, fc=3000, hold=2)), (0, osc(170, 60, 0.11, 'sq', 0.5, 0.6, k=4)), (0, osc(80, 45, 0.12, 'sin', vol=0.6, k=4))]), 0.4, 0.15, 0.2, 0.55)
R['hitMagic'] = (mix([(0, osc(900, 260, 0.12, 'tri', vol=0.5, k=3)), (0, osc(450, 130, 0.12, 'sq', 0.25, 0.25, k=3)), (0, nz(0.06, 0.4, k=6, fc=4000))]), 0.5, 0.2, 0.26, 0.55)
R['crit'] = (mix([(0, nz(0.22, 1.0, k=4, fc=4000, hold=2)), (0, osc(420, 60, 0.2, 'saw', vol=0.4, k=3)), (0.005, bell(310, 0.5, 0.35)), (0.04, osc(90, 40, 0.3, 'sq', 0.5, 0.6, k=3)), (0.04, nz(0.25, 0.6, k=4, fc=500))]), 1.0, 0.3, 0.6, 0.85)
R['hurt'] = (mix([(0, nz(0.09, 0.7, k=6, fc=1200, hold=3)), (0, osc(140, 60, 0.12, 'sq', 0.5, 0.6, k=4))]), 0.4, 0.15, 0.2, 0.55)
R['dot'] = (mix([(0, nz(0.07, 0.6, k=5, fc=3500, hold=2)), (0, osc(300, 200, 0.05, 'tri', vol=0.2, k=5))]), 0.3, 0.12, 0.13, 0.3)
R['block'] = (mix([(0, bell(620, 0.25, 0.45)), (0, nz(0.03, 0.6, k=8, fc=4000))]), 0.4, 0.15, 0.22, 0.5)
R['heal'] = (mix(arp([392, 494, 587, 784], 0.06, 0.25, 0.3, 'tri') + [(0.12, choir([392, 587], 0.3, 0.25, 0.08))]), 1.0, 0.3, 0.6, 0.5)
R['shield'] = (mix([(0, thick(330, None, 0.12, 'sq', 0.3, k=3)), (0.06, thick(494, None, 0.2, 'sq', 0.3, k=3)), (0.06, bell(988, 0.25, 0.15))]), 0.6, 0.2, 0.4, 0.5)
R['kill'] = (mix([(0, osc(200, 30, 0.5, 'saw', vol=0.5, k=2.5)), (0, nz(0.55, 0.6, k=3, fc=900, hold=4)), (0.08, nz(0.4, 0.4, k=5, fc=2500, hold=8)), (0.04, choir([110, 117], 0.5, 0.25, 0.02))]), 1.0, 0.3, 0.75, 0.7)
R['fall'] = (mix([(i * 0.16, bell(f, 0.7, 0.4)) for i, f in enumerate([294, 262, 220, 165])] + [(0, choir([110, 131, 165], 1.0, 0.3, 0.2))]), 2.0, 0.4, 1.4, 0.7)
R['litany'] = (mix([(0, nz(0.7, 0.3, k=3, fc=1200))] + arp([147, 175, 220, 294, 349, 440], 0.06, 0.25) + [(0.36, choir([147, 220, 294, 349, 440], 1.2, 0.7, 0.05)), (0.36, bell(294, 1.3, 0.4)), (0.36, osc(73, None, 1.1, 'saw', vol=0.25, k=2))]), 2.5, 0.45, 1.6, 0.9)
R['blasphemy'] = (mix([(i * 0.11, thick(62 - i * 3, 55 - i * 3, 0.14, 'saw', 0.6, k=2)) for i in range(7)] + [(0, choir([65, 69, 98, 104], 1.0, 0.6, 0.2)), (0, nz(0.9, 0.5, k=2, fc=300, hold=8))]), 2.0, 0.4, 1.3, 0.9)
R['chain'] = (mix([(0, thick(587, None, 0.08, 'sq', 0.3, k=4)), (0.06, thick(880, None, 0.14, 'sq', 0.3, k=4)), (0.06, bell(880, 0.25, 0.15))]), 0.5, 0.2, 0.35, 0.55)
R['dodge'] = (mix([(0, nz(0.15, 0.7, k=3, fc=2200)), (0, osc(300, 900, 0.12, 'tri', vol=0.15, k=3))]), 0.3, 0.12, 0.2, 0.45)
R['perfect'] = (mix([(0, nz(0.12, 0.6, k=3, fc=3000))] + [(0.05 + i * 0.05, bell(f, 0.3, 0.25)) for i, f in enumerate([784, 988, 1319])]), 0.8, 0.3, 0.5, 0.6)
R['coin'] = (mix([(0, bell(740, 0.35, 0.35)), (0.06, bell(988, 0.45, 0.35)), (0, nz(0.03, 0.4, k=8, fc=5000))]), 0.6, 0.25, 0.4, 0.5)
R['candle'] = (mix([(0, nz(0.1, 0.6, k=4, fc=2500, hold=2)), (0.05, bell(523, 0.6, 0.4)), (0.05, choir([262, 392], 0.5, 0.2, 0.05))]), 1.2, 0.35, 0.7, 0.7)
R['levelUp'] = (mix(arp([220, 262, 330, 440], 0.09, 0.3) + [(0.36, choir([220, 330, 440, 523], 0.8, 0.5, 0.06)), (0.36, bell(440, 0.9, 0.3))]), 1.5, 0.4, 1.1, 0.8)
R['slam'] = (mix([(0, nz(0.4, 1.0, k=4, fc=700, hold=3)), (0, osc(110, 40, 0.4, 'sq', 0.5, 0.7, k=3)), (0, bell(110, 0.6, 0.4))]), 1.8, 0.4, 0.9, 0.9)
R['seal'] = (mix([(0, nz(0.06, 0.9, k=6, fc=3500, hold=2)), (0.04, bell(392, 0.4, 0.4))]), 0.8, 0.25, 0.45, 0.65)
R['sealRare'] = (mix([(0, nz(0.15, 1.0, k=4, fc=4000, hold=2))] + arp([196, 247, 294, 392, 494], 0.07, 0.25, start=0.05) + [(0.42, choir([196, 294, 392, 494], 0.9, 0.6, 0.05)), (0.42, bell(392, 1.0, 0.4))]), 2.0, 0.4, 1.4, 0.85)
# Part B: moments that were silent
R['tab'] = (mix([(0, nz(0.05, 0.6, k=5, fc=1800, hold=2)), (0.01, osc(330, 260, 0.05, 'sq', 0.25, 0.3, k=5))]), 0.3, 0.12, 0.12, 0.35)
R['open'] = (mix([(0, nz(0.14, 0.5, k=2, fc=1200)), (0, osc(160, 320, 0.12, 'tri', vol=0.4, k=3)), (0.1, osc(110, None, 0.05, 'sq', 0.5, 0.3, k=6))]), 0.4, 0.15, 0.25, 0.4)
R['close'] = (mix([(0, nz(0.1, 0.5, k=3, fc=1000)), (0, osc(320, 140, 0.1, 'tri', vol=0.4, k=3)), (0.08, osc(90, None, 0.05, 'sq', 0.5, 0.4, k=6))]), 0.4, 0.15, 0.22, 0.38)
R['deny'] = (mix([(0, thick(98, None, 0.12, 'sq', 0.45, k=3)), (0.14, thick(92, 80, 0.22, 'sq', 0.45, k=3)), (0, nz(0.04, 0.4, k=6, fc=1500))]), 0.5, 0.2, 0.45, 0.5)
R['claim'] = (mix([(0, bell(740, 0.3, 0.3)), (0.05, bell(880, 0.3, 0.3)), (0.1, bell(1109, 0.5, 0.3)), (0.1, choir([370, 554], 0.4, 0.2, 0.04))]), 1.0, 0.3, 0.75, 0.6)
R['fightStart'] = (mix([(0, bell(147, 1.4, 0.6)), (0, nz(0.05, 0.5, k=6, fc=2000)), (0.05, osc(900, 2400, 0.25, 'saw', vol=0.08, k=2)), (0.05, nz(0.3, 0.25, k=2, fc=4500))]), 2.0, 0.35, 1.3, 0.75)
R['telegraph'] = (mix([(0, thick(220, 330, 0.12, 'sq', 0.4, k=1)), (0.14, thick(220, 330, 0.12, 'sq', 0.4, k=1))]), 0.5, 0.2, 0.45, 0.55)
R['delay'] = (mix([(0, nz(0.25, 1.0, k=4, fc=4500, hold=1))] + [(0.01 + i * 0.03, bell(1200 + 300 * (i % 3), 0.2, 0.12)) for i in range(6)] + [(0, bell(330, 0.6, 0.45))]), 1.0, 0.3, 0.8, 0.8)
R['unction'] = (mix([(0, nz(0.25, 0.3, k=2, fc=2500)), (0, osc(262, 524, 0.3, 'tri', vol=0.35, k=2)), (0.15, bell(784, 0.4, 0.25))]), 0.8, 0.3, 0.6, 0.55)
R['bossAppear'] = (mix([(0, choir([55, 58, 82, 87], 1.6, 0.7, 0.3)), (0, nz(1.4, 0.5, k=1.5, fc=250, hold=8)), (0, osc(55, None, 1.5, 'saw', vol=0.3, k=1.5)), (0.6, bell(73, 1.2, 0.5))]), 2.5, 0.4, 2.0, 0.9)
R['pull'] = (mix([(0, choir([131, 196, 262], 1.3, 0.6, 0.6)), (0, nz(1.3, 0.35, k=0.5, fc=1500)), (0, osc(65, 131, 1.3, 'saw', vol=0.25, k=0.5))] + [(0.5 + i * 0.12, bell(523 * 1.06 ** i, 0.3, 0.1)) for i in range(6)]), 1.5, 0.35, 1.6, 0.75)
R['urReveal'] = (mix([(0, nz(0.45, 1.0, k=3, fc=5000)), (0, osc(80, 35, 0.5, 'sq', 0.5, 0.7, k=3))] + arp([196, 247, 294, 392, 494, 587], 0.06, 0.28, start=0.08) + [(0.45, choir([196, 294, 392, 494, 587], 1.5, 0.8, 0.05)), (0.45, bell(392, 1.6, 0.45)), (0.45, bell(98, 1.6, 0.4))] + [(0.5 + i * 0.05, bell(1568 * (1.122 ** (i % 4)), 0.3, 0.08)) for i in range(10)]), 2.5, 0.45, 2.4, 0.95)
R['ascend'] = (mix([(0, choir([131, 196, 262, 330], 1.4, 0.7, 0.25))] + [(i * 0.12, bell(f, 0.8, 0.3)) for i, f in enumerate([262, 330, 392, 523])] + [(0, nz(1.0, 0.2, k=1.5, fc=3000))]), 2.0, 0.4, 1.8, 0.85)
R['forge'] = (mix([(0, bell(830, 0.4, 0.5)), (0, nz(0.05, 0.9, k=6, fc=5000)), (0.18, bell(880, 0.5, 0.5)), (0.18, nz(0.05, 0.9, k=6, fc=5000)), (0.18, nz(0.25, 0.3, k=3, fc=6000, hold=4))]), 0.8, 0.3, 0.8, 0.7)
R['powerUp'] = (mix([(0, osc(196, 784, 0.2, 'sq', 0.25, 0.35, k=1)), (0.18, bell(1047, 0.35, 0.3))]), 0.6, 0.25, 0.5, 0.6)
R['rankUp'] = (mix(arp([196, 262, 330, 392], 0.1, 0.3, 0.3) + [(0.4, choir([196, 262, 330, 392, 523], 1.2, 0.7, 0.05)), (0.4, bell(262, 1.2, 0.45)), (0.4, osc(98, None, 1.0, 'saw', vol=0.3, k=2))]), 2.5, 0.4, 1.8, 0.9)
R['bell'] = (mix([(0, bell(196, 1.6, 0.6)), (0, nz(0.05, 0.5, k=6, fc=2000))]), 2.0, 0.35, 1.6, 0.7)
R['chest'] = (mix([(0, osc(150, 120, 0.25, 'saw', vol=0.3, k=1)), (0, nz(0.25, 0.4, k=1, fc=800, hold=20)), (0.25, nz(0.04, 0.8, k=6, fc=3000)), (0.3, bell(784, 0.5, 0.3)), (0.36, bell(1047, 0.5, 0.25))]), 1.0, 0.3, 1.0, 0.65)
R['step'] = (mix([(0, nz(0.06, 0.8, k=6, fc=900, hold=3)), (0, osc(110, 70, 0.06, 'sq', 0.5, 0.5, k=5)), (0.16, nz(0.06, 0.7, k=6, fc=900, hold=3)), (0.16, osc(100, 65, 0.06, 'sq', 0.5, 0.45, k=5))]), 0.8, 0.3, 0.5, 0.5)
R['whistle'] = (mix([(0, osc(1400, 1250, 0.45, 'tri', vol=0.4, k=1.5, a=0.03)), (0, nz(0.45, 0.15, k=1.5, fc=3000)), (0.35, thick(70, 60, 0.5, 'saw', 0.5, k=2, a=0.05)), (0.35, nz(0.5, 0.4, k=2, fc=300, hold=10))]), 1.2, 0.35, 1.1, 0.65)

def save(path, x):
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())

if __name__ == '__main__':
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    only = set(sys.argv[2:])
    for name, (x, room, wet, maxlen, level) in R.items():
        if only and name not in only: continue
        save(os.path.join(out, name + '.wav'), finish(x, room, wet, maxlen, level))
        print(name, round(min(maxlen, len(x) / SR + room), 2))
