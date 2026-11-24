/**
 * The Kit Forge (Epic Fanatical Zealot Waifu Initiative): makes every Sister's
 * kit her own.
 *
 * Hand-made kits (data/kits.ts) keep their skills. Every other kit starts as
 * the Order-borrowed kit from data/kitGen.ts, then the Forge cuts it to her:
 *
 * - twists: her own skills (and, from SSR, her Litany) each take one effect
 *   from the effect library, her Order's favourites first. R 1, SR 2, SSR 3,
 *   UR 4 twists, stronger with rarity. SSR and UR Litanies also lay holy ground.
 * - passive: every Sister, R to UR, carries a passive of her own: her Order or
 *   class base plus one personal rule.
 * - Relic: her special equipment (her Holy Symbol), woken at +5, rewrites one
 *   of her skills with one more effect and a harder hit.
 * - Patron Miracle: every Limited UR lifts every Sister of her Order.
 * - cry, look, ascended (SSR) and command (R) lines for the Sister page and the
 *   art briefs.
 *
 * No two Sisters end up with the same kit (systems/kitForge.test.ts).
 */
import type { CrusaderDef, PassiveDef, Rarity } from './types';
import type { GroundKind, SkillDef } from './skills';
import { CLASS_SKILLS } from './skills';
import { KITS, type Kit, type Relic, type Sig } from './kits';
import { CLASSES } from './classes';
import { FIELD_SHINES } from './shines';

/** Power step of a Sister: R 0, SR 1, SSR 2, UR 3, Limited UR 4. */
export const tierOf = (c: Pick<CrusaderDef, 'rarity' | 'limited'>) => ({ R: 0, SR: 1, SSR: 2, UR: 3 } as Record<Rarity, number>)[c.rarity] + (c.rarity === 'UR' && c.limited ? 1 : 0);

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const pct = (v: number) => `${Math.round(v * 100)}%`;
const hits = (s: SkillDef) => (s.mult ?? 0) > 0;
const atFoe = (s: SkillDef) => s.target === 'enemy' || s.target === 'allEnemies';
const atFriend = (s: SkillDef) => s.target === 'ally' || s.target === 'allAllies' || s.target === 'self';

// ---------------------------------------------------------------- twists

interface Twist {
  key: string;
  /** Whether it suits this skill (and is not on it already). */
  fits: (s: SkillDef) => boolean;
  /** The fields it adds at power step v (0-4). */
  patch: (v: number, s: SkillDef) => Partial<SkillDef>;
  /** Its words, in the game's voice. */
  text: (v: number, s: SkillDef) => string;
}

const step = <T,>(a: T[], v: number) => a[Math.min(v, a.length - 1)];
const who = (s: SkillDef) => (s.target === 'allEnemies' ? 'every foe it strikes' : 'the foe');
const them = (s: SkillDef) => (s.target === 'allAllies' ? 'every Sister' : s.target === 'self' ? 'she' : 'her ally');

