import Phaser from 'phaser';
import { GAME_W, PAL } from '../config';
import { ENCOUNTERS, ENEMIES } from '../data/enemies';
import { commit, game } from '../state/game';
import { current } from '../state/run';
import { partyPower, formatPower } from '../systems/power';
import {
  BOSS_REWARD,
  CLEAR_CHEST,
  RAID_BOSSES,
  RAID_SQUADS,
  SQUAD_SIZE,
  beginDelve,
  delveBattle,
  finishDelve,
  raidBlock,
  raidCrypts,
  raidOf,
  raidTarget,
  setSquad,
  type DelveStep,
} from '../systems/raid';
import { makeButton } from '../ui/button';
import { modeScreen, toast } from '../ui/modeScreen';
import { pickParty } from '../ui/partyPicker';
import { portraitKey } from '../ui/placeholderPortrait';
import { PAD, addFrame, text } from '../ui/theme';

const fmt = (n: number) => n.toLocaleString('en-US');
const leaderOf = (encounter: string) => ENCOUNTERS[encounter]?.[0] ?? encounter;

/** The Nightmare Raid: three bosses, three Squads, wounds on the boss carry. */
export class RaidScene extends Phaser.Scene {
  private notice?: string;

  constructor() {
    super('Raid');
  }

  init(data: { notice?: string }) {
    this.notice = data?.notice;
  }

  create() {
    const save = game.save;
    const r = raidOf(save);
    const { top } = modeScreen(this, 'Nightmare Raid', 'Three bosses. Three Squads. Its wounds carry.', 'Modes', 'bg-abyssal-ossuary');
    const bw = GAME_W - PAD * 2;
    const d = r.delve;
    this.add.text(PAD, top, d ? `DELVING · BOSS ${d.boss + 1} OF ${RAID_BOSSES}` : r.used ? 'TODAY\'S DELVE IS DONE' : 'ONE DELVE TODAY', text.hud(14, PAL.amber));
    this.add.text(GAME_W - PAD, top, `WEEK BEST ${r.best}/${RAID_BOSSES}${r.cleared ? ' · CLEARED' : ''}`, text.hud(13, r.best ? PAL.amber : PAL.steel)).setOrigin(1, 0);
    let y = top + 28;

    // The three bosses.
    const crypts = raidCrypts();
    const cw = (bw - 16) / 3;
    crypts.forEach((c, i) => {
      const x = PAD + cw / 2 + i * (cw + 8);
      const slain = d ? i < d.boss : false;
      const now = d && i === d.boss;
      addFrame(this, x, y + 90, cw, 180);
      const key = `enemy-${leaderOf(c.boss)}`;
      if (this.textures.exists(key)) {
        const img = this.add.image(x, y + 64, key).setDisplaySize(cw - 24, cw - 24);
        if (slain) img.setTint(0x444444);
      }
      this.add.text(x, y + 126, (ENEMIES[leaderOf(c.boss)]?.name ?? c.bossName).toUpperCase(), { ...text.hud(11, now ? 0xff8a7a : slain ? PAL.steel : 0xfff1d6), align: 'center', wordWrap: { width: cw - 12 } }).setOrigin(0.5, 0);
      const hp = slain ? 0 : now ? d!.hp : 1;
      this.add.rectangle(x - (cw - 24) / 2, y + 166, cw - 24, 8, 0x000000).setOrigin(0, 0.5);
      this.add.rectangle(x - (cw - 24) / 2, y + 166, (cw - 24) * hp, 6, 0xc0392b).setOrigin(0, 0.5);
      if (slain) this.add.text(x, y + 64, 'SLAIN', text.hud(16, 0xffd75a)).setOrigin(0.5);
      this.add.text(x, y + 186, `≈${formatPower(raidTarget(save, i))}`, text.hud(11, PAL.steel)).setOrigin(0.5, 0);
    });
    y += 214;

    // The Squads.
    for (let i = 0; i < RAID_SQUADS; i++) {
      const sq = r.squads[i];
      const spent = d ? i < d.squad : false;
      const up = d?.squad === i;
      addFrame(this, GAME_W / 2, y + 44, bw, 88);
      this.add.text(PAD + 12, y + 8, `SQUAD ${'I'.repeat(i + 1)}${up ? ' · FIGHTING' : spent ? ' · SPENT' : ''}`, text.hud(12, up ? 0xffd75a : spent ? PAL.steel : PAL.amber));
      this.add.text(PAD + 12, y + 26, sq.length ? `Power ${formatPower(partyPower(save, sq))}` : 'Empty', text.body(13, PAL.muted));
      sq.forEach((id, k) => {
        const img = this.add.image(PAD + 150 + k * 58, y + 46, portraitKey(id)).setDisplaySize(52, 52);
        if (spent) img.setTint(0x555555);
      });
      if (!d) {
        makeButton(this, GAME_W - PAD - 46, y + 44, 72, 44, 'Edit', () => this.edit(i), { fontSize: 15 });
      }
      y += 96;
    }

    // Begin or go on.
    const block = raidBlock(save);
    const label = d ? `Fight on: Squad ${'I'.repeat(d.squad + 1)} vs boss ${d.boss + 1}` : block ?? 'Begin the delve!';
    makeButton(this, GAME_W / 2, y + 34, bw, 62, label, () => this.fight(), { active: !block, disabled: !!block, icon: 'blade' });
    y += 76;
    const rewards = BOSS_REWARD.map((b, i) => `Boss ${i + 1}: ${fmt(b.tithes)} Tithes, ${b.gilt} Gilt, Canon`).join('\n');
    this.add.text(PAD, y, `${rewards}\nAll three, once a week: ${CLEAR_CHEST.seals} Seals, ${CLEAR_CHEST.gilt} Gilt, a Canon Seal.`, { ...text.body(14, PAL.muted), wordWrap: { width: bw } });
    if (this.notice) toast(this, this.notice);
  }

