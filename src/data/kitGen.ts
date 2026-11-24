/**
 * Kits for the new Sisters who do not have a hand-made one yet (data/kits.ts).
 *
 * Every Order fights with its keyword (Overwatch, Mercy, Guilt, ...), and the
 * hand-made kits already hold dozens of Order skills for each role. A new
 * Sister borrows from the skills of her own Order and role, her own class
 * first, under a name of her own:
 *
 * - R Conscript: two class staples, one Order skill, her class's Litany.
 * - SR Officer: two class staples, one Order skill, an Order Litany.
 * - SSR Commander: three Order skills, an Order Litany, an Order signature.
 * - UR Saintess: as SSR, plus her Order's Saint's Seal.
 *
 * Where an Order has no hand-made kit for a role yet, TEMPLATES fill in. When a
 * Sister's art arrives, her kit is designed by hand from it (as Paulina's was)
 * and replaces this one.
 */
import { CLASS_SKILLS, type SkillDef } from './skills';
import { CLASSES } from './classes';
import { KITS, type Kit, type Seal, type Sig } from './kits';
import type { CrusaderDef, PassiveDef, Rarity, Role } from './types';
import { OVERWATCH_HIT } from '../systems/keywords';

/** Words of each Order, for her skill names. */
const WORDS: Record<string, string[]> = {
  'Iron Vigil': ['Watch', 'Rampart', 'Sleepless', 'Iron', 'Lantern', 'Gate', 'Sentry', 'Bastion', 'Night', 'Parapet', 'Rivet', 'Vigil'],
  'Ashen Mercy': ['Ash', 'Ember', 'Pyre', 'Mercy', 'Cinder', 'Soot', 'Pale', 'Shroud', 'Ashen', 'Absolving', 'Kindling', 'Last-Rite'],
  'Veiled Tribunal': ['Veil', 'Verdict', 'Sealed', 'Masked', 'Gavel', 'Wax', 'Silent', 'Black', 'Judged', 'Tribunal', 'Faceless', 'Weighed'],
  'Sepulcher Watch': ['Bone', 'Ossuary', 'Grave', 'Crypt', 'Barrow', 'Tomb', 'Marrow', 'Skull', 'Funeral', 'Ivory', 'Charnel', 'Sepulchral'],
  'Candle Choir': ['Candle', 'Hymnal', 'Choir', 'Wick', 'Tallow', 'Psalm', 'Gilded', 'Vesper', 'Taper', 'Cantus', 'Matin', 'Chanted'],
  'Thorn Covenant': ['Thorn', 'Briar', 'Scourge', 'Rose', 'Bramble', 'Bleeding', 'Barbed', 'Scarred', 'Bloom', 'Penitent', 'Vine', 'Flayed'],
  'Drowned Litany': ['Tide', 'Drowned', 'Brine', 'Font', 'Deep', 'Undertow', 'Pearl', 'Flood', 'Sunken', 'Salt', 'Fathom', 'Coral'],
  'Glass Confession': ['Mirror', 'Glass', 'Shard', 'Pane', 'Lens', 'Prism', 'Silvered', 'Splinter', 'Reflected', 'Cracked', 'Obsidian', 'Leaded'],
  'Red Pilgrimage': ['Road', 'Pilgrim', 'Scallop', 'Dust', 'Wayfarer', 'Shrine', 'Barefoot', 'Mile', 'Crimson', 'Long-Road', 'Staff', 'Wander'],
  'Hollow Bell': ['Bell', 'Toll', 'Knell', 'Bronze', 'Clapper', 'Hollow', 'Peal', 'Midnight', 'Belfry', 'Chime', 'Tocsin', 'Hour'],
};