export const TWISTS: Record<string, Twist> = {
  brand: {
    key: 'brand',
    fits: (s) => atFoe(s) && hits(s) && !s.brand,
    patch: (v) => ({ brand: step([0.2, 0.25, 0.3, 0.35, 0.4], v) }),
    text: (v, s) => `Brands ${who(s)}: the next blow on it lands ${pct(step([0.2, 0.25, 0.3, 0.35, 0.4], v))} harder.`,
  },
  penance: {
    key: 'penance',
    fits: (s) => atFoe(s) && !s.penance,
    patch: (v) => ({ penance: { pct: step([0.15, 0.2, 0.25, 0.3, 0.35], v), turns: 2 } }),
    text: (v, s) => `Lays Penance on ${who(s)} for 2 turns: each act costs the sinner ${pct(step([0.15, 0.2, 0.25, 0.3, 0.35], v))} of its own attack.`,
  },
  silence: {
    key: 'silence',
    fits: (s) => s.target === 'enemy' && !s.silence && !s.rite,
    patch: (v) => ({ silence: v >= 3 ? 2 : 1 }),
    text: (v) => `Silences it for ${v >= 3 ? '2 turns' : 'a turn'}: only its plainest skill, and any charge breaks.`,
  },
  stigmata: {
    key: 'stigmata',
    fits: (s) => s.target === 'enemy' && hits(s) && !s.stigmata && !s.bleed,
    patch: (v) => ({ stigmata: { mult: step([0.15, 0.2, 0.25, 0.3, 0.35], v), turns: 2 } }),
    text: (v) => `Opens Stigmata: it bleeds ${step([0.15, 0.2, 0.25, 0.3, 0.35], v)}x a turn for 2 turns, and every drop heals her for half.`,
  },
  fervor: {
    key: 'fervor',
    fits: (s) => !s.fervor && !s.rite && (hits(s) || s.target === 'self'),
    patch: (v) => ({ fervor: v >= 3 ? 2 : 1 }),
    text: (v) => `She gains ${v >= 3 ? 2 : 1} Fervor (+6% damage each, up to 5).`,
  },
  images: {
    key: 'images',
    fits: (s) => atFriend(s) && !s.images,
    patch: (v) => ({ images: v >= 3 ? 2 : 1 }),
    text: (v, s) => `${them(s) === 'she' ? 'She gains' : `${them(s)[0].toUpperCase()}${them(s).slice(1)} gains`} ${v >= 3 ? '2 Mirror Images' : 'a Mirror Image'} (each swallows a whole hit).`,
  },
  rapture: {
    key: 'rapture',
    fits: (s) => atFriend(s) && !!s.rite && !s.rapture,
    patch: () => ({ rapture: 1 }),
    text: (_v, s) => `Rapture: ${them(s)} takes no damage for a turn.`,
  },
  martyrdom: {
    key: 'martyrdom',
    fits: (s) => (s.target === 'self' || s.target === 'allAllies' || (s.target === 'enemy' && !!s.taunt)) && !s.martyrdom && !s.rite,
    patch: (v) => ({ martyrdom: { pct: step([0.2, 0.25, 0.3, 0.35, 0.4], v), turns: 2 } }),
    text: (v) => `Martyrdom: for 2 turns she takes ${pct(step([0.2, 0.25, 0.3, 0.35, 0.4], v))} of every blow aimed at her Sisters.`,
  },
  sunder: {
    key: 'sunder',
    fits: (s) => atFoe(s) && hits(s) && !s.sunder,
    patch: (v) => ({ sunder: { pct: step([0.1, 0.15, 0.2, 0.25, 0.3], v), turns: 2 } }),
    text: (v, s) => `Sunders ${who(s)} (-${pct(step([0.1, 0.15, 0.2, 0.25, 0.3], v))} armor) for 2 turns.`,
  },
  hex: {
    key: 'hex',
    fits: (s) => atFoe(s) && !s.hex,
    patch: (v) => ({ hex: { pct: step([0.1, 0.15, 0.2, 0.25, 0.3], v), turns: 2 } }),
    text: (v, s) => `Hexes ${who(s)} (-${pct(step([0.1, 0.15, 0.2, 0.25, 0.3], v))} Magic Resist) for 2 turns.`,
  },
  weaken: {
    key: 'weaken',
    fits: (s) => atFoe(s) && !s.weaken,
    patch: (v) => ({ weaken: { pct: step([0.1, 0.12, 0.15, 0.2, 0.25], v), turns: 2 } }),
    text: (v, s) => `Weakens ${who(s)} (-${pct(step([0.1, 0.12, 0.15, 0.2, 0.25], v))} attack) for 2 turns.`,
  },
  accuse: {
    key: 'accuse',
    fits: (s) => atFoe(s) && !s.accuse,
    patch: (v) => ({ accuse: v >= 2 ? 2 : 1 }),
    text: (v, s) => `Accuses ${who(s)} for ${v >= 2 ? '2 turns' : 'a turn'} (+25% damage taken).`,
  },
  critChance: {
    key: 'critChance',
    fits: (s) => atFoe(s) && hits(s) && !s.critChance,
    patch: (v) => ({ critChance: step([0.1, 0.12, 0.15, 0.2, 0.25], v) }),
    text: (v) => `+${pct(step([0.1, 0.12, 0.15, 0.2, 0.25], v))} critical chance on it.`,
  },
  armorPierce: {
    key: 'armorPierce',
    fits: (s) => atFoe(s) && hits(s) && !s.armorPierce,
    patch: (v) => ({ armorPierce: step([0.1, 0.15, 0.2, 0.25, 0.3], v) }),
    text: (v) => `Goes through ${pct(step([0.1, 0.15, 0.2, 0.25, 0.3], v))} of Armor and Magic Resist.`,
  },
  drain: {
    key: 'drain',
    fits: (s) => atFoe(s) && hits(s) && !s.drain && !s.lifelink,
    patch: (v) => ({ drain: step([0.1, 0.15, 0.2, 0.25, 0.3], v) }),
    text: (v) => `She heals ${pct(step([0.1, 0.15, 0.2, 0.25, 0.3], v))} of the damage dealt.`,
  },
  zealGain: {
    key: 'zealGain',
    fits: (s) => !s.zealGain && !s.rite,
    patch: (v) => ({ zealGain: step([4, 5, 6, 8, 10], v) }),
    text: (v) => `She gains ${step([4, 5, 6, 8, 10], v)} Zeal.`,
  },
  critUp: {
    key: 'critUp',
    fits: (s) => atFriend(s) && !s.critUp,
    patch: (v) => ({ critUp: { pct: step([0.08, 0.1, 0.12, 0.15, 0.2], v), turns: 2 } }),
    text: (v, s) => `${them(s) === 'she' ? 'She gains' : `${them(s)[0].toUpperCase()}${them(s).slice(1)} gains`} +${pct(step([0.08, 0.1, 0.12, 0.15, 0.2], v))} critical chance for 2 turns.`,
  },
  ward: {
    key: 'ward',
    fits: (s) => atFriend(s) && !s.ward,
    patch: (v) => ({ ward: { pct: step([0.1, 0.12, 0.15, 0.2, 0.25], v), turns: 2 } }),
    text: (v, s) => `Wards ${them(s) === 'she' ? 'her' : them(s)} (-${pct(step([0.1, 0.12, 0.15, 0.2, 0.25], v))} damage taken) for 2 turns.`,
  },
  regen: {
    key: 'regen',
    fits: (s) => (s.target === 'ally' || s.target === 'allAllies') && !s.regen,
    patch: (v) => ({ regen: { pct: step([0.03, 0.035, 0.04, 0.05, 0.06], v), turns: 2 } }),
    text: (v, s) => `${them(s)[0].toUpperCase()}${them(s).slice(1)} Regenerates ${pct(step([0.03, 0.035, 0.04, 0.05, 0.06], v))} of max HP a turn for 2 turns.`,
  },
  thorns: {
    key: 'thorns',
    fits: (s) => (s.target === 'self' || s.target === 'ally') && !s.thorns,
    patch: (v) => ({ thorns: { pct: step([0.15, 0.2, 0.25, 0.3, 0.35], v), turns: 2 } }),
    text: (v, s) => `${s.target === 'self' ? 'She is' : 'Her ally is'} Thorned (${pct(step([0.15, 0.2, 0.25, 0.3, 0.35], v))} of blows back) for 2 turns.`,
  },
};