  private edit(i: number) {
    const save = game.save;
    const r = raidOf(save);
    const others = new Set(r.squads.filter((_, j) => j !== i).flat());
    pickParty(
      this,
      save,
      { title: `Squad ${'I'.repeat(i + 1)}`, sub: 'No Sister may stand in two Squads.', initial: r.squads[i], max: SQUAD_SIZE, allow: (c) => !others.has(c.id), why: 'In another Squad', confirm: 'Form the Squad' },
      (ids) => {
        setSquad(save, i, ids);
        commit();
        this.scene.restart({});
      },
    );
  }

  private fight() {
    const save = game.save;
    if (!beginDelve(save)) return;
    commit();
    const d = raidOf(save).delve!;
    const boss = raidCrypts()[d.boss];
    current.challenge = {
      label: `The Nightmare Raid: ${ENEMIES[leaderOf(boss.boss)]?.name ?? boss.bossName}. Squad ${'I'.repeat(d.squad + 1)}, hold nothing back!`,
      make: (rng) => delveBattle(save, rng)!,
      finish: (outcome, battle) => {
        const st = finishDelve(save, outcome, battle);
        commit();
        return { scene: 'Raid', data: { notice: this.stepText(st) } };
      },
    };
    this.scene.start('Battle');
  }

  private stepText(st: DelveStep) {
    if (st.slain) return `Boss slain! +${fmt(st.reward!.tithes)} Tithes${st.chest ? '\nThe raid is cleared! The week\'s chest is yours.' : st.over ? '' : '\nThe Squad goes on.'}`;
    return st.over ? `Every Squad has fallen. The boss keeps ${Math.round(st.hp * 100)}% of its life.` : `The Squad falls, but the boss bleeds: ${Math.round(st.hp * 100)}% left. The next Squad takes over!`;
  }
}
