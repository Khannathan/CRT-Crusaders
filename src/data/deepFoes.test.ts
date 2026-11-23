import { describe, expect, it } from 'vitest';
import { AFFINITY, ENCOUNTERS, ENEMIES } from './enemies';
import { DEEP_HOSTS } from './deepFoes';
import { CRYPTS } from '../systems/crusade';
import { floorDef } from '../systems/tower';

describe('the deeper crypts have their own hosts', () => {
  it('sixteen crypts, each with its own foes, elite and boss', () => {
    expect(DEEP_HOSTS.length).toBe(16);
    expect(DEEP_HOSTS.map((h) => h.crypt)).toEqual(CRYPTS.slice(2).map((c) => c.id));
    const ids = DEEP_HOSTS.flatMap((h) => [...h.foes.map((f) => f.id), h.boss.id]);
    expect(new Set(ids).size).toBe(80);
    for (const id of ids) {
      expect(ENEMIES[id]?.name).toBeTruthy();
      expect(AFFINITY[id]).toBeTruthy();
    }
  });

  it('every crypt fights its own boss and many of its own foes', () => {
    for (const c of CRYPTS.slice(2)) {
      const host = DEEP_HOSTS.find((h) => h.crypt === c.id)!;
      expect(ENCOUNTERS[c.boss][0]).toBe(host.boss.id);
      expect(c.bossName).toBe(host.boss.name);
      const all = [...c.early, ...c.late, ...c.elites].flatMap((e) => ENCOUNTERS[e]);
      const own = all.filter((id) => host.foes.some((f) => f.id === id));
      expect(own.length / all.length).toBeGreaterThan(0.3);
    }
  });

  it('every encounter and summon names a real foe, and the tower climbs through the crypts', () => {
    for (const list of Object.values(ENCOUNTERS)) for (const id of list) expect(ENEMIES[id], id).toBeTruthy();
    for (const e of Object.values(ENEMIES)) for (const s of [...e.skills, ...(e.phase2?.skills ?? [])]) if (s.summon) expect(ENEMIES[s.summon], s.summon).toBeTruthy();
    expect(floorDef(25).encounter.startsWith('weeping-cloister')).toBe(true);
    expect(floorDef(30).encounter).toBe('weeping-cloister-boss');
  });
});