/** Each Order's favourite twists, tried first. */
const ORDER_TWISTS: Record<string, string[]> = {
  'Iron Vigil': ['brand', 'martyrdom', 'ward', 'sunder', 'critChance'],
  'Ashen Mercy': ['stigmata', 'regen', 'drain', 'weaken', 'rapture'],
  'Veiled Tribunal': ['penance', 'silence', 'brand', 'accuse', 'hex'],
  'Sepulcher Watch': ['silence', 'weaken', 'martyrdom', 'sunder', 'zealGain'],
  'Candle Choir': ['fervor', 'zealGain', 'critUp', 'regen', 'rapture'],
  'Thorn Covenant': ['stigmata', 'fervor', 'thorns', 'drain', 'sunder'],
  'Drowned Litany': ['silence', 'hex', 'drain', 'weaken', 'ward'],
  'Glass Confession': ['images', 'brand', 'critChance', 'hex', 'penance'],
  'Red Pilgrimage': ['fervor', 'martyrdom', 'armorPierce', 'drain', 'critChance'],
  'Hollow Bell': ['silence', 'penance', 'accuse', 'zealGain', 'ward'],
};
const ALL_TWISTS = Object.keys(TWISTS);

/** The holy ground each Order lays with its Litanies. */
export const ORDER_GROUND: Record<string, GroundKind> = {
  'Iron Vigil': 'lantern',
  'Ashen Mercy': 'ash',
  'Veiled Tribunal': 'hallowed',
  'Sepulcher Watch': 'ash',
  'Candle Choir': 'hallowed',
  'Thorn Covenant': 'thorns',
  'Drowned Litany': 'flood',
  'Glass Confession': 'lantern',
  'Red Pilgrimage': 'thorns',
  'Hollow Bell': 'hallowed',
};
export const GROUND_TEXT: Record<GroundKind, string> = {
  hallowed: 'Hallowed Ground (every Sister Regenerates 4% a round)',
  ash: 'a Field of Ash (each fallen foe heals every Sister 6%)',
  flood: 'a Holy Flood (foes take 10% more and act last)',
  thorns: 'Briar Ground (every foe bleeds 15% of her attack a round)',
  lantern: 'a Lantern Line (each round the most hurt Sister goes on Overwatch)',
};

// ---------------------------------------------------------------- personal rules

