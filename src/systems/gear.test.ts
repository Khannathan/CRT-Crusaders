import { describe, expect, it } from 'vitest';
import { CRUSADERS } from '../data/crusaders';
import { ANCIENT_IP, EDICTS, GODFORGED, MAX_IP, MAX_POWERS, ROLL_MIN, SAINTS_ARMS, uniqueValue } from '../data/loot';
import { newSave } from '../state/save';
import { OSSUARY, enterNode, finishRun, startRun, winRoom } from './crusade';
import {
  MAX_GEAR,
  MAX_GEAR_LEVEL,
  MAX_REFINE,
  claimGear,
  confess,
  confessBlock,
  convertLegacy,
  cryptIp,
  enhance,
  enhanceBlock,
  equip,
  equipped,
  gearBonus,
  gearCombat,
  gearOf,
  imprint,
  imprintBlock,
  indexOf,
  mainValue,
  makeGear,
  salvage,
  settle,
  type GearItem,
} from './gear';
import { bisKit, farmedKit, kitRatio, starterKit } from './gearBudget';
import { simulateField } from './field';
import { skirmish } from './crusade';
import { seeded } from './rng';
import { statsFor } from './stats';

const seq = (xs: number[]) => {
  let i = 0;
  return () => xs[i++ % xs.length];
};

describe('Relics of War: rolling loot', () => {
  it('bands roll grades; lines never repeat a stat or the main stat; rolls land 70-100%', () => {
    const rng = seeded(7);
    for (let i = 0; i < 300; i++) {
      const g = makeGear(rng, (['R', 'SR', 'SSR'] as const)[i % 3], undefined, { ip: 100 + (i % 8) * 100 });
      const want = { worn: 0, consecrated: 2, sworn: 3, anathema: 3 }[g.grade as 'worn'];
      expect(g.subs.length).toBe(want);
      expect(new Set(g.subs.map((s) => s.stat)).size).toBe(g.subs.length);
      expect(g.subs.some((s) => s.stat === g.main || s.stat === 'spd')).toBe(false);
      for (const s of g.subs) expect(s.roll).toBeGreaterThanOrEqual(ROLL_MIN);
      if (g.grade === 'anathema') expect(EDICTS.find((e) => e.id === g.edict?.id)?.slots).toContain(g.slot);
      if (g.ip < ANCIENT_IP) expect(g.subs.some((s) => s.burn)).toBe(false);
    }
  });

  it('Item Power makes the same piece bigger', () => {
    const lo = makeGear(seq([0.5]), 'SR', 'blade', { grade: 'sworn', ip: 100 });
    const hi = makeGear(seq([0.5]), 'SR', 'blade', { grade: 'sworn', ip: MAX_IP });
    expect(mainValue(hi)).toBeGreaterThan(mainValue(lo) * 2);
    expect(hi.subs[0].value).toBeGreaterThan(lo.subs[0].value * 2);
  });

  it('Ancient pieces can roll Burning lines worth x1.5', () => {
    const g = makeGear(() => 0.01, 'SR', 'blade', { grade: 'sworn', ip: MAX_IP });
    expect(g.subs.every((s) => s.burn)).toBe(true);
    const plain = makeGear(() => 0.01, 'SR', 'blade', { grade: 'sworn', ip: ANCIENT_IP - 1 });
    expect(plain.subs.some((s) => s.burn)).toBe(false);
  });

  it("UR bands make Saint's Arms; Godforged are IP 800 with four Burning lines", () => {
    const arms = makeGear(seeded(3), 'UR', 'habit');
    expect([arms.grade, arms.unique, arms.ip]).toEqual(['arms', 'ashMail', MAX_IP]);
    const god = makeGear(seeded(3), 'UR', undefined, { grade: 'godforged' });
    expect(god.grade).toBe('godforged');
    expect(god.subs.length).toBe(4);
    expect(god.subs.every((s) => s.burn)).toBe(true);
  });

  it('content sets Item Power: deeper crypts and Heresy drop higher, the deepest at Heresy V Ancient', () => {
    expect(cryptIp(0, 18, 0)).toBe(100);
    expect(cryptIp(17, 18, 0)).toBe(400);
    expect(cryptIp(17, 18, 4)).toBe(600);
    expect(cryptIp(17, 18, 5, () => 0.5)).toBeGreaterThanOrEqual(ANCIENT_IP);
  });
});

