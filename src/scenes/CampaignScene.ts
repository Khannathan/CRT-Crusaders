import Phaser from 'phaser';
import { chronicle, pendingAfter, pendingBefore } from '../systems/story';
import { GAME_H, GAME_W, PAL } from '../config';
import { ENCOUNTERS, ENEMIES } from '../data/enemies';
import { commit, game } from '../state/game';
import { current, type Challenge } from '../state/run';
import { saveSettings, settings } from '../state/settings';
import { CHAPTERS, STAGES_PER_CHAPTER, TOTAL_STAGES, campaignOf, chapterChest, finishStage, nextStage, roadDone, roadRates, stageBattle, stageDef, stageRecommended, stageReward, type StageReward } from '../systems/campaign';
import { bagText } from '../systems/items';
import { partyPower } from '../systems/power';
import { VIGIL_SIZE, ensureVigil } from '../systems/vigil';
import { makeButton } from '../ui/button';
import { drawMarchToggle } from '../ui/marchUi';
import { marchOf } from '../systems/march';
import { nodeIconKey } from '../ui/icons';
import { modeScreen, toast } from '../ui/modeScreen';
import { pickParty } from '../ui/partyPicker';
import { drawRecommended } from '../ui/recommended';
import { addScrollArea } from '../ui/scroll';
import { TAB_BAR_H } from '../ui/tabBar';
import { PAD, addBackdrop, addFrame, text } from '../ui/theme';

const STEP = 84;
const CHAPTER_GAP = 120;
const PANEL_H = 214;

export const rewardText = (r: StageReward) =>
  [r.tithes ? `${r.tithes} Tithes` : '', r.seals ? `${r.seals} Seal${r.seals > 1 ? 's' : ''}` : '', r.gilt ? `${r.gilt} Gilt` : '', r.stigmata ? `${r.stigmata} Stigmata` : '', bagText(r.items)].filter(Boolean).join(' + ');

/**
 * The Pilgrim's Road: the Vigil's campaign map. A winding road, climbed from
 * the bottom, five chapters of ten stages. Tap a stage to see it; Challenge
 * fights the next one with the Vigil's Sisters (or any four).
 */
export class CampaignScene extends Phaser.Scene {
  private static listY?: number;
  private sel = 0;
  private notice?: string;
  /** A stage to fight at once (after its story scene played). */
  private fight?: number;

  constructor() {
    super('Campaign');
  }

  init(data: { notice?: string; fight?: number }) {
    this.notice = data.notice;
    this.fight = data.fight;
    this.sel = 0;
  }