interface Rule {
  key: keyof Sig;
  /** Lowest power step that may take it. */
  min?: number;
  fits?: (c: CrusaderDef, kit: Kit) => boolean;
  sig: (v: number, c: CrusaderDef) => Sig;
  text: (v: number, c: CrusaderDef) => string;
}
const RULES: Record<string, Rule> = {
  reflect: { key: 'reflect', sig: (v) => ({ reflect: step([0.06, 0.08, 0.12, 0.15, 0.18], v) }), text: (v) => `Reflection: ${pct(step([0.06, 0.08, 0.12, 0.15, 0.18], v))} of every blow she takes cuts its striker.` },
  brandOnCrit: { key: 'brandOnCrit', sig: (v) => ({ brandOnCrit: step([0.15, 0.2, 0.25, 0.3, 0.35], v) }), text: (v) => `Her crits Brand the foe: its next wound lands ${pct(step([0.15, 0.2, 0.25, 0.3, 0.35], v))} harder.` },
  penanceOnHit: { key: 'penanceOnHit', sig: (v) => ({ penanceOnHit: step([0.08, 0.1, 0.12, 0.15, 0.18], v) }), text: (v) => `Her blows lay Penance: for 2 turns each act costs the foe ${pct(step([0.08, 0.1, 0.12, 0.15, 0.18], v))} of its own attack.` },
  imagesStart: { key: 'imagesStart', sig: (v) => ({ imagesStart: v >= 3 ? 2 : 1 }), text: (v) => `She walks into every fight behind ${v >= 3 ? '2 Mirror Images' : 'a Mirror Image'}.` },
  fervorOnAct: { key: 'fervorOnAct', min: 2, sig: () => ({ fervorOnAct: 1 }), text: () => 'Each action stokes 1 Fervor (+6% damage, up to 5).' },
  groundStart: { key: 'groundStart', min: 1, sig: (v, c) => ({ groundStart: { kind: ORDER_GROUND[c.order] ?? 'hallowed', rounds: v >= 3 ? 3 : 2 } }), text: (v, c) => `The fight opens on ${GROUND_TEXT[ORDER_GROUND[c.order] ?? 'hallowed']} for ${v >= 3 ? 3 : 2} rounds.` },
  startZeal: { key: 'startZeal', sig: (v) => ({ startZeal: step([2, 3, 4, 5, 6], v) }), text: (v) => `Every Sister starts the fight with +${step([2, 3, 4, 5, 6], v)} Zeal.` },
  lifesteal: { key: 'lifesteal', sig: (v) => ({ lifesteal: step([0.04, 0.05, 0.07, 0.09, 0.1], v) }), text: (v) => `She heals ${pct(step([0.04, 0.05, 0.07, 0.09, 0.1], v))} of the damage she deals.` },
  dmgUnderHalf: { key: 'dmgUnderHalf', sig: (v) => ({ dmgUnderHalf: step([0.06, 0.08, 0.1, 0.12, 0.15], v) }), text: (v) => `+${pct(step([0.06, 0.08, 0.1, 0.12, 0.15], v))} damage on foes under half HP.` },
  guard: { key: 'guard', sig: (v) => ({ guard: step([0.02, 0.03, 0.04, 0.05, 0.06], v) }), text: (v) => `While she stands, every Sister takes ${pct(step([0.02, 0.03, 0.04, 0.05, 0.06], v))} less damage.` },
  dotMult: { key: 'dotMult', fits: (_c, k) => k.skills.some((s) => !!s.poison || !!s.bleed || !!s.stigmata), sig: (v) => ({ dotMult: step([0.08, 0.1, 0.15, 0.2, 0.25], v) }), text: (v) => `Her burns, poisons and bleeds run ${pct(step([0.08, 0.1, 0.15, 0.2, 0.25], v))} hotter.` },
  shatterDeath: {
    key: 'shatterDeath',
    min: 2,
    fits: (c) => c.order === 'Glass Confession',
    sig: (v) => ({ shatterDeath: { mult: step([0.5, 0.5, 0.6, 0.8, 1], v), reform: 0.3 } }),
    text: (v) => `Shatter: the first killing blow breaks her into shards instead. Every foe takes ${step([0.5, 0.5, 0.6, 0.8, 1], v)}x her attack and she reforms at 30% HP.`,
  },
};
const ORDER_RULES: Record<string, string[]> = {
  'Iron Vigil': ['guard', 'brandOnCrit', 'startZeal', 'groundStart'],
  'Ashen Mercy': ['lifesteal', 'groundStart', 'guard', 'dmgUnderHalf'],
  'Veiled Tribunal': ['penanceOnHit', 'brandOnCrit', 'dmgUnderHalf', 'startZeal'],
  'Sepulcher Watch': ['guard', 'startZeal', 'dmgUnderHalf', 'penanceOnHit'],
  'Candle Choir': ['startZeal', 'fervorOnAct', 'groundStart', 'dotMult'],
  'Thorn Covenant': ['lifesteal', 'fervorOnAct', 'reflect', 'dotMult'],
  'Drowned Litany': ['groundStart', 'lifesteal', 'dmgUnderHalf', 'reflect'],
  'Glass Confession': ['shatterDeath', 'reflect', 'imagesStart', 'brandOnCrit'],
  'Red Pilgrimage': ['fervorOnAct', 'dmgUnderHalf', 'lifesteal', 'brandOnCrit'],
  'Hollow Bell': ['penanceOnHit', 'startZeal', 'guard', 'groundStart'],
};
const ALL_RULES = Object.keys(RULES);

// ---------------------------------------------------------------- words

const PASSIVE_WORDS: Record<string, string[]> = {
  'Iron Vigil': ['Sleepless', 'Riveted', 'Lantern', 'Iron', 'Unblinking', 'Rampart', 'Watchfire', 'Gatekeeper\'s', 'Bastion', 'Sentry\'s'],
  'Ashen Mercy': ['Ashen', 'Pyre', 'Cinder', 'Merciful', 'Smoke-Lunged', 'Last', 'Shrouded', 'Ember', 'Soot', 'Absolving'],
  'Veiled Tribunal': ['Veiled', 'Nailed', 'Sealed', 'Weighed', 'Blindfold', 'Gavel', 'Silent', 'Damning', 'Sentenced', 'Writ-Bound'],
  'Sepulcher Watch': ['Ossuary', 'Bone-Sworn', 'Whispering', 'Grave', 'Marrow', 'Crypt', 'Charnel', 'Tomb', 'Barrow', 'Skull-Kept'],
  'Candle Choir': ['Wax-Scarred', 'Unbroken', 'Tallow', 'Burning', 'Gilded', 'Vesper', 'Choral', 'Candlelit', 'Wick', 'Molten'],
  'Thorn Covenant': ['Briar-Born', 'Bleeding', 'Scourged', 'Thorned', 'Flayed', 'Rose', 'Barbed', 'Bramble', 'Scarred', 'Penitent'],
  'Drowned Litany': ['Drowned', 'Barnacled', 'Brine', 'Undertow', 'Salt', 'Sunken', 'Tidal', 'Fathom', 'Pearl', 'Sea-Wet'],
  'Glass Confession': ['Mirror', 'Faceless', 'Leaded', 'Shard', 'Silvered', 'Cracked', 'Stained', 'Prism', 'Smoked-Glass', 'Pane'],
  'Red Pilgrimage': ['Barefoot', 'Bleeding-Foot', 'Long-Road', 'Scallop', 'Pilgrim', 'Crimson', 'Dust', 'Unresting', 'Wayfarer\'s', 'Shrine-Bound'],
  'Hollow Bell': ['Silent', 'Tolling', 'Bronze', 'Rope-Scarred', 'Hollow', 'Clapper', 'Knelling', 'Midnight', 'Belfry', 'Muted'],
};
const PASSIVE_NOUNS = ['Vow', 'Creed', 'Oath', 'Rule', 'Covenant', 'Canon', 'Tithe', 'Penance', 'Psalm', 'Seal', 'Zeal', 'Litany', 'Faith', 'Heresy-Bane'];