describe('Relics of War: wearing it', () => {
  it('equipped gear raises stats, one piece per slot', () => {
    const save = newSave();
    const c = CRUSADERS[0];
    save.owned[c.id] = { level: 1, vow: 0 };
    const bare = statsFor(c, save.owned[c.id]);
    claimGear(save, [makeGear(seq([0]), 'SSR', 'blade', { ip: 600 }), makeGear(seq([0]), 'R', 'blade', { ip: 600 })]);
    const [a, b] = save.gear!.slice(-2);
    equip(save, c.id, a.uid);
    equip(save, c.id, b.uid);
    expect(equipped(save, c.id).map((g) => g.uid)).toEqual([b.uid]);
    const worn = statsFor(c, save.owned[c.id], equipped(save, c.id));
    expect(Math.abs(worn.atk - bare.atk * (1 + gearBonus([b]).atkPct))).toBeLessThanOrEqual(1);
    expect(worn.atk).toBeGreaterThan(bare.atk);
  });

  it(`only her ${MAX_POWERS} strongest Edicts and relic powers wake`, () => {
    const pieces = EDICTS.slice(0, 5).map((e, i) => makeGear(seeded(i), 'SSR', e.slots[0], { grade: 'anathema', edict: e.id, ip: 600 }));
    const c = gearCombat(pieces)!;
    expect(Object.keys(c.edicts).length).toBe(MAX_POWERS);
  });

  it("a Saint's Arms worn by a Sister of its Order wakes its Sworn line", () => {
    const flail = makeGear(() => 0.5, 'UR', 'blade');
    expect(gearCombat([flail], 'Iron Vigil')!.uniques.unsleepingFlail).toBeCloseTo(uniqueValue('unsleepingFlail', 0.5, true));
    expect(gearCombat([flail], 'Ashen Mercy')!.uniques.unsleepingFlail).toBeCloseTo(uniqueValue('unsleepingFlail', 0.5, false));
  });

  it('a fight with Edicts and relic powers on runs to its end', () => {
    const save = newSave();
    const party = CRUSADERS.filter((c) => c.order === 'Iron Vigil' && c.rarity === 'R').slice(0, 4).map((c) => c.id);
    for (const id of party) save.owned[id] = { level: 20, vow: 0 };
    const kit = [
      makeGear(seeded(1), 'UR', 'blade'),
      makeGear(seeded(2), 'UR', 'habit'),
      makeGear(seeded(3), 'UR', 'veil'),
      makeGear(seeded(4), 'UR', 'sabatons'),
      makeGear(seeded(5), 'UR', undefined, { unique: GODFORGED[0].id }),
    ];
    claimGear(save, kit);
    for (const g of gearOf(save)) if (g.grade === 'arms' || g.grade === 'godforged') equip(save, party[0], g.uid);
    const edicts = EDICTS.map((e, i) => makeGear(seeded(10 + i), 'SSR', e.slots[0], { grade: 'anathema', edict: e.id, ip: 600 }));
    claimGear(save, edicts);
    const loose = gearOf(save).filter((g) => !g.on);
    party.slice(1).forEach((id, i) => loose.filter((_g, j) => j % 3 === i).forEach((g) => equip(save, id, g.uid)));
    for (let i = 0; i < 6; i++) {
      const r = simulateField(skirmish(save, party, 'ossuary-1', 0, seeded(100 + i)), { rng: seeded(200 + i) });
      expect(['victory', 'defeat']).toContain(r.outcome);
    }
  });
});

