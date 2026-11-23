import type { SkillDef } from '../data/skills';
import { Battle, skillsFor, ZEAL_MAX, type Unit } from './combat';

type Choice = { skill: SkillDef; target?: Unit };

/**
 * The Auto button's player, also used by balance tests. It reads enemy intents
 * (breaks charges, shields the threatened), keeps the party alive, then picks
 * the attack worth the most, counting combos and finishing blows.
 */
export function autoChoose(b: Battle, actor: Unit, opts: { noRite?: boolean } = {}): Choice {
  const skills = skillsFor(actor).filter((s) => b.canUse(actor, s));
  const allies = b.alive('party');
  const foes = b.alive('enemy');
  const ratio = (u: Unit) => u.hp / u.maxHp;
  const hurt = [...allies].sort((a, c) => ratio(a) - ratio(c))[0];
  const find = (f: (s: SkillDef) => boolean) => skills.find((s) => !s.rite && f(s));

  // Incoming damage per ally, from the telegraphs.
  const incoming = new Map<Unit, number>();
  let groupThreat = false;
  for (const e of foes) {
    const v = b.intentOf(e);
    if (!v) continue;
    if (v.kind === 'buff' || v.kind === 'summon') continue;
    if (v.targets.length > 1) groupThreat = true;
    for (const t of v.targets) incoming.set(t, (incoming.get(t) ?? 0) + v.estimate);
  }

  // With noRite the player casts Litanies by hand (real-time fights).
  const rite = opts.noRite ? undefined : skills.find((s) => s.rite);
  if (rite && (actor.zeal ?? 0) >= ZEAL_MAX) {
    const heals = rite.healPct || rite.shieldPct || rite.revive;
    const fallen = b.units.some((u) => u.side === 'party' && u.hp <= 0);
    if (!heals || hurt.hp / hurt.maxHp < 0.6 || groupThreat || (rite.revive && fallen)) {
      const targets = b.validTargets(actor, rite);
      const best = [...targets].sort((x, y) => b.preview(actor, rite, y) - b.preview(actor, rite, x))[0];
      return { skill: rite, target: best };
    }
  }

  const charging = foes.find((e) => e.status.charging);
  const delay = find((s) => !!s.delay);
  if (charging && delay && b.validTargets(actor, delay).includes(charging)) return { skill: delay, target: charging };

  const groupGuard = find((s) => s.target === 'allAllies' && !!(s.shieldPct || s.cleanse));
  if (groupGuard && (groupThreat || allies.filter((u) => u.status.poison).length >= 2)) return { skill: groupGuard };

  const heal = find((s) => !!s.heal);
  if (heal && ratio(hurt) < 0.55) return { skill: heal, target: hurt };

  const shield = find((s) => s.target === 'ally' && !!s.shieldPct);
  if (shield) {
    const threatened = [...incoming.entries()].filter(([u]) => u.hp > 0 && !u.status.shield).sort((x, y) => y[1] / y[0].hp - x[1] / x[0].hp)[0];
    if (threatened && threatened[1] >= threatened[0].hp * 0.3) return { skill: shield, target: threatened[0] };
    if (ratio(hurt) < 0.5 && !hurt.status.shield) return { skill: shield, target: hurt };
  }

  // Score every remaining option.
  let best: Choice | undefined;
  let bestScore = 0;
  const consider = (skill: SkillDef, target: Unit | undefined, score: number) => {
    if (score > bestScore) {
      bestScore = score;
      best = { skill, target };
    }
  };
  const avgAtk = allies.reduce((n, u) => n + u.atk, 0) / Math.max(1, allies.length);
  const missing = (u: Unit) => u.maxHp - u.hp;
  // What a buff or a mend is worth on one ally, in the same units as damage.
  const support = (s: SkillDef, u: Unit) => {
    let v = 0;
    const threat = incoming.get(u) ?? 0;
    if (s.empower && (s.empowerTarget || u === actor) && !u.status.empower) v += u.atk * s.empower.pct * s.empower.turns;
    if (s.critUp && !u.status.critUp) v += u.atk * s.critUp.pct * 0.5 * s.critUp.turns;
    if (s.regen && !u.status.regen) v += Math.min(missing(u), u.maxHp * s.regen.pct * s.regen.turns) * 0.5;
    if (s.ward && !u.status.ward) v += (threat + avgAtk * 0.3) * s.ward.pct * s.ward.turns;
    if (s.thorns && !u.status.thorns) v += threat * s.thorns.pct;
    if (s.healPct) v += Math.min(missing(u), u.maxHp * s.healPct) * (ratio(u) < 0.75 ? 1 : 0.4);
    if (s.heal) v += Math.min(missing(u), actor.atk * s.heal) * (ratio(u) < 0.7 ? 1 : 0.3);
    if (s.shieldPct && !u.status.shield) v += Math.min(threat, u.maxHp * s.shieldPct) + u.maxHp * s.shieldPct * 0.2;
    if (s.haste && !u.status.haste) v += u.atk * 0.5;
    return v;
  };
  for (const s of skills) {
    if (s.rite || s.id === 'shift') continue;
    if (s.target === 'self') {
      if (s.zealGain && s.selfDmgPct && ratio(actor) > 0.6) consider(s, actor, actor.atk * 0.25 * 2 + s.zealGain * 0.6);
      else {
        let v = support(s, actor);
        // A taunt is worth the hurt it spares weaker Sisters.
        if (s.taunt && !actor.status.taunt && ratio(actor) > 0.5) v += [...incoming.entries()].filter(([u]) => u !== actor).reduce((n, [, d]) => n + d, 0) * 0.5 + avgAtk * 0.5;
        consider(s, actor, v);
      }
      continue;
    }
    if (s.target === 'ally') {
      if (s.empowerTarget) {
        const strongest = [...allies].sort((x, y) => y.atk - x.atk)[0];
        if (!strongest.status.empower) consider(s, strongest, strongest.atk * s.empower!.pct * 2 + (s.zealGain ?? 0) * 0.6);
      } else if (!s.shieldPct && !s.heal && (s.ward || s.thorns || s.regen)) {
        for (const u of allies) consider(s, u, support(s, u));
      }
      continue;
    }
    if (s.target === 'allAllies') {
      // Group shields and cures are timed by the threat check above.
      if (s.shieldPct || s.cleanse || (s.selfDmgPct && ratio(actor) < 0.5)) continue;
      const v = allies.reduce((n, u) => n + support(s, u), 0) + (s.zealGain ?? 0) * 0.6 * (s.zealAll ? allies.length : 1);
      consider(s, undefined, v);
      continue;
    }
    const targets = b.validTargets(actor, s);
    const group = s.target === 'allEnemies';
    let groupScore = 0;
    for (const t of targets) {
      let v = b.preview(actor, s, t);
      if (v >= t.hp) v += 20 + t.atk; // a kill removes a threat
      if (s.poison) v += Math.round(actor.atk * s.poison.mult * s.poison.turns * 0.7);
      if (s.accuse && !t.status.accused) v += avgAtk * 0.25 * 2;
      if (s.weaken && !t.status.weaken) v += t.atk * s.weaken.pct * 2;
      if (s.spreadPoison && t.status.poison) v += t.status.poison.dmg * t.status.poison.turns * (foes.length - 1) * 0.8;
      if (s.delay) v += t.status.charging ? 40 : 0;
      if (s.lifelink) v += Math.min(allies.reduce((n, u) => n + missing(u), 0), v * s.lifelink * allies.length) * 0.5;
      if (s.drain) v += Math.min(missing(actor), v * s.drain) * 0.5;
      if (s.purge && (t.status.shield || t.status.empower || t.status.ward || t.status.regen)) v += (t.status.shield ?? 0) + t.atk * 0.5;
      if (s.wrathDrain && t.wrath !== undefined) v += Math.min(t.wrath, s.wrathDrain) * 0.8;
      if (t.boss) v *= 1.1;
      // Healers and shielders are worth focusing.
      if (skillsFor(t).some((x) => x.target === 'ally')) v *= 1.25;
      if (group) groupScore += v;
      else consider(s, t, v);
    }
    if (group) consider(s, undefined, groupScore);
  }
  if (best) return best;
  const other = skills.find((s) => s.id !== 'shift' && !s.rite) ?? skills[0];
  return { skill: other, target: b.validTargets(actor, other)[0] };
}