/** What each class calls its works. */
const NOUNS: Record<string, string[]> = {
  hierophant: ['Shrine', 'Reliquary', 'Bulwark', 'Aegis', 'Sanctum', 'Rampart'],
  sentinel: ['Stand', 'Riposte', 'Bastion', 'Oath', 'Guard', 'Ward'],
  martyr: ['Wound', 'Sacrifice', 'Offering', 'Stigma', 'Passion', 'Vow'],
  confessor: ['Remedy', 'Absolution', 'Penance', 'Tincture', 'Shrift', 'Cure'],
  hospitaller: ['Chalice', 'Draught', 'Mending', 'Balm', 'Communion', 'Grace'],
  abbess: ['Crozier', 'Pruning', 'Rod', 'Cloister', 'Rebuke', 'Rule'],
  oracle: ['Omen', 'Augury', 'Portent', 'Sign', 'Foresight', 'Reading'],
  cantor: ['Hymn', 'Chant', 'Anthem', 'Verse', 'Refrain', 'Descant'],
  adjudicator: ['Verdict', 'Ledger', 'Writ', 'Judgement', 'Decree', 'Scales'],
  warsister: ['Flail', 'Scourge', 'Lash', 'Onslaught', 'Fury', 'Charge'],
  inquisitor: ['Sentence', 'Beheading', 'Axe', 'Doom', 'Reckoning', 'Edict'],
  veilblade: ['Knife', 'Cut', 'Needle', 'Whisper', 'Stiletto', 'Kiss'],
  censer: ['Smoke', 'Thurible', 'Incense', 'Fumes', 'Censer', 'Coals'],
  arbalist: ['Bolt', 'Quarrel', 'Volley', 'Shot', 'Salvo', 'Arbalest'],
  exorcist: ['Witchfire', 'Lantern', 'Banishing', 'Exorcism', 'Lamp', 'Brand'],
};
const LITANY = ['Psalm', 'Canticle', 'Requiem', 'Vespers', 'Gloria', 'Dirge', 'Miserere', 'Benediction', 'Anathema', 'Credo', 'Litany', 'Compline'];

/** A steady 32-bit hash of a string. */
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const firstName = (n: string) => n.split(' ')[0];

const HYMN = 2;
type Own = Omit<SkillDef, 'id' | 'from'> & { from?: number[] };
interface Template {
  skills?: Own[];
  litany?: Own;
  passive?: PassiveDef;
  sig?: Sig;
}
const sigP = (name: string, desc: string): PassiveDef => ({ name, desc, kind: 'signature' });

