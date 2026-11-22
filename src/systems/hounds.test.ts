import { describe, expect, it } from 'vitest';
import { HOUNDS } from '../data/hounds';
import { newSave } from '../state/save';
import { autoBattle } from './autoplay';
import { OSSUARY, skirmish } from './crusade';
import { GILT_START } from './currency';
import { FIRST_HOUND, HOUND_MAX, HOUND_PITY, WHISTLE_GILT, activeHowl, howlAt, houndsOf, setHound, whistle, whistleBlock } from './hounds';
import { seeded } from './rng';

const DAY = 86_400_000;
const T0 = new Date(2026, 10, 22, 12).getTime();

describe('the Kennel', () => {
  it('every Sisterhood starts with a Kennel Cur at its side', () => {
    const save = newSave();
    expect(houndsOf(save).active).toBe(FIRST_HOUND);
    expect(activeHowl(save)?.howl.atk).toBe(0.05);
  });

  it('one free whistle a day, then Gilt', () => {
    const save = newSave();
    const rng = seeded(1);
    expect(whistle(save, rng, T0)).toBeTruthy();
    expect(save.gilt ?? GILT_START).toBe(GILT_START);
    expect(whistle(save, rng, T0)).toBeTruthy();
    expect(save.gilt).toBe(GILT_START - WHISTLE_GILT);
    save.gilt = 10;
    expect(whistleBlock(save, T0)).toMatch(/Gilt/);
    expect(whistle(save, rng, T0)).toBeUndefined();
    expect(whistle(save, rng, T0 + DAY)).toBeTruthy();
  });

  it('a hound you have grows a level, up to the last, then turns to Alms', () => {
    const save = newSave();
    save.gilt = 1e6;
    const rng = seeded(7);
    let alms = 0;
    for (let i = 0; i < 400; i++) alms += whistle(save, rng, T0)?.alms ?? 0;
    const s = houndsOf(save);
    expect(Object.values(s.owned).every((h) => h.level <= HOUND_MAX)).toBe(true);
    expect(s.owned.cur.level).toBe(HOUND_MAX);
    expect(alms).toBeGreaterThan(0);
  });

  it('an SSR or UR hound comes at least every HOUND_PITY whistles', () => {
    const save = newSave();
    save.gilt = 1e6;
    const rng = seeded(3);
    let since = 0;
    for (let i = 0; i < 300; i++) {
      const r = whistle(save, rng, T0)!;
      since = r.hound.rarity === 'SSR' || r.hound.rarity === 'UR' ? 0 : since + 1;
      expect(since).toBeLessThan(HOUND_PITY);
    }
  });

  it('howls grow 10% a level', () => {
    const shuck = HOUNDS.find((h) => h.id === 'shuck')!;
    expect(howlAt(shuck, 1)).toEqual({ atk: 0.08, zeal: 3 });
    expect(howlAt(shuck, 5)).toEqual({ atk: 0.112, zeal: 4 });
  });
});

describe('howls in battle', () => {
  const party = ['CC-W013', 'CC-W052', 'CC-W001', 'CC-W022'];
  const withHound = (id?: string, level = 1) => {
    const save = newSave();
    for (const p of party) save.owned[p] = { level: 5, vow: 0 };
    const s = houndsOf(save);
    if (id) s.owned[id] = { level };
    setHound(save, id);
    return save;
  };

  it('howls every round: Zeal, shield on the front Sister, scent on the foes', () => {
    const lurcher = skirmish(withHound('lurcher'), party, OSSUARY.boss, 0, seeded(2));
    const plain = skirmish(withHound(undefined), party, OSSUARY.boss, 0, seeded(2));
    lurcher.nextTurn();
    plain.nextTurn();
    expect(lurcher.zeal - plain.zeal).toBe(3);

    const grave = skirmish(withHound('grave'), party, OSSUARY.boss, 0, seeded(2));
    const start = grave.nextTurn();
    expect(start.events.some((e) => e.type === 'text' && e.text.includes('Churchyard Watch'))).toBe(true);
    expect(start.events.some((e) => e.type === 'shield')).toBe(true);

    const beagle = skirmish(withHound('beagle'), party, OSSUARY.boss, 0, seeded(2));
    beagle.nextTurn();
    expect(beagle.alive('enemy').every((e) => e.status.sunder?.pct === 0.12 && e.status.hex?.pct === 0.12)).toBe(true);
  });

  it('a better hound helps, but no hound wins a fight alone', () => {
    const rate = (id?: string, level = 1) => {
      let wins = 0;
      for (let i = 0; i < 200; i++) {
        const save = withHound(id, level);
        for (const p of party) save.owned[p].level = 2; // a fight the party wins about two times in three without a hound
        if (autoBattle(skirmish(save, party, OSSUARY.boss, 0, seeded(500 + i)), 400) === 'victory') wins++;
      }
      return wins / 200;
    };
    const none = rate(undefined);
    const cur = rate('cur');
    const shuck = rate('shuck', HOUND_MAX);
    const wolf = rate('wolfhound', HOUND_MAX);
    console.log(`[hounds] Ossuary boss at level 2: none ${none}, cur ${cur}, shuck+5 ${shuck}, wolfhound+5 ${wolf}`);
    expect(cur).toBeGreaterThanOrEqual(none);
    expect(shuck).toBeGreaterThan(none);
    // Everyone has the Cur; the best hound at its last level is worth having, not a win button.
    expect(shuck - cur).toBeLessThan(0.25);
    expect(wolf - cur).toBeLessThan(0.3);
  }, 20_000); // 800 simulated fights: about 3 s alone, over 5 s on a busy CI runner
});
