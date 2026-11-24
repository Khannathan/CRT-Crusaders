import { describe, expect, it } from 'vitest';
import { CRUSADERS } from '../data/crusaders';
import { KITS } from '../data/kits';
import { LIMITED_BANNERS, LIMITED_DAYS, limitedWindow } from '../systems/limited';
import { importSave, newSave, type SaveData } from './save';
import { migrateRoster, moveIds } from './rosterMigration';

const old = (extra: Partial<SaveData> = {}) => ({ ...newSave(), roster: undefined, ...extra }) as SaveData;

describe('the 500-Sister roster', () => {
  it('has 500 Sisters in 10 Orders, every slot from the bible', () => {
    expect(CRUSADERS).toHaveLength(500);
    expect(new Set(CRUSADERS.map((c) => c.id)).size).toBe(500);
    expect(CRUSADERS.filter((c) => c.legacy)).toHaveLength(89);
    expect(CRUSADERS.find((c) => c.id === 'IV-LUR')!.name).toBe('Paulina Macra');
    for (const c of CRUSADERS) expect(KITS[c.id], c.id).toBeDefined();
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
    expect(s.roster).toBe(2);
    expect(s.owned['IV-UR1']).toEqual({ level: 30, vow: 2, tokens: 1 });
    expect(s.owned['SW-R-WAR']).toEqual({ level: 12, vow: 0 });
    expect(s.owned['CC-W040']).toBeUndefined();
    expect(s.lastParty).toEqual(['SW-R-WAR', 'IV-UR1']);
    expect(s.bonds!['IV-UR1']).toEqual({ xp: 50, heard: 1 });
    // party keys stay sorted under the new ids
    expect(Object.keys(s.hosanna!.byParty!)).toEqual(['IV-UR1+SW-R-WAR']);
    // a second pass changes nothing
    expect(migrateRoster(s)).toBe(s);
  });

  it('gives Severa in place of Junia, or Junia\'s copies as Severa\'s Vow tokens', () => {
    const lone = migrateRoster(old({ owned: { 'CC-W007': { level: 20, vow: 1 } }, lastParty: ['CC-W007'] }));
    expect(lone.owned['DL-SSR-EXE']).toEqual({ level: 20, vow: 1 });
    expect(lone.lastParty).toEqual(['DL-SSR-EXE']);
    const both = migrateRoster(old({ owned: { 'CC-W007': { level: 20, vow: 1, tokens: 1 }, 'CC-W220': { level: 40, vow: 3 } }, lastParty: ['CC-W007', 'CC-W220'] }));
    expect(both.owned['DL-SSR-EXE']).toEqual({ level: 40, vow: 3, tokens: 3 });
    expect(both.lastParty).toEqual(['DL-SSR-EXE']);
    expect(Object.keys(both.owned)).toEqual(['DL-SSR-EXE']);
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
