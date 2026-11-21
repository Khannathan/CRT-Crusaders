import type { SkillDef } from '../data/skills';
import { Battle, skillsFor, ZEAL_MAX, type Unit } from './combat';

/**
 * A plain-minded player used by balance tests: heal or shield the hurt, use the
 * Rite when ready, otherwise the strongest usable attack on the weakest foe.
 */
export function autoChoose(b: Battle, actor: Unit): { skill: SkillDef; target?: Unit } {
  const skills = skillsFor(actor).filter((s) => b.canUse(actor, s));
  const allies = b.alive('party');
  const hurt = [...allies].sort((a, c) => a.hp / a.maxHp - c.hp / c.maxHp)[0];
  const rite = skills.find((s) => s.rite);
  if (rite && b.zeal >= ZEAL_MAX) return { skill: rite, target: b.validTargets(actor, rite)[0] };
  const heal = skills.find((s) => s.heal || s.shieldPct);
  if (heal && hurt.hp / hurt.maxHp < 0.6) return { skill: heal, target: heal.target === 'ally' ? hurt : actor };
  const attacks = skills.filter((s) => s.mult && !s.rite).sort((a, c) => (c.mult ?? 0) - (a.mult ?? 0));
  if (attacks.length) {
    const s = attacks[0];
    const t = [...b.validTargets(actor, s)].sort((a, c) => a.hp - c.hp)[0];
    return { skill: s, target: t };
  }
  const other = skills.find((s) => s.id !== 'shift') ?? skills[0];
  return { skill: other, target: b.validTargets(actor, other)[0] };
}

/** Runs a battle to the end with autoChoose for the party. */
export function autoBattle(b: Battle, maxTurns = 400): 'victory' | 'defeat' | 'stalled' {
  for (let i = 0; i < maxTurns; i++) {
    const t = b.nextTurn();
    if (t.outcome) return t.outcome;
    const actor = t.actor!;
    const choice = actor.side === 'party' ? autoChoose(b, actor) : b.enemyChoose(actor);
    b.act(actor, choice.skill, choice.target);
  }
  return 'stalled';
}
