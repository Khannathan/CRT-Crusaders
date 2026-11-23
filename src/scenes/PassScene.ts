import Phaser from 'phaser';
import { GAME_H, GAME_W, PAL } from '../config';
import { sfx } from '../audio/sfx';
import { commit, game } from '../state/game';
import { giltOf } from '../systems/currency';
import {
  DAILY_STEP_CAP,
  OVERFLOW,
  STEPS,
  STEPS_PER_TIER,
  SWORN_COST,
  TIERS,
  claimAllPass,
  freeClaimable,
  freeReward,
  overflowReady,
  paidClaimable,
  paidReward,
  passOf,
  passReady,
  seasonAt,
  sumText,
  swearPass,
  tierOf,
} from '../systems/pass';
import { rewardText } from '../systems/tasks';
import { makeButton } from '../ui/button';
import { modeScreen, progressBar, toast, untilText } from '../ui/modeScreen';
import { addScrollArea } from '../ui/scroll';
import { TAB_BAR_H } from '../ui/tabBar';
import { PAD, fitLine, text } from '../ui/theme';

/**
 * The Pilgrim's Pass: fifty tiers this season, a free lane and the Sworn lane,
 * Steps from everything you already do, and Claim all.
 */
export class PassScene extends Phaser.Scene {
  private scroll?: number;
  private msg?: string;

  constructor() {
    super('Pass');
  }

  init(data: { scroll?: number; msg?: string }) {
    this.scroll = data?.scroll;
    this.msg = data?.msg;
  }