  create() {
    const save = game.save;
    const { top } = modeScreen(this, "The Pilgrim's Road", 'Each stage won quickens the Vigil.', 'Sanctum');
    const next = nextStage(save);
    const best = campaignOf(save).best;
    if (!this.sel) this.sel = next;
    const mapTop = top + 4;
    const mapBottom = GAME_H - TAB_BAR_H - PANEL_H - 6;

    // Stage positions: stage 1 at the bottom, winding upward; a gap and a banner per chapter.
    const height = TOTAL_STAGES * STEP + CHAPTERS.length * CHAPTER_GAP + 60;
    const yOf = (n: number) => mapTop + height - 50 - (n - 1) * STEP - Math.floor((n - 1) / STAGES_PER_CHAPTER) * CHAPTER_GAP;
    const xOf = (n: number) => GAME_W / 2 + Math.sin(n * 0.85) * 150;
    const focus = yOf(this.sel);
    const start = CampaignScene.listY ?? Math.min(0, Math.max(mapBottom - (mapTop + height), (mapTop + mapBottom) / 2 - focus));
    const list = addScrollArea(this, mapTop, mapBottom, { start, onScroll: (y) => (CampaignScene.listY = y) });
    const before = this.children.list.length;

    // Chapter backdrops and banners
    CHAPTERS.forEach((ch, c) => {
      const first = c * STAGES_PER_CHAPTER + 1;
      const last = first + STAGES_PER_CHAPTER - 1;
      const y0 = yOf(last) - 70;
      const y1 = yOf(first) + 50;
      const art = this.textures.exists(`bg-${ch.crypt.id}`) ? `bg-${ch.crypt.id}` : 'bg-hall';
      addBackdrop(this, art, GAME_W / 2, (y0 + y1) / 2, GAME_W - PAD * 2, y1 - y0, { alpha: best >= first - 1 ? 0.4 : 0.15, fade: 0.6, fadeColor: 0x120c14 });
      const by = y0 - 26;
      // chapter-<n>.png: the chapter's title scene, behind its banner
      if (this.textures.exists(`chapter-${c + 1}`)) addBackdrop(this, `chapter-${c + 1}`, GAME_W / 2, by - 22, GAME_W - PAD * 2, 92, { alpha: best >= first - 1 ? 0.9 : 0.35, fade: 0.5, fadeColor: 0x120c14, focusY: 0.4 });
      this.add.rectangle(GAME_W / 2, by, GAME_W - PAD * 2, 44, 0x1b121c, 0.92).setStrokeStyle(1, best >= first - 1 ? PAL.goldEdge : PAL.armorShadow);
      this.add.text(PAD + 14, by, `CHAPTER ${c + 1}`, text.hud(12, PAL.amber)).setOrigin(0, 0.5);
      this.add.text(PAD + 104, by, ch.name, text.display(17, best >= first - 1 ? 0xfff1d6 : PAL.muted)).setOrigin(0, 0.5);
      const chest = best >= last ? 'CHEST OPENED' : 'CHEST AT 10';
      this.add.text(GAME_W - PAD - 12, by, chest, text.hud(11, best >= last ? PAL.amber : PAL.steel)).setOrigin(1, 0.5);
    });

    // The road
    const g = this.add.graphics();
    for (let n = 1; n < TOTAL_STAGES; n++) {
      g.lineStyle(4, n < next ? PAL.amber : 0x3a2a34, n < next ? 0.8 : 1);
      g.lineBetween(xOf(n), yOf(n), xOf(n + 1), yOf(n + 1));
    }
    for (let n = 1; n <= TOTAL_STAGES; n++) {
      const s = stageDef(n);
      const x = xOf(n);
      const y = yOf(n);
      const done = n <= best;
      const isNext = n === next && best < TOTAL_STAGES;
      const r = s.boss ? 30 : s.elite ? 24 : 20;
      const ring = this.add.circle(x, y, r + 4, 0x120c14).setStrokeStyle(n === this.sel ? 4 : 2, isNext ? PAL.amber : done ? PAL.goldEdge : PAL.armorShadow);
      const kind = s.boss ? 'boss' : s.elite ? 'elite' : 'fight';
      if (this.textures.exists(nodeIconKey(kind))) {
        this.add.image(x, y, nodeIconKey(kind)).setDisplaySize(r * 2, r * 2).setAlpha(done || isNext ? 1 : 0.35);
      } else this.add.circle(x, y, r, done ? PAL.amber : 0x2a1e28);
      if (done) this.add.text(x + r - 4, y - r - 2, '✓', text.hud(14, PAL.amber)).setOrigin(0.5);
      this.add.text(x + (x > GAME_W / 2 ? -(r + 12) : r + 12), y, s.label, text.hud(13, isNext ? PAL.amber : done ? PAL.ivory : PAL.steel)).setOrigin(x > GAME_W / 2 ? 1 : 0, 0.5);
      if (isNext) this.tweens.add({ targets: ring, scale: 1.12, yoyo: true, repeat: -1, duration: 700 });
      if (n <= next) {
        list.tap(ring, () => {
          this.sel = n;
          this.time.delayedCall(0, () => this.scene.restart({}));
        });
      }
    }
    list.content.add(this.children.list.slice(before));
    list.fit(mapTop + height);

    this.drawPanel(mapBottom + 6);
    if (this.notice) toast(this, this.notice, GAME_H / 2 - 120);
    this.notice = undefined;
    // The Chronicle: every story scene behind you, to play again.
    if (chronicle(save, best).length) makeButton(this, GAME_W - PAD - 150, top - 30, 104, 40, 'Chronicle', () => this.scene.start('Chronicle'), { fontSize: 15, icon: 'book' });
    if (this.fight) {
      const n = this.fight;
      this.fight = undefined;
      this.time.delayedCall(0, () => this.challenge(n));
    }
  }