/** Order skills for the roles no hand-made kit of that Order covers yet. */
const TEMPLATES: Record<string, Partial<Record<Role, Template>>> = {
  'Ashen Mercy': {
    'Ranged DPS': {
      litany: { name: 'Ashen Release', desc: 'LITANY: heavy damage on every enemy; any common foe left under 30% HP is granted Mercy at once.', target: 'allEnemies', mult: 1.2, mercyLine: 0.3, rite: true },
    },
  },
  'Iron Vigil': {
    Healer: {
      litany: { name: 'Watchfire Vigil', desc: 'LITANY: every ally heals 30% of max HP, and every Sister goes on Overwatch.', target: 'allAllies', healPct: 0.3, overwatchAll: OVERWATCH_HIT, rite: true },
      passive: sigP('Standing Order', 'Each Overwatch reaction also Weakens its foe (-15% attack, 2 turns). While she stands, every Sister takes 5% less damage.'),
      sig: { owWeaken: 0.15, guard: 0.05 },
    },
    'Melee DPS': {
      litany: { name: 'Sally Forth', desc: 'LITANY: strike every enemy, and every Sister goes on Overwatch.', target: 'allEnemies', mult: 1.0, overwatchAll: OVERWATCH_HIT, rite: true },
      passive: sigP('Sally Port', '+25% damage against foes under half HP. Every Sister whose Overwatch fires gains 8 Zeal.'),
      sig: { dmgUnderHalf: 0.25, owZeal: 8 },
    },
  },
  'Red Pilgrimage': {
    Healer: {
      passive: sigP('Road Balm', 'Heals for 15% of the damage she deals, +5% per Stride. Each Stride gives her +4% damage.'),
      sig: { strideLifesteal: { base: 0.15, per: 0.05 }, strideDmg: 0.04 },
    },
  },
  'Veiled Tribunal': {
    Buffer: {
      passive: sigP('Witness Stand', 'Each time she is struck, the attacker gains 1 Guilt. While she stands, foes that strike a Warded Sister gain Guilt too.'),
      sig: { guiltWhenStruck: 1, guiltOnWarded: true },
    },
    'Ranged DPS': {
      passive: sigP('Weight of Sin', '+5% damage per Guilt on her target, on top of Guilt\'s own. A foe she kills passes its Guilt to the next.'),
      sig: { guiltDmg: 0.05, passGuilt: true },
    },
  },
  'Candle Choir': {
    'Ranged DPS': {
      litany: { name: 'Choir of Wrath', desc: 'LITANY: heavy damage on every enemy; every Sister gains 8 Zeal.', target: 'allEnemies', mult: 1.1, zealGain: 8, zealAll: true, rite: true },
    },
    Healer: {
      skills: [
        { name: 'Hymn of Mending', desc: 'A Hymn for 3 rounds: every ally Regenerates 4% of max HP a turn. Cooldown 3.', target: 'self', hymn: { name: 'Hymn of Mending', rounds: 3, allies: { regen: { pct: 0.04, turns: HYMN } } }, cooldown: 3 },
        { name: 'Wax and Wound', desc: 'Heal an ally and cure her; heals 40% more while a Hymn plays.', target: 'ally', heal: 1.3, cleanse: true, cond: { if: 'hymn', then: { heal: 1.8 } } },
      ],
      litany: { name: 'Choir of the Wounded', desc: 'LITANY: heal and cure every ally for 30% of max HP; every Sister gains 10 Zeal.', target: 'allAllies', healPct: 0.3, cleanse: true, zealGain: 10, zealAll: true, rite: true },
    },
  },
  'Drowned Litany': {
    Healer: {
      passive: sigP('Font of Mercy', 'At the start of her turn every Sister heals 1.5% of max HP per Tide.'),
      sig: { tideHeal: 0.015 },
    },
    'Melee DPS': {
      litany: { name: 'Riptide', desc: 'LITANY: strike every enemy and heal 40% of the damage; the Tide rises by 2.', target: 'allEnemies', mult: 1.0, drain: 0.4, gain: { tide: 2 }, rite: true },
    },
    'Ranged DPS': {
      skills: [
        { name: 'Undertow Shot', desc: 'Strike any enemy; +8% per Tide.', target: 'enemy', mult: 1.15, byTide: { per: { multPct: 0.08 } } },
        { name: 'Rising Water', desc: 'Strike every enemy and Hex it (-15% Magic Resist) for 2 turns; the Tide rises by 1. Cooldown 2.', target: 'allEnemies', mult: 0.55, hex: { pct: 0.15, turns: 2 }, gain: { tide: 1 }, cooldown: 2 },
      ],
      litany: { name: 'Drowning Deluge', desc: 'LITANY: heavy damage on every enemy, +10% per Tide.', target: 'allEnemies', mult: 1.2, byTide: { per: { multPct: 0.1 } }, rite: true },
      passive: sigP('Undertow', 'Her hits deal double damage under 25% HP, plus 3% per Tide.'),
      sig: { executeTide: { base: 0.25, per: 0.03 } },
    },
  },
  'Glass Confession': {
    Tank: {
      skills: [
        { name: 'Mirror Guard', desc: 'Strike rank 1-2, Confess it for 2 turns and draw enemy attacks for 2 turns.', from: [1, 2], target: 'enemy', reach: [1, 2], mult: 0.8, taunt: 2, confess: 2 },
        { name: 'Pane of Warding', desc: 'Shield every ally for 18% of max HP. Cooldown 2.', target: 'allAllies', shieldPct: 0.18, cooldown: 2 },
      ],
      litany: { name: 'Hall of Mirrors', desc: 'LITANY: Ward every ally (-25% damage) for 2 turns; she draws every attack and counters.', target: 'allAllies', ward: { pct: 0.25, turns: 2 }, taunt: 2, counter: { mult: 0.8, turns: 2 }, rite: true },
      passive: sigP('Nothing Hidden', 'Every foe starts the fight Confessed for 2 turns.'),
      sig: { confessAll: 2 },
    },
  },
  'Hollow Bell': {
    Tank: {
      passive: sigP('Iron Clapper', 'Peal: she heals 15% of her max HP and every foe is Accused for a turn.'),
      sig: { peal: { healSelf: 0.15, accuseAll: 1 } },
    },
    Healer: {
      skills: [
        { name: 'Toll of Mending', desc: 'Every ally heals 12% of max HP, and the Bell rings. Cooldown 2.', target: 'allAllies', healPct: 0.12, gain: { toll: 1 }, cooldown: 2 },
        { name: 'Bronze Balm', desc: 'Heal an ally and cure her.', target: 'ally', heal: 1.4, cleanse: true },
      ],
      litany: { name: 'Vesper Knell', desc: 'LITANY: every ally heals 30% of max HP, and the Bell rings three times.', target: 'allAllies', healPct: 0.3, gain: { toll: 2 }, rite: true },
      passive: sigP('Sanctuary Bell', 'Peal: every Sister is shielded for 10% of max HP.'),
      sig: { peal: { shieldAll: 0.1 } },
    },
  },
  'Sepulcher Watch': {
    Buffer: {
      skills: [
        { name: 'Ossuary Omen', desc: 'An ally gains +25% attack for 2 turns and Haste; the party gains 1 Remains. Cooldown 2.', target: 'ally', empower: { pct: 0.25, turns: 2 }, empowerTarget: true, haste: 1, gain: { remains: 1 }, cooldown: 2 },
        { name: 'Count the Bones', desc: 'Every enemy is Weakened (-20% attack) for 2 turns. Cooldown 3.', target: 'allEnemies', mult: 0.4, weaken: { pct: 0.2, turns: 2 }, cooldown: 3 },
      ],
      litany: { name: 'Roll of the Dead', desc: 'LITANY: every ally +30% attack for 2 turns, every Sister 10 Zeal, and the party gains 2 Remains.', target: 'allAllies', empower: { pct: 0.3, turns: 2 }, empowerTarget: true, zealGain: 10, zealAll: true, gain: { remains: 2 }, rite: true },
      passive: sigP('Grave Tally', 'Each Remains the party gains gives her 6 Zeal.'),
      sig: { remainsZeal: 6 },
    },
  },
  'Thorn Covenant': {
    Buffer: {
      litany: { name: 'Psalm of the Lash', desc: 'LITANY: every ally loses 5% HP and gains +40% attack for 2 turns (Covenant Sisters Scar from it); every Sister gains 10 Zeal.', target: 'allAllies', hurtAllies: 0.05, empower: { pct: 0.4, turns: 2 }, empowerTarget: true, zealGain: 10, zealAll: true, rite: true },
    },
    'Melee DPS': {
      passive: sigP('Bone-Deep Lash', 'Heals for 12% of the damage she deals. Each Scar she holds lets her hits ignore 4% more Armor.'),
      sig: { lifesteal: 0.12, scarPierce: 0.04 },
    },
    Healer: {
      skills: [
        { name: 'Bloodletting Balm', desc: 'Sacrifice 5% HP; heal an ally and cure her.', target: 'ally', selfDmgPct: 0.05, heal: 1.45, cleanse: true },
        { name: 'Communion of Scars', desc: 'Spend all her Scars: every ally heals 2% of max HP per Scar. Cooldown 2.', target: 'allAllies', spend: { kw: 'scars', per: { healPct: 0.02 } }, cooldown: 2 },
      ],
      litany: { name: 'Rose of Wounds', desc: 'LITANY: every ally heals 30% of max HP and gains Thorns (25% back) for 2 turns.', target: 'allAllies', healPct: 0.3, thorns: { pct: 0.25, turns: 2 }, rite: true },
      passive: sigP('Hymn of the Lash', 'Each Scar any Covenant Sister gains gives the party 2 Zeal.'),
      sig: { scarZeal: 2 },
    },
  },
};

