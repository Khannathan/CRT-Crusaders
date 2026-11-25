import { describe, expect, it } from 'vitest';
import { CRUSADERS } from '../data/crusaders';
import { KITS } from '../data/kits';
import { LIMITED_BANNERS, LIMITED_DAYS, limitedWindow } from '../systems/limited';
import { importSave, newSave, type SaveData } from './save';
import { copiesHeld, migrateRoster, moveIds } from './rosterMigration';
import { RETIRED } from '../data/retired';
import { ROSTER } from '../data/roster';
import { CLASSES } from '../data/classes';

const old = (extra: Partial<SaveData> = {}) => ({ ...newSave(), roster: undefined, ...extra }) as SaveData;

describe('the 200-Sister roster', () => {
  it('has 20 Sisters in each of 10 Orders: 5 top slots, then an SSR, SR and R of each role', () => {
    expect(CRUSADERS).toHaveLength(200);
    expect(new Set(CRUSADERS.map((c) => c.id)).size).toBe(200);
    expect(CRUSADERS.find((c) => c.id === 'IV-LUR')!.name).toBe('Insomnia');
    for (const c of CRUSADERS) expect(KITS[c.id], c.id).toBeDefined();
    const orders = new Set(CRUSADERS.map((c) => c.order));
    expect(orders.size).toBe(10);
    for (const o of orders) {
      const mine = CRUSADERS.filter((c) => c.order === o);
      expect(mine, o).toHaveLength(20);
      const std = mine.filter((c) => c.id.split('-').length === 3);
      // every Order still fields all 15 classes, one role's three spread over SSR, SR and R
      expect(new Set(std.map((c) => c.classId)).size, o).toBe(15);
      for (const r of ['SSR', 'SR', 'R'] as const) {
        const roles = std.filter((c) => c.rarity === r).map((c) => CLASSES[c.classId].role);
        expect(new Set(roles).size, `${o} ${r}`).toBe(5);
      }
    }
  });

  it('gives every class an SSR, SR and R in at least three Orders', () => {
    for (const id of Object.keys(CLASSES))
      for (const r of ['SSR', 'SR', 'R'])
        expect(CRUSADERS.filter((c) => c.classId === id && c.rarity === r && !c.limited && c.id.split('-').length === 3).length, `${id} ${r}`).toBeGreaterThanOrEqual(3);
  });

  it('retires 300 Sisters, each to a kept Sister of her Order, rarity and role', () => {
    expect(Object.keys(RETIRED)).toHaveLength(300);
    const byId = new Map(ROSTER.map((c) => [c.id, c]));
    for (const [cut, kept] of Object.entries(RETIRED)) {
      const a = byId.get(cut)!;
      const b = CRUSADERS.find((c) => c.id === kept)!;
      expect(b, kept).toBeDefined();
      expect([b.order, b.rarity, CLASSES[b.classId].role]).toEqual([a.order, a.rarity, CLASSES[a.classId].role]);
    }
  });

  it('gives every Order an Adjudicator whose Litany breaks a Blasphemy', () => {
    for (const c of CRUSADERS.filter((x) => x.classId === 'adjudicator' && KITS[x.id]?.generated)) {
      const lit = KITS[c.id].skills[3];
      expect((lit.wrathDrain ?? 0) + (lit.alsoFoes?.wrathDrain ?? 0) + (lit.delay ? 99 : 0), c.id).toBeGreaterThanOrEqual(26);
    }
  });

  it('runs ten Limited banners, two weeks each, through April 2027', () => {
    expect(LIMITED_BANNERS).toHaveLength(10);
    expect(LIMITED_BANNERS[0].saint.id).toBe('IV-LUR');
    const last = limitedWindow(new Date(2027, 2, 30).getTime());
    expect(last.slot).toBe(9);
    expect(last.ends - new Date(2026, 10, 16).getTime()).toBeGreaterThanOrEqual(10 * LIMITED_DAYS * 864e5 - 864e5);
  });
});