const CRY_OPEN: Record<string, string[]> = {
  'Iron Vigil': ['The wall stands while I stand!', 'I have not slept in nine years, and neither will you!', 'Lanterns lit, heretic, and you are seen!', 'No gate opens on my watch!', 'Iron in the flesh, iron in the faith!', 'The night is long, and I am longer!', 'Every rivet is a vow, and I keep them all!', 'Watch, Sisters, and strike what moves!'],
  'Ashen Mercy': ['Kneel, and I make it quick!', 'Ash to ash, and you first!', 'Mercy is a blade, and I am sharp!', 'Breathe the smoke of the faithful dead!', 'No one suffers long near me!', 'I burned a city to save it. I will burn you!', 'The pyre is lit, and it is hungry!', 'Hold still. This is the kind part!'],
  'Veiled Tribunal': ['Guilty, as charged and as born!', 'Your verdict is nailed to my armour!', 'I need no eyes to see your sin!', 'The court is in session, and there is no appeal!', 'Confess, or be confessed for!', 'The scales are already tipped, heretic!', 'I judged myself first. Now you!', 'Silence in my court!'],
  'Sepulcher Watch': ['The dead fight beside me!', 'Your bones will serve the Watch!', 'My Sisters\' skulls are watching you!', 'Rest is for the faithful. You get the crypt!', 'Every grave I keep is a soldier!', 'Death is no discharge from this war!', 'The tomb is open, and it calls your name!', 'Join the honoured dead, heretic!'],
  'Candle Choir': ['Sing, and the dark recoils!', 'My candle burns down, and I burn brighter!', 'The hymn has not stopped in three hundred years!', 'Hear the choir, and despair!', 'Wax and fire and fury!', 'Louder, Sisters! Louder!', 'Every verse is a blade!', 'I will sing over your ashes!'],
  'Thorn Covenant': ['Bleed, and be made holy!', 'Every scar is a prayer answered!', 'The briar grows from my wounds, and it hungers!', 'Pain is my psalm!', 'I count my sins in scars, and I have room for yours!', 'Cut me! I dare you!', 'My blood for the Covenant!', 'The thorns know your name!'],
  'Drowned Litany': ['The water remembers you!', 'I drowned, and I came back angrier!', 'Speak for the drowned, Sisters!', 'The tide rises, and you sink!', 'Salt in the wound, salt in the soul!', 'What the sea takes, it consecrates!', 'Breathe deep, heretic. It is the last!', 'The deep sends its regards!'],
  'Glass Confession': ['You said you were clean. The mirror says otherwise!', 'Look into me, and see your sin!', 'I hold every confession ever whispered!', 'Shatter me, and I cut you a thousand ways!', 'Nothing is hidden from the mirror!', 'Your face is the only one I wear!', 'Every crack in me is a sinner I broke!', 'The pane does not lie!'],
  'Red Pilgrimage': ['The road is red, and so are you!', 'I never stop walking!', 'Every step toward the shrine is paid in blood!', 'March, Sisters! The holy land waits!', 'My feet bleed, and my blade drinks!', 'Out of my road, heretic!', 'Ten thousand miles, and you are one more!', 'The pilgrim\'s road runs through you!'],
  'Hollow Bell': ['*the bell tolls once*', '*the bell tolls twice, then silence*', '*a cracked note, and then the hammer falls*', '*the hour rings, and it is yours*', '*a low knell that shakes the bone*', '*the bell rings midnight early*', '*three tolls, slow and sure*', '*the rope creaks, the bronze answers*'],
};
const CRY_CLOSE: Record<string, string[]> = {
  hierophant: ['Behind the relic, Sisters!', 'Break on my shield!', 'The saint in my shield has seen worse!', 'Not one step past me!', 'Hold the line!', 'My reliquary, your grave!'],
  sentinel: ['Strike me, and I strike back!', 'I am the door that does not open!', 'Come and try me!', 'Every blow you land, I return!', 'Hit harder!', 'The tomb is behind me!'],
  martyr: ['Take me first, and spare them!', 'I bleed so they need not!', 'Death will have to wait its turn!', 'My wounds are their shield!', 'Not yet!', 'I die tomorrow. Not today!'],
  confessor: ['Rise, Sister. You are not done!', 'Confess, and be mended!', 'The faithful do not fall here!', 'Your wounds are forgiven!', 'Up! The war is not over!', 'I will not lose another!'],
  hospitaller: ['No Sister dies on my watch!', 'Drink, and stand!', 'The grave gives them back to me!', 'Mend, and march!', 'Back to the line!', 'I have pulled Sisters from worse!'],
  abbess: ['Kneel to my rule!', 'Pain is the lesson!', 'The rod for you, the balm for them!', 'Discipline, Sisters!', 'My thorns mend as they cut!', 'Obey!'],
  oracle: ['I saw your death in the ashes!', 'It is written, and I wrote it!', 'Faster, Sisters, the omens wait!', 'Your doom is already read!', 'The smoke never lies!', 'I know how this ends!'],
  cantor: ['Sing with me!', 'Every verse, a killing blow!', 'Hear me, and fight harder!', 'The hymn rises!', 'For the choir!', 'Again, Sisters, louder!'],
  adjudicator: ['Weighed, and wanting!', 'Sentence pronounced!', 'Your strength is forfeit!', 'The ledger is closed!', 'Judgement is mine!', 'You are found guilty!'],
  warsister: ['Bleed with me!', 'Into them!', 'For every lash, a head!', 'I will not stop until I fall!', 'Fury is faith!', 'Charge!'],
  inquisitor: ['Name your sin, and lose your head!', 'The axe is merciful!', 'Heretic, I see you!', 'Accused, and executed!', 'Kneel for the blade!', 'One stroke!'],
  veilblade: ['You never saw me!', 'A whisper, then nothing!', 'Behind you!', 'Quiet now!', 'The veil parts!', 'One cut is enough!'],
  censer: ['Choke on holy smoke!', 'Breathe deep, heretic!', 'The thurible swings for you!', 'Burn in the incense!', 'Smoke and fire!', 'The coals are blessed!'],
  arbalist: ['One bolt, one heretic!', 'Down you go!', 'The quarrel is blessed!', 'I never miss twice!', 'Loose!', 'Mark, and fire!'],
  exorcist: ['Begone, foul thing!', 'The lantern sees you!', 'Witchfire for the witch!', 'Out of this world!', 'Burn, abomination!', 'The light takes you!'],
};