describe('Relics of War: the Anvil, the Confessional, the Index', () => {
  const sworn = (): GearItem => ({ ...makeGear(seeded(9), 'SR', 'blade', { grade: 'sworn', ip: 500 }), uid: 'x', level: 10 });

  it('refines past +10 only with Consecrated Iron, up to +15; every third level a line grows', () => {
    const save = newSave();
    save.tithes = 100_000;
    const item = sworn();
    expect(enhanceBlock(save, item)).toMatch(/Iron/);
    save.items = { iron1: 25, iron2: 16, iron3: 2 };
    const before = mainValue(item);
    const lines = item.subs.reduce((n, s) => n + s.value, 0);
    for (let i = 0; i < 8; i++) enhance(save, item, () => 0);
    expect(item.level).toBe(MAX_REFINE);
    expect(mainValue(item)).toBeGreaterThan(before);
    expect(item.subs.reduce((n, s) => n + s.value, 0)).toBeGreaterThan(lines);
    expect(item.subs[0].up).toBe(2);
    expect(enhanceBlock(save, item)).toBe('Fully refined');
  });

  it('enhancing from +0 stops at +10 on Tithes alone', () => {
    const save = newSave();
    save.tithes = 1e6;
    const item = { ...sworn(), level: 0 };
    for (let i = 0; i < MAX_GEAR_LEVEL + 3; i++) enhance(save, item);
    expect(item.level).toBe(MAX_GEAR_LEVEL);
  });

  it('confessing spends Penance, offers two lines, and locks the line for good', () => {
    const save = newSave();
    save.tithes = 1e6;
    const item = sworn();
    const pen = item.penance;
    const offer = confess(save, item, 1, seeded(4))!;
    expect(offer.length).toBe(2);
    expect(item.penance).toBeLessThanOrEqual(pen - 2);
    expect(confessBlock(save, item, 1)).toMatch(/Choose/);
    settle(item, 0);
    expect(item.subs[1].stat).toBe(offer[0].stat);
    expect(new Set([item.main, ...item.subs.map((s) => s.stat)]).size).toBe(4);
    expect(confessBlock(save, item, 0)).toMatch(/first confessed/);
    expect(confessBlock(save, item, 1)).toBeUndefined();
    item.penance = 1;
    expect(confessBlock(save, item, 1)).toMatch(/Absolved/);
  });

  it('melting Anathema records its Edict (best roll kept); the Index imprints it on a Sworn piece', () => {
    const save = newSave();
    const e = EDICTS.find((x) => x.slots.includes('blade'))!;
    claimGear(save, [{ ...makeGear(seeded(1), 'SSR', 'blade', { grade: 'anathema', edict: e.id, ip: 500 }), edict: { id: e.id, roll: 0.8 } }]);
    const target = { ...sworn(), uid: 'y' };
    expect(imprintBlock(save, target, e.id)).toMatch(/Index/);
    salvage(save, save.gear!.at(-1)!.uid);
    expect(indexOf(save)[e.id]).toBe(0.8);
    save.tithes = 1e5;
    save.items = { ...save.items, iron2: 3 };
    expect(imprint(save, target, e.id)).toBe(true);
    expect(target.grade).toBe('anathema');
    expect(target.edict).toEqual({ id: e.id, roll: 0.8 });
  });

  it('the loot filter melts on arrival; a full armory melts too', () => {
    const save = newSave();
    save.lootFilter = { melt: 'consecrated' };
    const before = save.gear!.length;
    const t = save.tithes;
    claimGear(save, [makeGear(seeded(1), 'R', 'blade', { grade: 'consecrated', ip: 300 }), makeGear(seeded(2), 'SR', 'blade', { grade: 'sworn', ip: 300 })]);
    expect(save.gear!.length).toBe(before + 1);
    expect(save.tithes).toBeGreaterThan(t);
    save.lootFilter = {};
    claimGear(save, Array.from({ length: MAX_GEAR }, (_, i) => makeGear(seeded(i), 'R')));
    expect(save.gear!.length).toBe(MAX_GEAR);
  });
});

describe('Relics of War: old saves', () => {
  it('old pieces convert by rarity, keep level and wearer, and the Armory sends one letter', () => {
    const save = newSave();
    const id = CRUSADERS[0].id;
    save.owned[id] = { level: 1, vow: 0 };
    save.gear = [
      { uid: 'g1', slot: 'blade', rarity: 'SSR', name: 'Sainted Flail', level: 7, main: 'atkPct', subs: [{ stat: 'crit', value: 0.06 }, { stat: 'spd', value: 2 }], on: id, set: 'flagellant' },
      { uid: 'g2', slot: 'habit', rarity: 'UR', name: "Martyr's Habit", level: 12, main: 'hpPct', subs: [] },
      { uid: 'g3', slot: 'sabatons', rarity: 'SR', name: 'Iron Shoes', level: 0, main: 'spd', subs: [{ stat: 'crit', value: 0.03 }] },
    ] as unknown as GearItem[];
    const list = gearOf(save);
    expect(list.map((g) => g.grade)).toEqual(['sworn', 'arms', 'consecrated']);
    expect([list[0].level, list[0].on, list[0].name]).toEqual([7, id, 'Sainted Flail']);
    expect(list[0].subs.length).toBe(3);
    expect(list[0].subs.some((s) => s.stat === 'spd')).toBe(false);
    expect(list[1].unique).toBe('ashMail');
    expect(list[2].main).not.toBe('spd');
    expect(save.missives?.letters.filter((l) => l.title === 'Relics of War!').length).toBe(1);
    convertLegacy(save);
    expect(save.missives?.letters.filter((l) => l.title === 'Relics of War!').length).toBe(1);
  });
});

