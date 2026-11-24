import Phaser from 'phaser';
import { GAME_W, PAL } from '../config';
import { edictDef } from '../data/loot';
import { commit, game } from '../state/game';
import { current, type Challenge } from '../state/run';
import { saveSettings, settings } from '../state/settings';
import {
  DUE_MAX,
  abyssBattle,
  abyssIp,
  abyssOf,
  finishDescent,
  maxTier,
  piecesFor,
  sigilBlock,
  sigilCost,
  sigilEdicts,
  tierDef,
  tierFoes,
  tierRecommended,
  tierSpoils,
} from '../systems/abyss';
import { GEAR_SLOTS, GRADE_COLOR, SLOT_NAME, gearName, gradeName, type GearItem, type GearSlot } from '../systems/gear';
import { addBags, bagText, type Bag } from '../systems/items';
import { fightMarks } from '../systems/pickMarks';
import { accountPower } from '../systems/power';
import { makeButton } from '../ui/button';
import { showLootFilter } from '../ui/gearCard';
import { modeScreen, progressBar, toast } from '../ui/modeScreen';
import { pickParty } from '../ui/partyPicker';
import { drawRecommended } from '../ui/recommended';
import { PAD, addFrame, fitLine, text } from '../ui/theme';

/** Descents a "Descend on Auto" run makes before it stops on its own. */
const AUTO_RUNS = [5, 10, 25];

interface Haul {
  runs: number;
  dropped: GearItem[];
  items: Bag;
  melted: number;
  dues: number;
  sigil: number;
  stop?: string;
}

/** The Abyssal Crypt: endless tiers, no entry limit, a gear-only farm. */
export class AbyssScene extends Phaser.Scene {
  private tier = 1;
  private haul?: Haul;
  private notice?: string;

  constructor() {
    super('Abyss');
  }

  init(data: { tier?: number; haul?: Haul; notice?: string }) {
    const save = game.save;
    this.tier = Math.max(1, Math.min(maxTier(save), data?.tier ?? (this.tier > 1 ? this.tier : maxTier(save))));
    this.haul = data?.haul;
    this.notice = data?.notice;
  }

