import { describe, expect, it } from 'vitest';
import { newSave } from '../state/save';
import { seeded } from './rng';
import { ANCIENT_IP } from '../data/loot';
import { DUE_MAX, abyssIp, abyssOf, abyssScale, finishDescent, maxTier, piecesFor, rollDescent, sigilBlock, sigilCost, tierDef } from './abyss';
import type { Battle } from './combat';
import { autoBattle } from './autoplay';
import { CRUSADERS } from '../data/crusaders';
import { abyssBattle } from './abyss';

const won = { outcome: () => 'victory' } as unknown as Battle;
const lost = { outcome: () => 'defeat' } as unknown as Battle;

describe('the Abyssal Crypt', () => {
  it('grows without end, and reaches Ancient Item Power near tier 50', () => {
    expect(abyssScale(2) / abyssScale(1)).toBeCloseTo(1.09);
    expect(abyssScale(200)).toBeGreaterThan(abyssScale(199));
    expect(abyssIp(1)).toBeLessThan(200);
    expect(abyssIp(49)).toBeLessThan(ANCIENT_IP);
    expect(abyssIp(50)).toBeGreaterThanOrEqual(ANCIENT_IP);
    expect(abyssIp(500)).toBe(800);
    expect(tierDef(10).boss).toBe(true);
    expect(tierDef(70).encounter).toBe(tierDef(10).encounter);
    expect(piecesFor(1)).toBe(2);
    expect(piecesFor(100)).toBe(4);
  });

  it('opens one tier past the best, and a loss costs nothing', () => {
    const save = newSave();
    expect(maxTier(save)).toBe(1);
    const tithes = save.tithes;
    const r = finishDescent(save, 1, [], lost, seeded(1));
    expect(r.won).toBe(false);
    expect(save.tithes).toBe(tithes);
    expect(maxTier(save)).toBe(1);
    finishDescent(save, 1, [], won, seeded(1));
    expect(maxTier(save)).toBe(2);
    expect(abyssOf(save).runs).toBe(1);
  });

  it('pays gear, iron and Fragments only: never Seals or Gilt', () => {
    const save = newSave();
    const seals = save.seals;
    const gilt = save.gilt;
    const r = finishDescent(save, 40, [], won, seeded(3));
    expect(r.dropped.length).toBe(piecesFor(40));
    expect(r.items.iron1).toBeGreaterThan(0);
    expect(r.items.armory1).toBeGreaterThan(0);
    // Fragments come with a tier's first clear only.
    expect(finishDescent(save, 40, [], won, seeded(4)).items.armory1).toBeUndefined();
    expect(save.seals).toBe(seals);
    expect(save.gilt).toBe(gilt);
  });

  it('the Sigil aims the first piece, and the Penitent\'s Due pays an Anathema piece', () => {
    const save = newSave();
    const rng = seeded(7);
    for (let i = 0; i < 30; i++) {
      const { pieces } = rollDescent(save, 5, [], rng, { slot: 'veil' });
      expect(pieces[0].slot).toBe('veil');
    }
    const { pieces } = rollDescent(save, 5, [], rng, { edict: 'censer' });
    const st = abyssOf(save);
    // Dry descents fill the Due; when full, the next is sure.
    st.due = DUE_MAX - 1;
    const r = rollDescent(save, 1, [], () => 0.99, { edict: 'censer' });
    expect(pieces.length).toBe(2);
    expect(r.duePaid).toBe(true);
    expect(r.pieces[0].grade).toBe('anathema');
    expect(r.pieces[0].edict?.id).toBe('censer');
    expect(st.due).toBe(0);
  });

  it('a Sigil costs Tithes, and refuses an Edict its slot cannot hold', () => {
    const save = newSave();
    expect(sigilCost(10, undefined)).toBe(0);
    expect(sigilCost(10, { slot: 'blade' })).toBeLessThan(sigilCost(10, { slot: 'blade', edict: 'censer' }));
    save.tithes = 0;
    expect(sigilBlock(save, 10, { slot: 'blade' })).toMatch(/Tithes/);
    // With no Tithes the Sigil sleeps: the descent still pays, unaimed.
    const r = finishDescent(save, 1, [], won, seeded(2));
    expect(r.sigilPaid).toBe(0);
    expect(save.tithes).toBeGreaterThanOrEqual(0);
  });

  it('sweeps fast enough to farm: 100 descents roll in well under a second', () => {
    const save = newSave();
    const t = Date.now();
    let anathema = 0;
    for (let i = 0; i < 100; i++) anathema += finishDescent(save, 30, [], won, seeded(i)).dropped.filter((g) => g.grade === 'anathema').length;
    expect(Date.now() - t).toBeLessThan(1000);
    // The Due guarantees at least one in ten.
    expect(anathema).toBeGreaterThanOrEqual(10);
  });

  it('a real party wins tier 1 and is crushed deep down', () => {
    const save = newSave();
    const party = CRUSADERS.filter((c) => c.rarity === 'SR').slice(0, 4).map((c) => c.id);
    for (const id of party) save.owned[id] = { level: 20, vow: 0 };
    const b = abyssBattle(save, party, 1, seeded(4));
    autoBattle(b, 600);
    const r = finishDescent(save, 1, party, b, seeded(4));
    expect(r.won).toBe(true);
    expect(r.gear.length + (r.melted ? 1 : 0)).toBeGreaterThan(0);
    const deep = abyssBattle(save, party, 60, seeded(4));
    autoBattle(deep, 600);
    expect(deep.outcome()).not.toBe('victory');
  });
});