describe('moving an old save to the new roster', () => {
  it('moves each returning Sister to her new slot with everything of hers', () => {
    const save = old({
      owned: { 'CC-W040': { level: 30, vow: 2, tokens: 1 }, 'CC-W013': { level: 12, vow: 0 } },
      lastParty: ['CC-W013', 'CC-W040'],
      bonds: { 'CC-W040': { xp: 50, heard: 1 } },
      hosanna: { byParty: { 'CC-W013+CC-W040': 'CC-W040' }, last: 'CC-W040' },
    } as Partial<SaveData>);
    const s = migrateRoster(save);
    expect(s.roster).toBe(3);
    expect(s.owned['IV-UR1']).toEqual({ level: 30, vow: 2, tokens: 1 });
    // Tarchna (SW-R-WAR) was retired in the 200: an old save goes on to her successor
    expect(RETIRED['SW-R-WAR']).toBe('SW-R-VEI');
    expect(s.owned['SW-R-VEI']).toEqual({ level: 12, vow: 0 });
    expect(s.owned['CC-W040']).toBeUndefined();
    expect(s.lastParty).toEqual(['SW-R-VEI', 'IV-UR1']);
    expect(s.bonds!['IV-UR1']).toEqual({ xp: 50, heard: 1 });
    // party keys stay sorted under the new ids
    expect(Object.keys(s.hosanna!.byParty!)).toEqual(['IV-UR1+SW-R-VEI']);
    // a second pass changes nothing
    expect(migrateRoster(s)).toBe(s);
  });

  it('gives Gurges in place of Junia, or Junia\'s copies as Gurges\'s Vow tokens', () => {
    const lone = migrateRoster(old({ owned: { 'CC-W007': { level: 20, vow: 1 } }, lastParty: ['CC-W007'] }));
    // ...and Gurges's slot went on to Refluxa in the 200
    expect(lone.owned['DL-SSR-VEI']).toEqual({ level: 20, vow: 1 });
    expect(lone.lastParty).toEqual(['DL-SSR-VEI']);
    const both = migrateRoster(old({ owned: { 'CC-W007': { level: 20, vow: 1, tokens: 1 }, 'CC-W220': { level: 40, vow: 3 } }, lastParty: ['CC-W007', 'CC-W220'] }));
    expect(both.owned['DL-SSR-VEI']).toEqual({ level: 40, vow: 3, tokens: 3 });
    expect(both.lastParty).toEqual(['DL-SSR-VEI']);
    expect(Object.keys(both.owned)).toEqual(['DL-SSR-VEI']);
  });

  it('moves imported saves and unfinished crypt runs too', () => {
    const json = JSON.stringify(old({ owned: { 'CC-W090': { level: 5, vow: 0 } } }));
    expect(importSave(json)!.owned['TC-UR1']).toEqual({ level: 5, vow: 0 });
    expect(moveIds('{"party":["CC-W180","CC-W001"]}')).toBe('{"party":["VT-SSR-VEI","IV-R-EXE"]}');
  });

  it('leaves a new save alone', () => {
    const s = newSave();
    expect(migrateRoster(s)).toBe(s);
  });
});