  create() {
    const save = game.save;
    const st = abyssOf(save);
    const { top } = modeScreen(this, 'The Abyssal Crypt', 'No end. No limit. Descend, and take what the dark gives up!', undefined, 'bg-abyssal-ossuary');
    const bw = GAME_W - PAD * 2;
    let y = top;
    this.add.text(PAD, y, `DEEPEST TIER ${st.best}  ·  ${st.runs} DESCENTS`, text.hud(14, PAL.amber));
    this.add.text(GAME_W - PAD, y, 'A LOSS COSTS NOTHING', text.hud(11, PAL.muted)).setOrigin(1, 0);
    y += 26;
    this.add.text(PAD, y, `PENITENT'S DUE ${st.due}/${DUE_MAX}: AN ANATHEMA PIECE WHEN FULL`, text.hud(11, 0xe07a2a));
    progressBar(this, PAD, y + 22, bw, st.due / DUE_MAX, 0xe07a2a, 8);
    y += 40;

    // Tier picker
    const d = tierDef(this.tier);
    const h = 214;
    addFrame(this, GAME_W / 2, y + h / 2, bw, h, { fill: d.boss ? 0x2a1520 : 0x1e1520, edge: d.boss ? 0xe58a8a : PAL.goldEdge });
    this.add.text(GAME_W / 2, y + 30, `TIER ${this.tier}`, text.display(28, 0xfff1d6)).setOrigin(0.5);
    const step = (n: number) => this.scene.restart({ tier: Math.max(1, Math.min(maxTier(save), this.tier + n)) });
    makeButton(this, PAD + 34, y + 30, 52, 40, '-10', () => step(-10), { fontSize: 14, disabled: this.tier <= 1 });
    makeButton(this, PAD + 92, y + 30, 52, 40, '-1', () => step(-1), { fontSize: 14, disabled: this.tier <= 1 });
    makeButton(this, GAME_W - PAD - 92, y + 30, 52, 40, '+1', () => step(1), { fontSize: 14, disabled: this.tier >= maxTier(save) });
    makeButton(this, GAME_W - PAD - 34, y + 30, 52, 40, 'Max', () => this.scene.restart({ tier: maxTier(save) }), { fontSize: 14, disabled: this.tier >= maxTier(save) });
    const tag = d.boss ? 'BOSS' : d.elite ? 'ELITE' : '';
    fitLine(this.add.text(PAD + 18, y + 62, `${tag ? `${tag}: ` : ''}${tierFoes(this.tier)}`, text.body(16, PAL.ivory)), bw - 36);
    this.add.text(PAD + 18, y + 88, `Foes at ${Math.round(d.scale * 100)}% strength`, text.body(15, PAL.muted));
    drawRecommended(this, GAME_W - PAD - 18, y + 92, tierRecommended(save, this.tier), accountPower(save), { align: 'right' });
    this.add.text(PAD + 18, y + 116, `${piecesFor(this.tier)} pieces at Item Power ~${abyssIp(this.tier)}${abyssIp(this.tier) >= 725 ? ' (Ancient)' : ''}`, text.body(15, PAL.amber));
    fitLine(this.add.text(PAD + 18, y + 140, `Every win: ${bagText(tierSpoils(this.tier))}${this.tier > st.best ? ` · first: ${bagText({ armory1: tierSpoils(this.tier, true).armory1 })}` : ''}`, text.body(14, PAL.steel)), bw - 36);
    if (this.tier > st.best) this.add.text(PAD + 18, y + 164, 'A new depth! Win to open the next tier.', text.body(14, 0xe5a86a));
    y += h + 12;

    // Sigil
    const sigil = st.sigil ?? {};
    const cost = sigilCost(this.tier, sigil);
    const block = sigilBlock(save, this.tier, sigil);
    this.add.text(PAD, y, `SIGIL  ·  ${cost ? `${cost} TITHES A WIN` : 'NONE: PIECES FALL WHERE THEY WILL'}`, text.hud(12, block && cost ? 0xd06060 : PAL.amber));
    y += 22;
    const half = (bw - 8) / 2;
    makeButton(this, PAD + half / 2, y + 22, half, 44, sigil.slot ? `Slot: ${SLOT_NAME[sigil.slot]}` : 'Slot: any', () => this.pickSlot(), { fontSize: 15, active: !!sigil.slot });
    makeButton(this, GAME_W - PAD - half / 2, y + 22, half, 44, sigil.edict ? fitName(edictDef(sigil.edict)!.name) : 'Edict: any', () => this.pickEdict(), { fontSize: 15, active: !!sigil.edict });
    y += 50;
    this.add.text(PAD, y, block && cost ? `${block}. The Sigil sleeps until you can pay.` : 'The Sigil aims the first piece of each win, and the Due.', { ...text.body(13, block && cost ? 0xd06060 : PAL.muted), wordWrap: { width: bw } });
    y += 30;

    // Descend
    makeButton(this, GAME_W / 2, y + 30, bw, 58, 'Descend', () => this.descend(0), { active: true, fontSize: 20, icon: 'blade' });
    y += 68;
    const third = (bw - 16) / 3;
    AUTO_RUNS.forEach((n, i) => makeButton(this, PAD + third / 2 + i * (third + 8), y + 22, third, 44, `Auto x${n}`, () => this.descend(n), { fontSize: 15 }));
    y += 52;
    makeButton(this, GAME_W / 2, y + 20, 200, 40, 'Loot filter', () => showLootFilter(this, () => this.scene.restart({ tier: this.tier })), { fontSize: 14 });
    y += 48;

    if (this.haul) this.showHaul(this.haul);
    else if (this.notice) toast(this, this.notice);
  }

  private pickSlot() {
    const st = abyssOf(game.save);
    const order: (GearSlot | undefined)[] = [undefined, ...GEAR_SLOTS];
    const next = order[(order.indexOf(st.sigil?.slot) + 1) % order.length];
    const edict = st.sigil?.edict && (!next || edictDef(st.sigil.edict)!.slots.includes(next)) ? st.sigil.edict : undefined;
    st.sigil = next || edict ? { slot: next, edict } : undefined;
    commit();
    this.scene.restart({ tier: this.tier });
  }

  private pickEdict() {
    const st = abyssOf(game.save);
    const list = [undefined, ...sigilEdicts(st.sigil?.slot).map((e) => e.id)];
    const next = list[(list.indexOf(st.sigil?.edict) + 1) % list.length];
    st.sigil = st.sigil?.slot || next ? { slot: st.sigil?.slot, edict: next } : undefined;
    commit();
    this.scene.restart({ tier: this.tier });
  }

  private descend(runs: number) {
    const save = game.save;
    const tier = this.tier;
    pickParty(
      this,
      save,
      {
        title: `Tier ${tier}`,
        sub: runs ? `They descend on Auto, ${runs} times, until they fall. Switch Auto off to halt.` : 'Tap in rank order. The first stands in front.',
        initial: save.lastParty,
        confirm: runs ? `Descend x${runs}` : 'Descend',
        rec: tierRecommended(save, tier),
        marks: fightMarks(abyssBattle(save, [], tier)),
      },
      (party) => {
        if (runs && !settings.autoBattle) {
          settings.autoBattle = true;
          saveSettings();
        }
        current.challenge = this.challenge(party, tier, Math.max(1, runs), { runs: 0, dropped: [], items: {}, melted: 0, dues: 0, sigil: 0 });
        this.scene.start('Battle');
      },
    );
  }