/**
 * A borrowed skill is re-cut to her rarity: a Conscript's copy of a Saintess's
 * skill hits softer, a Saintess's copy of an Officer's harder.
 */
const POWER: Record<Rarity, number> = { R: 0.8, SR: 0.9, SSR: 1.1, UR: 1.25 };
/** Fields scaled with her rarity. Shares (pct, healPct, ...) are shown in the text and change with it. */
const SCALE_MULT = new Set(['mult', 'heal']);
const SCALE_SHARE = new Set(['pct', 'healPct', 'shieldPct', 'drain', 'lifelink', 'revive']);
const count = (hay: string, needle: string) => hay.split(needle).length - 1;

/** A copy of the skill with its strength times f, its text kept true. */
export function scaleSkill(skill: SkillDef, f: number): SkillDef {
  if (Math.abs(f - 1) < 1e-6) return skill;
  let desc = skill.desc;
  const walk = (v: unknown, key: string): unknown => {
    if (typeof v === 'number') {
      if (SCALE_MULT.has(key)) {
        const nv = Math.round(v * f * 100) / 100;
        const tok = `${v}x`;
        if (count(desc, tok) === 1) desc = desc.replace(tok, `${nv}x`);
        else if (count(desc, tok) > 1) return v;
        return nv;
      }
      if (SCALE_SHARE.has(key) && v > 0 && v < 1) {
        const nv = Math.max(0.01, Math.round(v * f * 100) / 100);
        const tok = `${Math.round(v * 100)}%`;
        // only when the text names it exactly once, so the text stays true
        if (count(desc, tok) !== 1) return v;
        desc = desc.replace(tok, `${Math.round(nv * 100)}%`);
        return nv;
      }
      return v;
    }
    if (Array.isArray(v)) return v;
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === 'desc' || k === 'name' || k === 'id' ? x : walk(x, k)]));
    return v;
  };
  const out = walk(skill, '') as SkillDef;
  return { ...out, desc };
}