/** How many real (non-Rite, non-Step) skills these Sisters could use where they stand. */
function usableCount(b: Battle, units: Unit[]) {
  return units.reduce((n, u) => n + skillsFor(u).filter((s) => s.id !== 'shift' && !s.rite && b.canUse(u, s)).length, 0);
}

/**
 * Auto's free Step: trade places with a neighbour when that leaves the pair with
 * more usable skills (a Sister knocked out of her ranks walks back).
 */
export function autoStep(b: Battle, actor: Unit): Unit | undefined {
  let best: Unit | undefined;
  let bestGain = 0;
  for (const o of b.stepTargets(actor)) {
    const before = usableCount(b, [actor, o]);
    [actor.rank, o.rank] = [o.rank, actor.rank];
    const after = usableCount(b, [actor, o]);
    [actor.rank, o.rank] = [o.rank, actor.rank];
    // Never strand the actor herself.
    const mine = usableCount(b, [actor]);
    [actor.rank, o.rank] = [o.rank, actor.rank];
    const mineAfter = usableCount(b, [actor]);
    [actor.rank, o.rank] = [o.rank, actor.rank];
    if (mineAfter === 0 && mine > 0) continue;
    const gain = after - before + (mine === 0 && mineAfter > 0 ? 2 : 0);
    if (gain > bestGain) {
      bestGain = gain;
      best = o;
    }
  }
  return best;
}

/** Runs a battle to the end with autoChoose for the party. */
export function autoBattle(b: Battle, maxTurns = 400, onRite?: (round: number) => void): 'victory' | 'defeat' | 'stalled' {
  for (let i = 0; i < maxTurns; i++) {
    const t = b.nextTurn();
    if (t.outcome) return t.outcome;
    const actor = t.actor!;
    if (actor.side === 'party') {
      const with_ = autoStep(b, actor);
      if (with_) b.step(actor, with_);
    }
    const choice = actor.side === 'party' ? autoChoose(b, actor) : b.enemyChoose(actor);
    if (choice.skill.rite) onRite?.(b.round);
    b.act(actor, choice.skill, choice.target);
  }
  return 'stalled';
}