  /** One descent. `left` counts the descents still to make (1 = this is the last). */
  private challenge(party: string[], tier: number, left: number, haul: Haul): Challenge {
    const save = game.save;
    return {
      label: `Tier ${tier} of the Abyssal Crypt. ${tierDef(tier).boss ? 'Something old wakes below!' : 'The dark gives nothing freely.'}`,
      make: (rng) => abyssBattle(save, party, tier, rng),
      finish: (_o, battle) => {
        const r = finishDescent(save, tier, party, battle);
        commit();
        if (r.won) {
          haul.runs++;
          haul.dropped.push(...r.dropped);
          haul.items = addBags(haul.items, r.items);
          haul.melted += r.melted;
          haul.dues += r.duePaid ? 1 : 0;
          haul.sigil += r.sigilPaid;
        }
        const more = r.won && left > 1 && settings.autoBattle;
        if (more) {
          current.challenge = this.challenge(party, tier, left - 1, haul);
          return { scene: 'Battle', line: `Tier ${tier} cleared! ${left - 1} more to go.` };
        }
        if (!r.won) haul.stop = haul.runs ? 'Stopped: the Sisters were driven back.' : 'Driven back from the dark. Nothing lost.';
        else if (left > 1) haul.stop = 'Stopped: Auto was switched off.';
        return { scene: 'Abyss', data: { tier, haul: haul.runs ? haul : undefined, notice: haul.runs ? undefined : haul.stop }, line: r.won ? `Tier ${tier} cleared!${r.newBest ? ' A new depth!' : ''}` : undefined };
      },
    };
  }

  /** What the last descents brought up, best first. */
  private showHaul(haul: Haul) {
    const layer = this.add.container(0, 0).setDepth(50);
    const bw = GAME_W - PAD * 2;
    const rows = [...haul.dropped].sort((a, b) => rank(b) - rank(a) || b.ip - a.ip).slice(0, 8);
    const h = 180 + rows.length * 30 + (haul.dropped.length > rows.length ? 24 : 0);
    const y0 = 150;
    layer.add(this.add.rectangle(GAME_W / 2, 480, GAME_W, 2000, 0x09060b, 0.7).setInteractive());
    layer.add(addFrame(this, GAME_W / 2, y0 + h / 2, bw, h, { fill: 0x1e1520, edge: PAL.goldEdge }) as unknown as Phaser.GameObjects.GameObject);
    layer.add(this.add.text(GAME_W / 2, y0 + 26, haul.runs === 1 ? 'THE DARK GIVES UP' : `${haul.runs} DESCENTS`, text.display(22, PAL.amber)).setOrigin(0.5));
    let y = y0 + 56;
    for (const g of rows) {
      layer.add(fitLine(this.add.text(PAD + 18, y, `${gearName(g)}`, text.body(16, GRADE_COLOR[g.grade])), bw - 150));
      layer.add(this.add.text(GAME_W - PAD - 18, y + 2, `${gradeName(g.grade).toUpperCase()} · IP ${g.ip}`, text.hud(11, GRADE_COLOR[g.grade])).setOrigin(1, 0));
      y += 30;
    }
    if (haul.dropped.length > rows.length) layer.add(this.add.text(PAD + 18, y, `and ${haul.dropped.length - rows.length} more`, text.body(14, PAL.muted))), (y += 24);
    const lines = [
      bagText(haul.items),
      haul.melted ? `${haul.melted} Tithes from pieces the filter melted` : '',
      haul.dues ? `The Penitent's Due paid ${haul.dues === 1 ? 'once' : `${haul.dues} times`}!` : '',
      haul.sigil ? `Sigil: ${haul.sigil} Tithes` : '',
      haul.stop ?? '',
    ].filter(Boolean);
    layer.add(this.add.text(PAD + 18, y + 6, lines.join('\n'), { ...text.body(14, PAL.steel), wordWrap: { width: bw - 36 } }));
    const close = makeButton(this, GAME_W / 2, y0 + h + 44, 200, 48, 'Onward', () => layer.destroy(), { active: true, fontSize: 17 });
    layer.add(close.all);
  }
}

const RANK: Record<string, number> = { worn: 0, consecrated: 1, sworn: 2, anathema: 3, arms: 4, godforged: 5 };
const rank = (g: GearItem) => RANK[g.grade];
const fitName = (s: string) => (s.length > 18 ? `${s.slice(0, 17)}…` : s);
