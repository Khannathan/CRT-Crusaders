import Phaser from 'phaser';
import { FONT, GAME_H, GAME_W, PAL, hex } from '../config';
import { BANE_GUARD, BANE_MULT, CRIT_MULT, EXECUTE_AT, ZEAL_MAX } from '../systems/combat';
import { makeButton } from './button';
import { addFrame, text } from './theme';

/**
 * Combat words, explained. Skill, passive and Rite descriptions highlight
 * these; tapping one opens its entry. `match` lists the word forms that point
 * to it (lower case).
 */
export interface Term {
  title: string;
  color: number;
  text: string;
  match: string[];
}

const BUFF = 0x8fd0a0;
const DEBUFF = 0xe07a6a;
const DOT = 0xd89a50;
const TYPE = 0x9ab8f0;

export const GLOSSARY: Record<string, Term> = {
  bleed: { title: 'Bleed', color: DEBUFF, match: ['bleed', 'bleeding', 'bleeds'], text: 'Physical damage every 2s, ignoring Armor. A fresh wound replaces a weaker one; it does not stack. Cured by cleansing.' },
  burn: { title: 'Burn', color: DOT, match: ['burn', 'burns', 'burning', 'smouldering', 'ignite', 'ignited'], text: 'Magic fire damage every 2s, ignoring Magic Resist. Censers set it; some skills stack more on top or detonate it all at once.' },
  poison: { title: 'Poison', color: DOT, match: ['poison', 'poisons', 'poisoned'], text: 'Magic blight damage every 2s, ignoring Magic Resist. It can stack and spread. Cured by cleansing.' },
  stun: { title: 'Stun', color: DEBUFF, match: ['stun', 'stuns', 'stunned'], text: 'The target stands dazed and cannot act while it lasts (2s a stack). A stun also breaks a charging attack. Bosses resist it.' },
  sunder: { title: 'Sunder', color: DEBUFF, match: ['sunder', 'sunders', 'sundered'], text: 'Lowers the target\'s Armor, so Physical hits land harder.' },
  hex: { title: 'Hex', color: DEBUFF, match: ['hex', 'hexed', 'hexes'], text: 'Lowers the target\'s Magic Resist, so Magic hits land harder.' },
  weaken: { title: 'Weaken', color: DEBUFF, match: ['weaken', 'weakens', 'weakened', '-25% attack', '-40% attack'], text: 'The target deals less damage while it lasts.' },
  accused: { title: 'Accused', color: DEBUFF, match: ['accused', 'accuse'], text: 'Takes +25% damage from every Sister. Executioner skills do even more to the Accused.' },
  delay: { title: 'Stagger', color: DEBUFF, match: ['stagger', 'staggers', 'staggered'], text: 'Its next attack comes 1.6s late, and whatever it was about to do is dropped. Breaks a charging attack.' },
  haste: { title: 'Haste', color: BUFF, match: ['haste', 'hasted'], text: 'Acts 25% faster while it lasts.' },
  regen: { title: 'Regenerate', color: BUFF, match: ['regenerate', 'regenerates', 'regen'], text: 'Heals a share of max HP every 2s.' },
  ward: { title: 'Ward', color: BUFF, match: ['ward', 'warded', 'wards'], text: 'Takes less damage from every hit while it lasts.' },
  shield: { title: 'Shield', color: BUFF, match: ['shield', 'shields', 'shielded'], text: 'Absorbs damage before HP. A shield fades the next time she acts.' },
  empower: { title: 'Empower', color: BUFF, match: ['empower', 'empowered', '+25% attack', '+30% attack'], text: 'Deals more damage while it lasts.' },
  taunt: { title: 'Taunt', color: BUFF, match: ['taunt', 'taunts', 'draw enemy attacks'], text: 'Enemies that can reach her must attack her instead of her Sisters.' },
  riposte: { title: 'Riposte', color: BUFF, match: ['strikes back', 'strike back', 'riposte'], text: 'When an enemy hits her, she hits it back at once.' },
  thorns: { title: 'Thorns', color: BUFF, match: ['thorns', 'thorned'], text: 'Enemies that hit her take a share of the damage back.' },
  keen: { title: 'Keen', color: BUFF, match: ['critical chance', 'keen'], text: 'Raises critical chance: more hits land for 1.5x damage.' },
  purge: { title: 'Purge', color: DEBUFF, match: ['strip', 'strips', 'stripping', 'purged'], text: 'Removes the target\'s shield and every blessing: Empower, Ward, Regenerate, Haste, Thorns.' },
  raise: { title: 'Raise', color: BUFF, match: ['raise every fallen', 'raised'], text: 'Brings fallen Sisters back into the fight at the back of the line.' },
  cleanse: { title: 'Cleanse', color: BUFF, match: ['cure', 'cures', 'cured'], text: 'Removes Poison, Burn and Bleed.' },
  howl: { title: 'Howl', color: BUFF, match: ['howl', 'howls'], text: 'Your hound howls every 2s. Each hound has its own howl: more damage, less damage taken, mending, a shield, Zeal, or foes losing Armor and Magic Resist. Choose the hound in the Kennel or under any party.' },
  charge: { title: 'Charge', color: DEBUFF, match: ['charge', 'charging'], text: 'A foe winding up a great blow fires it when the wind-up ends. Stagger or Stun it to break the charge.' },
  zeal: { title: 'Zeal', color: PAL.amber, match: ['zeal'], text: `Each Sister's own fury, up to ${ZEAL_MAX}, shown under her HP. Her attacks, her support and her wounds build it; at ${ZEAL_MAX} she may spend it on her Litany. Some foes steal it.` },
  rite: { title: 'Litany', color: PAL.amber, match: ['litany', 'litanies'], text: `A Sister's great act. It costs all ${ZEAL_MAX} of her own Zeal; her Sisters keep theirs.` },
  wrath: { title: 'Wrath', color: 0xff4a4a, match: ['wrath', 'blasphemy', 'blasphemies'], text: `A boss's fury, the red bar under its HP. Its own deeds and the blows it takes build it; at ${ZEAL_MAX} it winds up its Blasphemy (Stagger it to break the charge), then unleashes it.` },
  physical: { title: 'Physical damage', color: 0xd8b48a, match: ['physical'], text: 'Cut by Armor. Bleed is Physical. Sunder lowers Armor.' },
  magic: { title: 'Magic damage', color: TYPE, match: ['magic'], text: 'Cut by Magic Resist. Burn and Poison are Magic. Hex lowers Magic Resist.' },
  armor: { title: 'Armor', color: 0xd8b48a, match: ['armor'], text: 'Cuts Physical damage: a hit is divided by 1 + Armor / 100, so 100 Armor halves it.' },
  mres: { title: 'Magic Resist', color: TYPE, match: ['magic resist'], text: 'Cuts Magic damage the way Armor cuts Physical: 100 Magic Resist halves a Magic hit.' },
  crit: { title: 'Critical hit', color: PAL.amber, match: ['crit', 'crits', 'critical'], text: `A critical hit deals ${CRIT_MULT}x damage.` },
  execute: { title: 'Execute', color: DEBUFF, match: ['under 30% hp'], text: `Extra damage against a foe below ${Math.round(EXECUTE_AT * 100)}% HP.` },
  bane: { title: 'Bane Order', color: PAL.amber, match: ['fears', 'bane'], text: `Every foe fears one Order. Sisters of that Order deal +${Math.round((BANE_MULT - 1) * 100)}% to it and take ${Math.round((1 - BANE_GUARD) * 100)}% less from it. Its sigil sits on its card.` },
  overwatch: { title: 'Overwatch', color: BUFF, match: ['overwatch'], text: 'Iron Vigil. A Sister on Overwatch reacts once, at once, when the next foe attacks inside her sights. A reaction on a charging boss also drains 10 Wrath.' },
  mercy: { title: 'Mercy', color: PAL.amber, match: ['mercy', 'mercy line', 'mercy kill', 'foretold', 'foretell'], text: 'Ashen Mercy. A common foe that an Ashen Mercy Sister leaves under its Mercy line (15% HP; Foretold raises it) dies at once, and every Sister heals 5%. A boss under the line takes +30% from them and loses 10 Wrath.' },
  guilt: { title: 'Guilt', color: DEBUFF, match: ['guilt'], text: 'Veiled Tribunal. Their hits on an Accused foe add Guilt, up to 5. Each Guilt makes it take 4% more damage. Sentence skills spend it for more.' },
  remains: { title: 'Remains', color: PAL.amber, match: ['remains'], text: 'Sepulcher Watch. While a Watch Sister stands, every fall (foe, add or Sister) gives the party 1 Remains, up to 6, and a boss gives one at 75%, 50% and 25% HP. Watch skills spend them.' },
  hymn: { title: 'Hymn', color: BUFF, match: ['hymn', 'hymns', 'harmony', 'harmonise'], text: 'Choir of the Pyre. A party aura that plays its effects every 2s for a few seconds, on the Sisters near the singer. One at a time, but a second Choir Hymn harmonises: both play, and every Sister gains 5 Zeal.' },
  scars: { title: 'Scars', color: DEBUFF, match: ['scar', 'scars'], text: 'Verdant Martyrdom. A Martyrdom Sister gains a Scar for each 5% of max HP she loses to her own skills or to bleeding, up to 10. Each Scar: +2% damage for the rest of the fight.' },
  tide: { title: 'Tide', color: TYPE, match: ['tide', 'ebb'], text: 'Drowned Litany. Rises by 1 every 2s while a Drowned Sister stands, up to 5. Drowned skills grow with it; Ebb skills spend it all.' },
  confess: { title: 'Confess', color: DEBUFF, match: ['confess', 'confessed', 'shatter'], text: 'Confessors of Glass. Critical hits against a Confessed foe Shatter for +20% critical damage.' },
  stride: { title: 'Pursuit', color: BUFF, match: ['pursuit'], text: 'Crimson Inquisition. An Inquisitor gains 1 Pursuit each time she changes her place in the line (a dash, a leap, a Step, a push or a pull), up to 5. Skills spend it.' },
  toll: { title: 'Toll', color: PAL.amber, match: ['toll', 'tolls', 'peal', 'midnight', 'bell rings'], text: 'Hallowed Belfry. Every skill a Belfry Sister uses rings the Bell. Every 3rd toll is a Peal: each Belfry Sister gains 5 Zeal. The 12th toll is Midnight: once a fight, every fallen Sister rises with 20% HP. Some Belfry Sisters add their own Peal effect.' },
  seal: { title: "Saint's Seal", color: PAL.amber, match: ["saint's seal", 'seal'], text: 'A UR Sister\'s once-a-fight miracle. It fires on its own the first time its moment comes.' },
  ebb: { title: 'Ebb', color: PAL.amber, match: ['ebb'], text: 'Drowned Litany. An Ebb skill spends the whole Tide at once, and grows with every point spent.' },
  frontline: { title: 'Front line', color: PAL.steel, match: ['front-line', 'front line'], text: 'The two foes standing nearest your Sisters, wherever they move. Every other foe is the back line.' },
  near: { title: 'Near foe', color: PAL.steel, match: ['near foe', 'near foes'], text: 'One of the three foes standing nearest your Sisters.' },
  vanguard: { title: 'Vanguard', color: PAL.steel, match: ['vanguard'], text: 'The first two Sisters in your line-up. Some skills work only from the Vanguard.' },
  rearguard: { title: 'Rearguard', color: PAL.steel, match: ['rearguard'], text: 'The last two Sisters in your line-up. Some skills work only from the Rearguard.' },
  cooldown: { title: 'Cooldown', color: PAL.steel, match: ['cooldown'], text: 'Seconds to wait before using the skill again, counted from when she used it.' },
};