const ORDER_FX: Record<string, string> = {
  'Iron Vigil': 'amber lantern-light and iron sparks, square rivet sigils flashing on impact',
  'Ashen Mercy': 'grey ash-flame and falling soot, a wine-red glow as wounds close',
  'Veiled Tribunal': 'violet scale-marks, nailed parchment verdicts and wax seals bursting',
  'Sepulcher Watch': 'bone-white light, orbiting skull tokens and spectral funerary keys',
  'Candle Choir': 'candle-gold flame, dripping wax and floating hymn ribbons',
  'Thorn Covenant': 'blood-red scar-light and lashing briar, rose petals torn loose',
  'Drowned Litany': 'teal water rising upward, pearls and salt spray',
  'Glass Confession': 'ice-blue mirror shards, hard white reflections and her inner light bleeding through cracks',
  'Red Pilgrimage': 'red footprints of light, gold road-dust and scallop sigils',
  'Hollow Bell': 'bronze sound-rings rippling out, rope shadows and a dull midnight shockwave',
};
const CLASS_FX: Record<string, string> = {
  hierophant: 'her reliquary-shield flares and throws up a wall of light',
  sentinel: 'she plants her feet and every blow she takes flashes back as a riposte arc',
  martyr: 'her own blood turns to holy fire across her sisters',
  confessor: 'a hand of light closes wounds and burns out poison',
  hospitaller: 'a chalice spills light that lifts the fallen',
  abbess: 'the crozier cracks like a whip, thorns mending as they cut',
  oracle: 'omens burn in the air as smoke-runes',
  cantor: 'her voice is visible as rings of flame',
  adjudicator: 'giant scales of light tip and crush the foe',
  warsister: 'the flail spins in a red arc and her scourge-marks glow',
  inquisitor: 'the executioner\'s axe falls in one heavy flash',
  veilblade: 'she vanishes and reappears in a slash of dark silk',
  censer: 'the thurible swings out a choking cloud of burning incense',
  arbalist: 'a single blessed bolt leaves a long streak of scripture-light',
  exorcist: 'the lantern opens and witchfire pours out like a flamer',
};
const COMMAND: Record<string, string> = {
  hierophant: 'a shield-wall of relic bearers',
  sentinel: 'a phalanx of tomb guards with pikes',
  martyr: 'a mob of flagellant zealots who charge without fear',
  confessor: 'a field hospital of novice nuns',
  hospitaller: 'litter-bearers who drag the wounded back to the line',
  abbess: 'a disciplined cloister of rod-armed novices',
  oracle: 'a war-choir of seers who call the enemy\'s moves',
  cantor: 'a hymn-chanting war-choir that lifts every soldier\'s spirit',
  adjudicator: 'a court of inquisitors who mark heretic officers',
  warsister: 'a frenzied flail company',
  inquisitor: 'headsmen who hunt enemy captains',
  veilblade: 'a cell of veiled assassins',
  censer: 'thurible-swingers who smoke out the enemy ranks',
  arbalist: 'a line of crossbow nuns',
  exorcist: 'lantern-bearers with holy fire',
};

// ---------------------------------------------------------------- the forge

interface Forged {
  kit: Kit;
  used: string[];
}

/** Adds a sentence to a skill's text, before its closing "Cooldown N." so the page can still trim that. */
export function addText(desc: string, more: string): string {
  const m = desc.match(/^(.*?)\s*(Cooldown \d+\.)\s*$/s);
  return m ? `${m[1]} ${more} ${m[2]}` : `${desc.replace(/\s*$/, '')} ${more}`;
}

/** A copy of the skill with one more twist, its words kept true. */
function twisted(s: SkillDef, t: Twist, v: number, id: string): SkillDef {
  return { ...s, ...t.patch(v, s), id, icon: s.icon ?? s.id, desc: addText(s.desc, t.text(v, s)) };
}