  /** The chosen stage: its foes, what it asks, what it pays, and Challenge. */
  private drawPanel(y0: number) {
    const save = game.save;
    const n = this.sel;
    const s = stageDef(n);
    const best = campaignOf(save).best;
    const w = GAME_W - PAD * 2;
    const left = PAD + 16;
    addFrame(this, GAME_W / 2, y0 + PANEL_H / 2, w, PANEL_H, { fill: 0x1b121c });
    const kind = s.boss ? 'CHAPTER BOSS' : s.elite ? 'ELITE' : 'STAGE';
    this.add.text(left, y0 + 14, `${kind} ${s.label}`, text.hud(13, s.boss ? 0xe58a8a : PAL.amber));
    this.add.text(left, y0 + 32, CHAPTERS[s.chapter].name, text.display(18, 0xfff1d6));
    const foes = ENCOUNTERS[s.encounter].map((t) => ENEMIES[t]?.name ?? t);
    this.add.text(left, y0 + 60, foes.join(', '), { ...text.body(15, PAL.muted), wordWrap: { width: w - 32 } }).setCrop(0, 0, w - 32, 40);
    const v = ensureVigil(save, Date.now());
    const party = (v?.party ?? []).filter((id) => save.owned[id]);
    drawRecommended(this, left, y0 + 104, stageRecommended(save, n), partyPower(save, party), { size: 13, label: 'VIGIL' });
    const done = n <= best;
    const pay = done ? 'Cleared. Its first-clear reward is yours.' : `First clear: ${rewardText(stageReward(n))}${s.boss ? `\nChapter chest: ${rewardText(chapterChest(s.chapter))}` : ''}`;
    this.add.text(left, y0 + 126, pay, { ...text.body(15, done ? PAL.steel : PAL.ivory), wordWrap: { width: w - 32 } });
    // The March: the Vigil's Sisters push on by themselves, on every screen and while you are away.
    if (!roadDone(save) || marchOf(save)) drawMarchToggle(this, GAME_W - PAD - 80, y0 + 28, 132, 36, 14);
    else this.add.text(GAME_W - PAD - 16, y0 + 14, `VIGIL ${Math.round(roadRates(save).tithes)} TITHES/H`, text.hud(11, PAL.steel)).setOrigin(1, 0);
    const can = n === best + 1;
    if (can) {
      makeButton(this, GAME_W / 2 - 104, y0 + PANEL_H - 34, 200, 52, 'Challenge', () => this.challenge(n), { active: true, icon: 'blade', fontSize: 18 });
      makeButton(this, GAME_W / 2 + 104, y0 + PANEL_H - 34, 200, 52, 'Auto-push', () => this.challenge(n, true), { fontSize: 18 });
    } else makeButton(this, GAME_W / 2, y0 + PANEL_H - 34, 260, 52, done ? 'Cleared' : 'Clear the stage before', () => {}, { disabled: true, fontSize: 18 });
  }

  /**
   * Fights stage n. With `push`, every win goes straight on to the next stage
   * on Auto, until the first defeat (or the player switches Auto off).
   */
  private challenge(n: number, push = false) {
    const save = game.save;
    // The road's story: a scene plays the first time a stage is reached.
    const scene = n === campaignOf(save).best + 1 ? pendingBefore(save, n) : undefined;
    if (scene) {
      this.scene.start('Story', { id: scene.id, next: { scene: 'Campaign', data: { fight: n } } });
      return;
    }
    const s = stageDef(n);
    const v = ensureVigil(save, Date.now());
    pickParty(
      this,
      save,
      {
        title: push ? `Auto-push from ${s.label}` : `Stage ${s.label}`,
        sub: push ? 'They fight on Auto, stage after stage, until they fall. Switch Auto off to halt.' : 'The Vigil\'s Sisters are picked. Tap in rank order.',
        initial: v?.party ?? save.lastParty,
        max: VIGIL_SIZE,
        confirm: push ? 'March' : 'Fight',
        rec: stageRecommended(save, n),
      },
      (party) => {
        if (push && !settings.autoBattle) {
          settings.autoBattle = true;
          saveSettings();
        }
        current.challenge = this.stageChallenge(party, n, push ? [] : undefined);
        this.scene.start('Battle');
      },
    );
  }

  /** One stage's fight. `pushed` (the stages won so far) makes a win march on to the next. */
  private stageChallenge(party: string[], n: number, pushed?: string[]): Challenge {
    const save = game.save;
    const s = stageDef(n);
    return {
      label: `Stage ${s.label} of the Pilgrim's Road. ${s.boss ? 'The road ends at something vast!' : 'Pilgrims never walk alone.'}`,
      make: (rng) => stageBattle(save, party, n, rng),
      finish: (outcome) => {
        const r = finishStage(save, n, outcome);
        commit();
        CampaignScene.listY = undefined;
        if (pushed) {
          if (r.won) pushed.push(s.label);
          const more = r.won && n < TOTAL_STAGES && settings.autoBattle;
          if (more) {
            current.challenge = this.stageChallenge(party, n + 1, pushed);
            return { scene: 'Battle' };
          }
          const cleared = pushed.length ? `Auto-push cleared ${pushed.length} stage${pushed.length === 1 ? '' : 's'} (${pushed[0]}${pushed.length > 1 ? ` to ${pushed[pushed.length - 1]}` : ''}).` : 'Auto-push won no stages.';
          const why = !r.won ? `Stopped at ${s.label}: the Sisters were driven back.` : n >= TOTAL_STAGES ? 'The road is walked to its end. Glory!' : 'Stopped: Auto was switched off.';
          return { scene: 'Campaign', data: { notice: `${cleared}\n${why}` } };
        }
        const notice = !r.won
          ? 'Driven back. Strengthen your Sisters and walk on.'
          : r.first
            ? `Stage ${s.label} cleared: ${rewardText(r.reward!)}${r.chest ? `\nChapter chest: ${rewardText(r.chest)}` : ''}\nThe Vigil quickens!`
            : `Stage ${s.label} won again.`;
        const after = r.first ? pendingAfter(save, n) : undefined;
        if (after) return { scene: 'Story', data: { id: after.id, next: { scene: 'Campaign', data: { notice } } } };
        return { scene: 'Campaign', data: { notice } };
      },
    };
  }
}