describe('Relics of War: drops', () => {
  it('crusades drop gear at the crypt\'s Item Power: kept win or lose', () => {
    for (const outcome of ['victory', 'defeat'] as const) {
      const save = newSave();
      const id = CRUSADERS[0].id;
      save.owned[id] = { level: 1, vow: 0 };
      const run = startRun(save, [id], OSSUARY, seq([0.1, 0.4, 0.7]));
      const elite = run.map.findIndex((f) => f.some((n) => n.kind === 'elite'));
      run.floor = elite - 1;
      run.at = 0;
      run.map[elite - 1][0].next = [run.map[elite].findIndex((n) => n.kind === 'elite')];
      enterNode(run, run.map[elite - 1][0].next[0]);
      winRoom(run, save, () => 0.5);
      expect(run.loot.length).toBe(1);
      expect(run.loot[0].ip).toBeGreaterThanOrEqual(95);
      expect(run.loot[0].ip).toBeLessThanOrEqual(120);
      const before = save.gear!.length;
      const res = finishRun(save, run, outcome);
      expect(save.gear!.length).toBe(before + 1);
      expect(res.gear.length).toBe(1);
    }
  });
});

describe("the Saints' Armory", () => {
  it("pulls never miss a Saint's Arms past the pity count, and leave Fragments", async () => {
    const { PITY, pullArmory, giftWrits, armoryOf } = await import('./armory');
    const save = newSave();
    save.gear = [];
    expect(giftWrits(save)).toBe(true);
    expect(giftWrits(save)).toBe(false);
    save.gilt = 1e6;
    const got: GearItem[] = [];
    for (let i = 0; i < PITY / 10; i++) got.push(...pullArmory(save, 10, i === 0 ? 'writ' : 'gilt', () => 0.99));
    expect(got.length).toBe(PITY);
    expect(got.filter((g) => g.grade === 'arms').length).toBe(1);
    expect(got.every((g) => g.grade !== 'worn' && g.grade !== 'godforged')).toBe(true);
    expect(save.items?.armory1).toBe(PITY);
    expect(armoryOf(save).pity).toBe(0);
  });

  it("the featured piece turns weekly; the forge pours a chosen Saint's Arms, Godsparks a Godforged", async () => {
    const { featuredArms, forgeUnique, FORGE_FRAGMENTS } = await import('./armory');
    const mon = new Date(2026, 10, 16).getTime();
    expect(featuredArms(mon).arms.id).toBe(featuredArms(mon + 5 * 864e5).arms.id);
    expect(featuredArms(mon).arms.id).not.toBe(featuredArms(mon + 7 * 864e5).arms.id);
    const save = newSave();
    const id = SAINTS_ARMS[2].id;
    expect(forgeUnique(save, id, 'fragments')).toBeUndefined();
    save.items = { armory1: FORGE_FRAGMENTS, spark1: 2 };
    expect(forgeUnique(save, id, 'fragments')!.unique).toBe(id);
    expect(save.items.armory1).toBe(0);
    expect(forgeUnique(save, id, 'sparks')).toBeUndefined();
    expect(forgeUnique(save, GODFORGED[0].id, 'sparks')!.grade).toBe('godforged');
    expect(save.items.spark1).toBe(0);
  });
});

describe('the gear power budget', () => {
  const sisters = ['inquisitor', 'veilblade', 'hierophant', 'confessor', 'cantor', 'arbalist', 'oracle', 'warsister'].map(
    (cls) => CRUSADERS.find((x) => x.classId === cls && x.order === 'Iron Vigil' && !x.limited)!,
  );
  const fresh = (c: (typeof sisters)[number]) => {
    const save = newSave();
    save.gear = [];
    save.owned[c.id] = { level: 50, vow: 0, asc: 3 };
    return save;
  };

  it('best in slot lifts Power x1.65 at most; a farmed kit about x1.2; starter gear a little', { timeout: 60_000 }, () => {
    for (const base of sisters) {
      const c = { ...base, rarity: 'R' as const };
      const save = fresh(c);
      expect(kitRatio(save, c, bisKit(save, c))).toBeLessThanOrEqual(1.65);
      const farmed = kitRatio(save, c, farmedKit(c));
      expect(farmed).toBeGreaterThan(1.12);
      expect(farmed).toBeLessThan(1.35);
      expect(kitRatio(save, c, starterKit())).toBeLessThan(1.1);
    }
  });

  it('a UR in starter gear beats an R in perfect gear', { timeout: 60_000 }, async () => {
    const { sisterPower } = await import('./power');
    for (const base of sisters.slice(0, 3)) {
      const r = { ...base, rarity: 'R' as const, limited: undefined };
      const ur = { ...base, rarity: 'UR' as const, limited: undefined };
      const save = fresh(r);
      const kit = bisKit(save, r);
      save.gear = kit.map((g) => ({ ...g, on: r.id }));
      const rBis = sisterPower(save, r);
      save.gear = starterKit().map((g) => ({ ...g, on: ur.id }));
      expect(sisterPower(save, ur)).toBeGreaterThan(rBis);
    }
  });
});