describe('moving a 500-Sister save to the 200', () => {
  const v2 = (extra: Partial<SaveData> = {}) => ({ ...newSave(), roster: 2, ...extra }) as SaveData;

  it('turns a retired Sister into her successor, with everything of hers', () => {
    const s = migrateRoster(
      v2({
        owned: { 'SW-R-WAR': { level: 22, exp: 40, vow: 2, tokens: 1, tier: 1, skills: [2, 1, 1, 3], symbol: 4 } },
        lastParty: ['SW-R-WAR', 'IV-R-EXE'],
        gear: [{ id: 'g1', slot: 'blade', on: 'SW-R-WAR' }] as unknown as SaveData['gear'],
        bonds: { 'SW-R-WAR': { xp: 120, heard: 2 } },
      } as Partial<SaveData>),
    );
    expect(s.roster).toBe(3);
    expect(s.owned['SW-R-WAR']).toBeUndefined();
    expect(s.owned['SW-R-VEI']).toEqual({ level: 22, exp: 40, vow: 2, tokens: 1, tier: 1, skills: [2, 1, 1, 3], symbol: 4 });
    expect(s.lastParty).toEqual(['SW-R-VEI', 'IV-R-EXE']);
    expect((s.gear as unknown as { on?: string }[])[0].on).toBe('SW-R-VEI');
    expect(s.bonds!['SW-R-VEI']).toEqual({ xp: 120, heard: 2 });
    expect(migrateRoster(s)).toBe(s);
  });

  it('keeps the further-along record when both were sworn; the other gives copies, Unctions and her gear back', () => {
    const s = migrateRoster(
      v2({
        owned: { 'SW-R-WAR': { level: 30, vow: 3, tokens: 1 }, 'SW-R-VEI': { level: 10, exp: 0, vow: 1 } },
        items: { unction1: 2 },
        lastParty: ['SW-R-WAR', 'SW-R-VEI', 'IV-R-EXE'],
        gear: [
          { id: 'a', slot: 'blade', on: 'SW-R-WAR' },
          { id: 'b', slot: 'blade', on: 'SW-R-VEI' },
        ] as unknown as SaveData['gear'],
      } as Partial<SaveData>),
    );
    // Tarchna was further along: her record stays, under Velcha's id
    expect(s.owned['SW-R-VEI'].level).toBe(30);
    expect(s.owned['SW-R-VEI'].vow).toBe(3);
    expect(s.owned['SW-R-VEI'].tokens).toBe(1 + copiesHeld({ level: 10, vow: 1 }));
    expect(copiesHeld({ level: 10, vow: 1 })).toBe(2);
    expect(Object.keys(s.owned)).toEqual(['SW-R-VEI']);
    // Velcha's own blade comes off; Tarchna's stays on, now under Velcha's id
    const gear = s.gear as unknown as { id: string; on?: string }[];
    expect(gear.find((g) => g.id === 'a')!.on).toBe('SW-R-VEI');
    expect(gear.find((g) => g.id === 'b')!.on).toBeUndefined();
    // level 10's EXP comes back as Unctions
    expect((s.items!.unction1 ?? 0) + 25 * (s.items!.unction3 ?? 0)).toBeGreaterThan(2);
    expect(s.lastParty).toEqual(['SW-R-VEI', 'IV-R-EXE']);
  });

  it('folds two retired Sisters into one successor', () => {
    const [a, b] = Object.entries(RETIRED).filter(([, k]) => k === 'SW-R-VEI').map(([c]) => c);
    expect([a, b].sort()).toEqual(['SW-R-EXE', 'SW-R-WAR']);
    const s = migrateRoster(v2({ owned: { [a]: { level: 5, vow: 0 }, [b]: { level: 8, vow: 0, tokens: 2 } } }));
    expect(Object.keys(s.owned)).toEqual(['SW-R-VEI']);
    expect(s.owned['SW-R-VEI'].level).toBe(8);
    expect(s.owned['SW-R-VEI'].tokens).toBe(3);
  });

  it('moves an unfinished crypt run, without listing a Sister twice', () => {
    expect(moveIds('{"party":["SW-R-WAR","IV-R-EXE"]}')).toBe('{"party":["SW-R-VEI","IV-R-EXE"]}');
  });

  it('carries a banner pick to the successor, and leaves pity alone', () => {
    const s = migrateRoster(v2({ pity: 37, banner: { order: 'Drowned Litany', target: 'DL-UR1', ssrs: ['DL-SSR-EXE', 'VT-SSR-VEI'] } } as Partial<SaveData>));
    expect(s.pity).toBe(37);
    expect(s.banner!.ssrs).toEqual(['DL-SSR-VEI', 'VT-SSR-VEI']);
  });
});

describe('Order renames', () => {
  it('moves old Order names in a save to the new ones, and leaves new saves alone', async () => {
    const { renameOrders } = await import('./orderRename');
    const old = JSON.stringify({ banner: { order: 'Hollow Bell', target: 'HB-UR1' }, shards: { 'Thorn Covenant': 40, 'Iron Vigil': 3 }, bonus: 'order:Red Pilgrimage:2' });
    const moved = JSON.parse(renameOrders(old));
    expect(moved.banner.order).toBe('Hallowed Belfry');
    expect(moved.shards).toEqual({ 'Verdant Martyrdom': 40, 'Iron Vigil': 3 });
    expect(moved.bonus).toBe('order:Crimson Inquisition:2');
    expect(renameOrders(renameOrders(old))).toBe(renameOrders(old));
  });
});