/** Picks the n-th twist that fits, Order favourites first. */
function pickTwist(order: string, s: SkillDef, h: number, n: number, avoid: Set<string>): Twist | undefined {
  const fav = ORDER_TWISTS[order] ?? [];
  const rest = ALL_TWISTS.filter((k) => !fav.includes(k));
  const order1 = [...fav.map((_, i) => fav[(i + h) % fav.length]), ...rest.map((_, i) => rest[(i + (h >>> 3)) % rest.length])];
  const fits = order1.filter((k) => !avoid.has(k) && TWISTS[k].fits(s));
  return fits.length ? TWISTS[fits[n % fits.length]] : undefined;
}

function pickRule(c: CrusaderDef, kit: Kit, h: number, n: number, v: number, sig: Sig | undefined): Rule | undefined {
  const fav = ORDER_RULES[c.order] ?? [];
  const rest = ALL_RULES.filter((k) => !fav.includes(k));
  const list = [...fav, ...rest.map((_, i) => rest[(i + h) % rest.length])].filter((k) => {
    const r = RULES[k];
    return (r.min ?? 0) <= v && (!r.fits || r.fits(c, kit)) && !(sig && r.key in sig);
  });
  const favs = list.filter((k) => fav.includes(k));
  if (favs.length && n < 6) return RULES[favs[(h + n) % favs.length]];
  return list.length ? RULES[list[(h + n) % list.length]] : undefined;
}

/** Which skills take twists: R her own skill; SR + her Litany; SSR all three of her own + Litany; UR every skill. */
function twistSlots(kit: Kit, v: number): number[] {
  const staples = new Set(Object.values(CLASS_SKILLS).flat().map((s) => s.id));
  const own = kit.skills.map((s, i) => (!staples.has(s.id) && !s.rite ? i : -1)).filter((i) => i >= 0);
  if (v === 0) return own.slice(-1).length ? own.slice(-1) : [2];
  if (v === 1) return [...(own.slice(-1).length ? own.slice(-1) : [2]), 3];
  if (v === 2) return [...new Set([...own, 3])].slice(0, 3);
  return [0, 1, 2, 3];
}

function forgeOne(c: CrusaderDef, base: Kit, salt: number): Forged {
  const v = tierOf(c);
  const h = hash(`${c.id}#${salt}`);
  const kit: Kit = { ...base, skills: [...base.skills] as Kit['skills'] };
  const used: string[] = [];
  // twists
  twistSlots(kit, v).forEach((i, n) => {
    const s = kit.skills[i];
    const t = pickTwist(c.order, s, h + i * 13, n + salt, new Set(used));
    if (!t) return;
    used.push(t.key);
    kit.skills[i] = twisted(s, t, v, `${slug(c.id)}-${slug(s.name)}-${t.key.toLowerCase()}`);
  });
  // SSR and UR Litanies lay holy ground
  const lit = kit.skills[3];
  if (v >= 2 && !lit.ground) {
    const kind = ORDER_GROUND[c.order] ?? 'hallowed';
    const rounds = v >= 3 ? 3 : 2;
    kit.skills[3] = { ...lit, ground: { kind, rounds }, desc: addText(lit.desc, `It hallows the ground: ${GROUND_TEXT[kind]} for ${rounds} rounds.`) };
  }
  // her own passive: the base plus one personal rule
  const rule = pickRule(c, kit, h, salt, v, kit.sig);
  const words = PASSIVE_WORDS[c.order] ?? ['Holy'];
  const pname = `${words[h % words.length]} ${PASSIVE_NOUNS[(h >>> 5) % PASSIVE_NOUNS.length]}`;
  if (rule) {
    const extra = rule.sig(v, c);
    const basePassive: PassiveDef | undefined = kit.passive ?? c.passive;
    kit.sig = { ...(kit.sig ?? {}), ...extra };
    used.push(`rule:${rule.key}`);
    kit.passive = basePassive
      ? { ...basePassive, name: pname, desc: `${basePassive.desc.replace(/\s*$/, '')} ${rule.text(v, c)}` }
      : { name: pname, desc: rule.text(v, c), kind: 'signature' };
  }
  return { kit, used };
}

/** Her Relic: one more twist on one of her skills, and a harder hit. */
function relicFor(c: CrusaderDef, kit: Kit, salt: number, name: string): Relic | undefined {
  const v = tierOf(c);
  const h = hash(`relic:${c.id}#${salt}`);
  const order = [1, 2, 0, 3];
  for (let k = 0; k < 4; k++) {
    const i = order[(h + k) % 4] as 0 | 1 | 2 | 3;
    const s = kit.skills[i];
    const t = pickTwist(c.order, s, h >>> 4, salt + k, new Set());
    if (!t) continue;
    const bump = step([1.08, 1.1, 1.12, 1.15, 1.2], v);
    const patch: Partial<SkillDef> = { ...t.patch(v, s), ...(s.mult ? { mult: Math.round(s.mult * bump * 100) / 100 } : {}) };
    const text = `${s.name}: ${t.text(v, s)}${s.mult ? ` It hits ${pct(bump - 1)} harder.` : ''}`;
    return { name, desc: text, skill: i, patch };
  }
  return undefined;
}

const titleCase = (s: string) => s.replace(/\b\w/g, (m) => m.toUpperCase());
const relicName = (c: CrusaderDef) => titleCase((c.relic ?? 'Holy Symbol').split(',')[0].trim());