/** Where a new Commander or Saintess is built to shine, by role. */
const SHINES: Record<Role, string> = {
  Tank: 'Guarding the line in Hunts',
  Healer: 'Crypt runs',
  Buffer: 'Chapter Siege',
  'Melee DPS': 'Clearing adds and summons',
  'Ranged DPS': 'Hunts and boss Wrath races',
};

const STAPLES = new Set(Object.values(CLASS_SKILLS).flat());
const isOwn = (s: SkillDef) => !STAPLES.has(s);

interface Donor {
  c: CrusaderDef;
  kit: Kit;
}

/** Fills KITS for every Sister without a hand-made kit. */
export function genKits(all: CrusaderDef[]) {
  const donors: Donor[] = all.filter((c) => KITS[c.id]).map((c) => ({ c, kit: KITS[c.id] }));
  const roleOf = (c: CrusaderDef) => CLASSES[c.classId].role;
  for (const c of all) {
    if (KITS[c.id]) continue;
    KITS[c.id] = build(c, donors.filter((d) => d.c.order === c.order), roleOf);
  }
}

function build(c: CrusaderDef, sameOrder: Donor[], roleOf: (c: CrusaderDef) => Role): Kit {
  const role = roleOf(c);
  const h = hash(c.id);
  const ofRole = sameOrder.filter((d) => roleOf(d.c) === role);
  // her own class's donors first, then the rest of her role
  const ranked = [...ofRole.filter((d) => d.c.classId === c.classId), ...ofRole.filter((d) => d.c.classId !== c.classId)];
  const tpl = TEMPLATES[c.order]?.[role];
  const skillPool: SkillDef[] = [];
  const litanyPool: SkillDef[] = [];
  const classPool: SkillDef[] = [];
  /** Rarity of the kit each borrowed skill came from (templates are written at SSR strength). */
  const from = new Map<SkillDef, Rarity>();
  for (const d of ranked) {
    for (const s of d.kit.skills) {
      if (!isOwn(s)) continue;
      from.set(s, d.c.rarity);
      (s.rite ? litanyPool : skillPool).push(s);
      if (!s.rite && d.c.classId === c.classId) classPool.push(s);
    }
  }
  if (tpl) {
    skillPool.push(...(tpl.skills ?? []).map((s) => ({ from: [], ...s, id: 'tpl' }) as SkillDef));
    if (tpl.litany) litanyPool.push({ from: [], ...tpl.litany, id: 'tpl' } as SkillDef);
  }

  // names of her own: an Order word and a class noun, never twice in one kit
  const words = WORDS[c.order] ?? ['Holy'];
  const nouns = NOUNS[c.classId] ?? ['Rite'];
  const used = new Set<string>();
  const name = (n: number, litany: boolean) => {
    for (let k = 0; k < 24; k++) {
      const w = words[(h + n * 5 + k * 7) % words.length];
      const noun = litany ? LITANY[(h + n + k * 3) % LITANY.length] : nouns[(h + n * 3 + k) % nouns.length];
      const out = `${w} ${noun}`;
      if (!used.has(out)) {
        used.add(out);
        return out;
      }
    }
    return `${words[0]} ${nouns[0]} ${n}`;
  };
  const mine = (s: SkillDef, n: number): SkillDef => {
    const nm = name(n, !!s.rite);
    const scaled = scaleSkill(s, POWER[c.rarity] / POWER[from.get(s) ?? 'SSR']);
    return { ...scaled, id: `${slug(c.id)}-${slug(nm)}`, name: nm };
  };
  const pick = <T,>(pool: T[], n: number) => pool[(h + n * 11) % pool.length];

  const staples = CLASS_SKILLS[c.classId];
  const tier = c.rarity;
  let skills: [SkillDef, SkillDef, SkillDef, SkillDef];
  if (tier === 'R' || tier === 'SR') {
    // from her own class's skills when it has any, so a Conscript keeps her class's feel
    const own = skillPool.length ? mine(pick(classPool.length ? classPool : skillPool, 0), 0) : staples[2];
    const lit = tier === 'SR' && litanyPool.length ? mine(pick(litanyPool, 1), 3) : staples[3];
    skills = [staples[0], staples[1], own, lit];
  } else {
    // a class staple to build on, two Order skills (her class's first), and an Order Litany
    // damage dealers take Order skills that hit, when their Order has them
    const dps = role === 'Melee DPS' || role === 'Ranged DPS';
    const hits = (pool: SkillDef[]) => (dps && pool.some((x) => (x.mult ?? 0) >= 0.8) ? pool.filter((x) => (x.mult ?? 0) >= 0.8) : pool);
    const first = classPool.length ? pick(classPool, 0) : skillPool.length ? pick(skillPool, 0) : undefined;
    const rest = hits(skillPool.filter((x) => x.name !== first?.name));
    // the class staple she keeps is its hardest-hitting one
    const keep = [staples[0], staples[1], staples[2]].reduce((a, b) => ((b.mult ?? 0) > (a.mult ?? 0) ? b : a));
    const second = rest.length ? rest[(h >> 4) % rest.length] : undefined;
    const three = [keep, first ? mine(first, 1) : staples[keep === staples[1] ? 0 : 1], second ? mine(second, 2) : staples[keep === staples[2] ? 0 : 2]];
    const lit = litanyPool.length ? mine(pick(litanyPool, 1), 3) : staples[3];
    skills = [three[0], three[1], three[2], lit];
  }

  const kit: Kit = { skills, generated: true };
  if (tier === 'SSR' || tier === 'UR') {
    // her Order's signature for her role (her class's first), else her class's strong passive
    const hasSig = (d: Donor) => !!d.kit.sig && d.kit.passive?.kind === 'signature';
    const sigDonor = ranked.find(hasSig);
    const anyDonor = sameOrder.find(hasSig);
    if (sigDonor) {
      kit.sig = sigDonor.kit.sig;
      kit.passive = renamed(sigDonor.kit.passive!, sigDonor.c, c);
    } else if (tpl?.sig && tpl.passive) {
      kit.sig = tpl.sig;
      kit.passive = tpl.passive;
    } else if (anyDonor) {
      kit.sig = anyDonor.kit.sig;
      kit.passive = renamed(anyDonor.kit.passive!, anyDonor.c, c);
    }
    kit.shines = [SHINES[role], `${c.order} Order Tower`];
  }
  if (tier === 'UR') {
    const sealDonor = [...ranked, ...sameOrder].find((d) => d.kit.seal);
    if (sealDonor) kit.seal = renamedSeal(sealDonor.kit.seal!, sealDonor.c, c);
  }
  return kit;
}

/** A borrowed passive or seal that names its first owner names its new one. */
const swapName = (s: string, from: CrusaderDef, to: CrusaderDef) => s.split(firstName(from.name)).join(firstName(to.name));
const renamed = (p: PassiveDef, from: CrusaderDef, to: CrusaderDef): PassiveDef => ({ ...p, desc: swapName(p.desc, from, to) });
const renamedSeal = (s: Seal, from: CrusaderDef, to: CrusaderDef): Seal => ({ ...s, desc: swapName(s.desc, from, to) });