  create() {
    const save = game.save;
    const now = Date.now();
    const season = seasonAt(now);
    const p = passOf(save, now);
    const tier = tierOf(p);
    const { top, refresh } = modeScreen(this, "Pilgrim's Pass", `${season.name}. Every step you take is counted!`);
    const bw = GAME_W - PAD * 2;

    // Where you stand.
    this.add.text(PAD, top, `TIER ${tier} OF ${TIERS}`, text.hud(16, PAL.amber));
    this.add.text(GAME_W - PAD, top, `ENDS IN ${untilText(season.ends - now).toUpperCase()}`, text.hud(12, PAL.steel)).setOrigin(1, 0);
    const into = tier >= TIERS ? (p.steps - TIERS * STEPS_PER_TIER) % STEPS_PER_TIER : p.steps % STEPS_PER_TIER;
    progressBar(this, PAD, top + 34, bw, into / STEPS_PER_TIER, PAL.amber, 10);
    this.add.text(PAD, top + 46, tier >= TIERS ? `OVERFLOW ${into}/${STEPS_PER_TIER} STEPS` : `${into}/${STEPS_PER_TIER} STEPS TO TIER ${tier + 1}`, text.hud(12, PAL.ivory));
    this.add.text(GAME_W - PAD, top + 46, `TODAY ${p.today}/${DAILY_STEP_CAP}`, text.hud(12, p.today >= DAILY_STEP_CAP ? PAL.amber : PAL.steel)).setOrigin(1, 0);

    // The Sworn lane and Claim all.
    const by = top + 92;
    if (p.sworn) this.add.text(PAD, by, 'SWORN: BOTH LANES PAY', text.hud(13, 0xffd75a)).setOrigin(0, 0.5);
    else
      makeButton(this, PAD + 112, by, 224, 44, `Swear · ${SWORN_COST} Gilt`, () => {
        if (!swearPass(save, now)) return toast(this, `${SWORN_COST} Gilt needed. You hold ${giltOf(save)}.`);
        commit();
        sfx('sealRare', 1);
        refresh();
        this.scene.restart({ msg: 'Sworn! The Sworn lane pays from tier 1, even the tiers behind you.' });
      }, { active: giltOf(save) >= SWORN_COST, fontSize: 16, icon: 'gilt' });
    const ready = passReady(save, now);
    makeButton(this, GAME_W - PAD - 70, by, 140, 44, 'Claim all', () => {
      const paid = claimAllPass(save, now);
      if (!paid.length) return;
      commit();
      sfx('coin');
      refresh();
      this.scene.restart({ scroll: this.scroll, msg: `Glory! ${sumText(paid)}` });
    }, { active: ready, disabled: !ready, fontSize: 16 });

    // Column heads.
    const hy = by + 40;
    const colFree = PAD + 64;
    const colPaid = PAD + 64 + (bw - 64) / 2;
    const colW = (bw - 64) / 2 - 10;
    this.add.text(PAD + 8, hy, 'TIER', text.hud(11, PAL.steel));
    this.add.text(colFree, hy, 'FREE', text.hud(11, PAL.steel));
    this.add.text(colPaid, hy, p.sworn ? 'SWORN' : 'SWORN (LOCKED)', text.hud(11, p.sworn ? 0xffd75a : PAL.steel));

    // The tiers, the next one to reach near the top.
    const listTop = hy + 22;
    const list = addScrollArea(this, listTop, GAME_H - TAB_BAR_H - 6, { start: this.scroll ?? -Math.max(0, tier - 2) * 66, onScroll: (y) => (this.scroll = y) });
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => (list.content.add(o), o);
    let y = listTop + 2;
    const h = 58;
    for (let t = 1; t <= TIERS; t++) {
      const reached = t <= tier;
      const fGot = p.free.includes(t);
      const pGot = p.paid.includes(t);
      const fReady = freeClaimable(save, t, now);
      const pReady = paidClaimable(save, t, now);
      const big = t % 10 === 0;
      add(this.add.rectangle(GAME_W / 2, y + h / 2, bw, h, t === tier + 1 ? 0x2a1c24 : reached ? 0x1f1620 : 0x161017).setStrokeStyle(1, big ? PAL.amber : t === tier + 1 ? 0xc9a24a : PAL.armorShadow));
      add(this.add.text(PAD + 30, y + h / 2, `${t}`, text.hud(big ? 20 : 16, reached ? PAL.amber : PAL.steel)).setOrigin(0.5));
      const cell = (x: number, label: string, got: boolean, ready: boolean, locked: boolean) => {
        add(this.add.rectangle(x - 4, y + 5, colW + 4, h - 10, ready ? 0x3a2228 : 0x000000, ready ? 1 : 0).setOrigin(0, 0).setStrokeStyle(ready ? 2 : 0, PAL.amber));
        add(fitLine(this.add.text(x + 4, y + h / 2, label, { ...text.body(15, got ? PAL.muted : locked ? PAL.steel : PAL.ivory), wordWrap: { width: colW - 12 }, lineSpacing: -4 }).setOrigin(0, 0.5), colW - 8));
        if (got) add(this.add.text(x + colW - 4, y + 8, '✓', text.hud(14, PAL.bronze)).setOrigin(1, 0));
      };
      cell(colFree, rewardText(freeReward(t)), fGot, fReady, false);
      cell(colPaid, rewardText(paidReward(t)), pGot, pReady, !p.sworn);
      y += h + 8;
    }
    // Past the last tier.
    add(this.add.text(GAME_W / 2, y + 14, `PAST ${TIERS}: every ${STEPS_PER_TIER} Steps opens an Overflow chest (${rewardText(OVERFLOW)}).${overflowReady(save, now) > 0 ? ` ${overflowReady(save, now)} ready!` : ''}`, { ...text.body(15, PAL.ivory), align: 'center', wordWrap: { width: bw - 20 } }).setOrigin(0.5, 0));
    // How Steps are earned.
    const how = Object.entries(STEPS)
      .filter(([, n]) => n >= 6)
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `${STEP_NAME[k] ?? k} ${n}`)
      .join(' · ');
    add(this.add.text(GAME_W / 2, y + 64, `STEPS: ${how} · and 3-4 for each fight, pull, forge or level. ${DAILY_STEP_CAP} a day at most.`, { ...text.body(14, PAL.steel), align: 'center', wordWrap: { width: bw - 20 } }).setOrigin(0.5, 0));
    list.fit(y + 160);
    if (this.msg) toast(this, this.msg);
  }
}

const STEP_NAME: Record<string, string> = {
  dailyDone: 'Daily Penance done',
  cryptCleared: 'a crypt purified',
  bossWon: 'a boss slain',
  takeVow: 'a Vow taken',
  vigilClaim: 'the Vigil claimed',
  trialWon: 'a Trial won',
  inquisitionWon: 'an Inquisition won',
  eliteWon: 'an elite slain',
  towerFloor: 'a Tower floor',
};