/** A canonical form of a kit's rules, for the uniqueness check. */
export function kitShape(kit: Kit): string {
  const strip = (s: SkillDef) => Object.fromEntries(Object.entries(s).filter(([k]) => k !== 'id' && k !== 'name' && k !== 'desc').sort(([a], [b]) => a.localeCompare(b)));
  return JSON.stringify({ s: kit.skills.map(strip), g: kit.sig ? Object.fromEntries(Object.entries(kit.sig).sort(([a], [b]) => a.localeCompare(b))) : null, p: kit.passive?.kind, pv: kit.passive?.value, r: kit.relic ? { i: kit.relic.skill, p: kit.relic.patch } : null, seal: kit.seal?.kind });
}

/** Forges every Sister's kit (run after genKits). */
export function forgeKits(all: CrusaderDef[]) {
  const shapes = new Set<string>();
  const crySeen = new Map<string, Set<string>>();
  const passiveNames = new Set<string>();
  // hand-made kits first: they keep their skills and claim their shapes
  const order = [...all.filter((c) => !KITS[c.id]?.generated), ...all.filter((c) => KITS[c.id]?.generated)];
  for (const c of order) {
    const base = KITS[c.id];
    if (!base) continue;
    const v = tierOf(c);
    let kit: Kit = base;
    if (base.generated) {
      for (let salt = 0; salt < 40; salt++) {
        const f = forgeOne(c, base, salt);
        const relic = relicFor(c, f.kit, salt, relicName(c));
        const tryKit = { ...f.kit, relic };
        if (!shapes.has(kitShape(tryKit)) && !passiveNames.has(tryKit.passive?.name ?? '')) {
          kit = tryKit;
          break;
        }
        kit = tryKit;
      }
    } else {
      kit = { ...base, skills: [...base.skills] as Kit['skills'] };
      // hand-made SSRs and URs keep their skills and take the same twists as everyone else
      if (v >= 2) {
        const h = hash(`${c.id}#hand`);
        const used = new Set<string>();
        twistSlots(kit, v).forEach((i, n) => {
          const s = kit.skills[i];
          const t = pickTwist(c.order, s, h + i * 13, n, used);
          if (!t) return;
          used.add(t.key);
          kit.skills[i] = twisted(s, t, v, `${s.id}-${t.key.toLowerCase()}`);
        });
      }
      const lit = kit.skills[3];
      if (v >= 2 && !lit.ground) {
        const kind = ORDER_GROUND[c.order] ?? 'hallowed';
        const rounds = v >= 3 ? 3 : 2;
        kit.skills[3] = { ...lit, id: `${lit.id}-${kind}`, icon: lit.icon ?? lit.id, ground: { kind, rounds }, desc: addText(lit.desc, `It hallows the ground: ${GROUND_TEXT[kind]} for ${rounds} rounds.`) };
      }
      if (!kit.relic) kit.relic = relicFor(c, kit, 0, relicName(c));
      // her hunt claims follow the field sim (data/shines.ts); her other claims stay
      const sim = FIELD_SHINES[c.id];
      if (sim && kit.shines) kit.shines = [...sim, ...kit.shines.filter((s) => !/ Hunt$/.test(s))];
    }
    if (c.rarity === 'UR' && c.limited && !kit.sig?.patron) {
      const atk = 0.12;
      const guard = 0.08;
      const p = kit.passive ?? c.passive;
      kit = {
        ...kit,
        sig: { ...(kit.sig ?? {}), patron: { atk, guard } },
        passive: { ...(p ?? { name: 'Patron Miracle', kind: 'signature' as const, desc: '' }), desc: `${(p?.desc ?? '').replace(/\s*$/, '')} PATRON MIRACLE: every ${c.order} Sister in the party gains +${pct(atk)} attack and takes ${pct(guard)} less damage.`.trim() },
      };
    }
    // cry, look, and the future lines
    const h = hash(c.id);
    const seen = crySeen.get(c.order) ?? new Set<string>();
    crySeen.set(c.order, seen);
    const opens = CRY_OPEN[c.order] ?? ['For the faith!'];
    const closes = CRY_CLOSE[c.classId] ?? ['Onward!'];
    let cry = '';
    for (let k = 0; k < opens.length * closes.length; k++) {
      cry = `${opens[(h + k) % opens.length]} ${closes[((h >>> 7) + k * 3) % closes.length]}`;
      if (!seen.has(cry)) break;
    }
    seen.add(cry);
    const lit = kit.skills[3];
    const look = `${ORDER_FX[c.order] ?? 'holy light'}; ${CLASS_FX[c.classId] ?? 'she strikes'}${lit.ground ? `; her Litany ${lit.name} hallows the ground in a ring of ${ORDER_FX[c.order]?.split(',')[0] ?? 'light'}` : ''}${kit.relic ? `; her ${kit.relic.name} blazes when woken` : ''}`;
    const extra: Partial<Kit> = { cry: kit.cry ?? cry, look: kit.look ?? look };
    if (c.rarity === 'SSR' && !c.limited) extra.ascended = kit.ascended ?? `As a Deity, her ${lit.name} also grants Rapture (no damage for a turn) to every Sister, and her passive grows by half.`;
    if (c.rarity === 'R') extra.command = kit.command ?? `Leads ${COMMAND[c.classId] ?? 'a company of zealots'} of the ${c.order}.`;
    kit = { ...kit, ...extra };
    shapes.add(kitShape(kit));
    if (kit.passive) passiveNames.add(kit.passive.name);
    KITS[c.id] = kit;
    void v;
  }
}

/** Role of a Sister (for tests and tools). */
export const roleOf = (c: CrusaderDef) => CLASSES[c.classId]?.role;