/** The glossary entry a word (or phrase) points to. */
function termOf(word: string): string | undefined {
  const w = word.toLowerCase().replace(/[.,:;!?()"]/g, '');
  for (const [k, t] of Object.entries(GLOSSARY)) if (t.match.includes(w)) return k;
  return undefined;
}

/** Glossary keys mentioned in a text, in order. */
export function termsIn(desc: string): string[] {
  const out: string[] = [];
  for (const tok of tokens(desc)) {
    const k = termOf(tok);
    if (k && !out.includes(k)) out.push(k);
  }
  return out;
}

/** Words, with multi-word glossary phrases kept together. */
function tokens(desc: string): string[] {
  let s = desc;
  const phrases = Object.values(GLOSSARY).flatMap((t) => t.match.filter((m) => m.includes(' ')));
  for (const p of phrases) s = s.replace(new RegExp(p.replace(/[+%-]/g, (c) => `\\${c}`), 'gi'), (m) => m.replace(/ /g, ' '));
  return s.split(/\s+/).filter(Boolean).map((t) => t.replace(/ /g, ' '));
}

/**
 * Text laid out word by word inside `width`, with glossary words coloured and
 * underlined; tapping one opens its entry. Returns the objects and the height.
 */
export function richText(scene: Phaser.Scene, x: number, y: number, desc: string, opts: { width: number; size?: number; color?: number; depth?: number }) {
  const size = opts.size ?? 15;
  const line = Math.round(size * 1.45);
  const objs: Phaser.GameObjects.GameObject[] = [];
  let cx = x;
  let cy = y;
  const space = size * 0.3;
  for (const tok of tokens(desc)) {
    const k = termOf(tok);
    const t = scene.add.text(cx, cy, tok, { fontFamily: FONT, fontSize: `${size}px`, color: hex(k ? GLOSSARY[k].color : opts.color ?? PAL.muted), fontStyle: k ? '600' : '' });
    if (opts.depth !== undefined) t.setDepth(opts.depth);
    if (cx > x && cx + t.width > x + opts.width) {
      cx = x;
      cy += line;
      t.setPosition(cx, cy);
    }
    objs.push(t);
    if (k) {
      const u = scene.add.rectangle(cx, cy + size + 3, t.width, 1, GLOSSARY[k].color, 0.7).setOrigin(0, 0.5);
      if (opts.depth !== undefined) u.setDepth(opts.depth);
      objs.push(u);
      t.setInteractive({ useHandCursor: true }).on('pointerup', (p: Phaser.Input.Pointer) => {
        if (p.getDistance() > 12) return; // a drag, not a tap
        showTerm(scene, k, (opts.depth ?? 0) + 20);
      });
    }
    cx += t.width + space;
  }
  return { objs, height: cy - y + line };
}

/** One glossary entry in a small card. */
export function showTerm(scene: Phaser.Scene, key: string, depth = 80) {
  const t = GLOSSARY[key];
  if (!t) return;
  const layer = scene.add.container(0, 0).setDepth(depth);
  const shade = scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.6).setInteractive();
  shade.on('pointerup', () => layer.destroy());
  const body = scene.add.text(GAME_W / 2, GAME_H / 2 + 6, t.text, { ...text.body(17, PAL.ivory), align: 'center', wordWrap: { width: GAME_W - 110 } }).setOrigin(0.5, 0);
  const h = body.height + 110;
  layer.add([shade, ...addFrame(scene, GAME_W / 2, GAME_H / 2 + h / 2 - 50, GAME_W - 60, h, { fill: 0x241925 })]);
  layer.add(scene.add.text(GAME_W / 2, GAME_H / 2 - 22, t.title.toUpperCase(), text.display(22, t.color)).setOrigin(0.5));
  layer.add(body);
  layer.add(scene.add.text(GAME_W / 2, GAME_H / 2 + h - 72, 'Tap anywhere to close', text.body(13, PAL.steel)).setOrigin(0.5));
}

/**
 * A skill, passive or Rite in full: its name, tags, the description with
 * tappable effect words, extra facts, and each effect it uses explained.
 */
export function showDetail(scene: Phaser.Scene, d: { title: string; color?: number; tags: string; desc: string; facts?: string[] }, depth = 60) {
  const layer = scene.add.container(0, 0).setDepth(depth);
  layer.add(scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.88).setInteractive());
  const frame = addFrame(scene, GAME_W / 2, GAME_H / 2, GAME_W - 30, GAME_H - 120, { fill: 0x241925 });
  layer.add(frame);
  let y = 100;
  layer.add(scene.add.text(GAME_W / 2, y, d.title, text.display(26, d.color ?? PAL.ivory)).setOrigin(0.5, 0));
  y += 40;
  layer.add(scene.add.text(GAME_W / 2, y, d.tags, { ...text.hud(12, PAL.steel), align: 'center', wordWrap: { width: GAME_W - 90 } }).setOrigin(0.5, 0));
  y += 34;
  const r = richText(scene, 48, y, d.desc, { width: GAME_W - 96, size: 18, color: PAL.ivory, depth });
  layer.add(r.objs);
  y += r.height + 12;
  for (const f of d.facts ?? []) {
    const t = scene.add.text(48, y, `·  ${f}`, { ...text.body(15, PAL.muted), wordWrap: { width: GAME_W - 96 } });
    layer.add(t);
    y += t.height + 6;
  }
  const terms = termsIn(d.desc);
  if (terms.length) {
    y += 10;
    layer.add(scene.add.text(48, y, 'EFFECTS  ·  TAP A COLOURED WORD FOR MORE', text.hud(12, PAL.steel)));
    y += 24;
    for (const k of terms) {
      if (y > GAME_H - 170) break;
      const g = GLOSSARY[k];
      layer.add(scene.add.text(48, y, g.title, { ...text.body(15, g.color), fontStyle: '600' }));
      const t = scene.add.text(170, y, g.text, { ...text.body(14, PAL.muted), wordWrap: { width: GAME_W - 220 } });
      layer.add(t);
      y += Math.max(22, t.height) + 8;
    }
  }
  const close = makeButton(scene, GAME_W / 2, GAME_H - 104, 220, 56, 'Done', () => layer.destroy(), { fontSize: 18 });
  layer.add(close.all);
  return layer;
}
