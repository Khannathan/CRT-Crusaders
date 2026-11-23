import Phaser from 'phaser';
import { GAME_W, PAL } from '../config';
import { ENCOUNTERS, ENEMIES } from '../data/enemies';
import { commit, game } from '../state/game';
import { current } from '../state/run';
import {
  FORTS,
  STAR_POINTS,
  STAR_REWARD,
  WAR_ATTACKS,
  WAR_LOSS,
  WAR_WIN,
  attacksLeft,
  finishStorm,
  fortGarrison,
  fortTarget,
  rivalName,
  starsFor,
  warBattle,
  warOf,
  warScore,
} from '../systems/chapterWar';
import { formatPower } from '../systems/power';
import { rewardText } from '../systems/tasks';
import { makeButton } from '../ui/button';
import { modeScreen, toast } from '../ui/modeScreen';
import { pickParty } from '../ui/partyPicker';
import { PAD, addFrame, text } from '../ui/theme';

const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);
const leaderOf = (encounter: string) => ENCOUNTERS[encounter]?.[0] ?? encounter;

/** Chapter War: storm the rival Chapter's six forts for stars. */
export class WarScene extends Phaser.Scene {
  private notice?: string;

  constructor() {
    super('War');
  }

  init(data: { notice?: string }) {
    this.notice = data?.notice;
  }

  create() {
    const save = game.save;
    const w = warOf(save);
    if (!w) {
      this.scene.start('Chapter');
      return;
    }
    commit();
    const rival = rivalName(save);
    const { top } = modeScreen(this, 'Chapter War', `This week: the ${rival}. Storm their forts!`, undefined, 'bg-chapter');
    const bw = GAME_W - PAD * 2;
    let y = top;

    // The score.
    const sc = warScore(save);
    const lead = sc.us > sc.them;
    this.add.text(PAD, y, `YOUR CHAPTER ${sc.us}`, text.hud(15, lead ? 0xffd75a : PAL.amber));
    this.add.text(GAME_W - PAD, y, `${sc.them} RIVAL`, text.hud(15, lead ? PAL.steel : 0xff8a7a)).setOrigin(1, 0);
    const share = sc.us / Math.max(1, sc.us + sc.them);
    this.add.rectangle(PAD, y + 30, bw, 14, 0x000000).setOrigin(0, 0.5);
    this.add.rectangle(PAD + 1, y + 30, (bw - 2) * share, 10, 0xd9a33a).setOrigin(0, 0.5);
    this.add.rectangle(PAD + 1 + (bw - 2) * share, y + 30, (bw - 2) * (1 - share), 10, 0xa0202a).setOrigin(0, 0.5);
    this.add.text(PAD, y + 44, `${lead ? 'You lead!' : 'They lead. Take back the field!'} Each star: ${STAR_POINTS} points. Week's end: win ${rewardText(WAR_WIN)} + ${WAR_WIN.marks} Marks, lose ${rewardText(WAR_LOSS)} + ${WAR_LOSS.marks} Marks.`, { ...text.body(14, PAL.muted), wordWrap: { width: bw } });
    y += 100;
    const left = attacksLeft(save);
    this.add.text(PAD, y, left ? `${left} OF ${WAR_ATTACKS} STORMS LEFT TODAY` : 'NO STORMS LEFT TODAY · MORE AT DAWN', text.hud(13, left ? PAL.amber : PAL.steel));
    this.add.text(GAME_W - PAD, y, `${w.stars.reduce((a, b) => a + b, 0)}/${FORTS.length * 3} ★`, text.hud(13, 0xffd75a)).setOrigin(1, 0);
    y += 26;

    // The six forts, two by three.
    const cw = (bw - 10) / 2;
    const ch = 158;
    FORTS.forEach((name, i) => {
      const x = PAD + cw / 2 + (i % 2) * (cw + 10);
      const fy = y + Math.floor(i / 2) * (ch + 10);
      const got = w.stars[i];
      const g = fortGarrison(save, i);
      const lead = leaderOf(g.encounter);
      addFrame(this, x, fy + ch / 2, cw, ch);
      const key = this.textures.exists(`enemy-${lead}`) ? `enemy-${lead}` : undefined;
      if (key) {
        const img = this.add.image(x - cw / 2 + 50, fy + 70, key).setDisplaySize(80, 80);
        if (got === 3) img.setTint(0x555555);
      }
      const strong = i === FORTS.length - 1;
      this.add.text(x - cw / 2 + 98, fy + 14, name.toUpperCase(), text.hud(13, strong ? 0xff8a7a : 0xfff1d6));
      this.add.text(x - cw / 2 + 98, fy + 34, ENEMIES[lead]?.name ?? '', { ...text.body(13, PAL.muted), wordWrap: { width: cw - 108 } });
      this.add.text(x - cw / 2 + 98, fy + 64, stars(got), text.hud(20, got ? 0xffd75a : PAL.steel));
      this.add.text(x - cw / 2 + 98, fy + 94, `≈${formatPower(fortTarget(save, i))}`, text.hud(12, PAL.steel));
      const can = left > 0 && got < 3;
      makeButton(this, x, fy + ch - 24, cw - 20, 36, got === 3 ? 'Taken' : 'Storm!', () => can && this.storm(i), { active: can && i === w.stars.findIndex((s) => s < 3), disabled: !can, fontSize: 15, icon: can ? 'blade' : undefined });
    });
    y += 3 * (ch + 10) + 4;
    this.add.text(PAD, y, `Each new star pays ${STAR_REWARD.tithes} Tithes and ${STAR_REWARD.marks} Marks. Three stars: no Sister falls. Played offline: AI Sisters on both sides win points daily.`, { ...text.body(14, PAL.muted), wordWrap: { width: bw } });
    if (w.last && !this.notice) {
      this.notice = w.last.won ? `Last week's war is won, ${w.last.us} to ${w.last.them}! The spoils are yours.` : `Last week's war is lost, ${w.last.us} to ${w.last.them}. Rise and avenge it!`;
      w.last = undefined;
      commit();
    }
    if (this.notice) toast(this, this.notice);
  }

  private storm(fort: number) {
    const save = game.save;
    const name = FORTS[fort];
    const lead = ENEMIES[leaderOf(fortGarrison(save, fort).encounter)]?.name ?? 'the garrison';
    pickParty(
      this,
      save,
      { title: `Storm the ${name}`, sub: `${lead} holds it. Lose no Sister for three stars!`, initial: save.lastParty, confirm: 'Storm!', rec: fortTarget(save, fort) },
      (party) => {
        current.challenge = {
          label: `Chapter War: the ${name}. Take it, Sisters!`,
          make: (rng) => warBattle(save, party, fort, rng),
          finish: (outcome, battle) => {
            const s = starsFor(outcome, battle);
            const r = finishStorm(save, fort, s);
            commit();
            const notice = !s ? `The ${name} holds. Strike again at it!` : r.gained ? `The ${name}: ${stars(s)}! +${r.gained * STAR_POINTS} war points.` : `The ${name}: ${stars(s)}. No better than before.`;
            return { scene: 'War', data: { notice } };
          },
        };
        this.scene.start('Battle');
      },
    );
  }
}
