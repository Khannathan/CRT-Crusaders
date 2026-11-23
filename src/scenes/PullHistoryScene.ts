import Phaser from 'phaser';
import { GAME_H, GAME_W, PAL } from '../config';
import { RARITY_COLOR } from '../data/classes';
import { CRUSADERS } from '../data/crusaders';
import { game } from '../state/game';
import { PULL_LOG_MAX } from '../systems/gacha';
import { modeScreen } from '../ui/modeScreen';
import { portraitKey } from '../ui/placeholderPortrait';
import { addScrollArea } from '../ui/scroll';
import { holdForCard } from '../ui/sisterCard';
import { TAB_BAR_H } from '../ui/tabBar';
import { PAD, text } from '../ui/theme';

/** Every recent oath, newest first, with honest counts. */
export class PullHistoryScene extends Phaser.Scene {
  constructor() {
    super('PullHistory');
  }

  create() {
    const { top } = modeScreen(this, 'Oath Record', `Your last ${PULL_LOG_MAX} pulls, newest first.`, 'Recruit');
    const log = [...(game.save.pullLog ?? [])].reverse();
    const count = (r: string) => log.filter((p) => CRUSADERS.find((c) => c.id === p.id)?.rarity === r).length;
    const sinceUR = log.findIndex((p) => CRUSADERS.find((c) => c.id === p.id)?.rarity === 'UR');
    const summary = log.length
      ? `${log.length} pulls · UR ${count('UR')} · SSR ${count('SSR')} · SR ${count('SR')} · R ${count('R')}\n${sinceUR < 0 ? 'No UR in this record yet' : sinceUR === 0 ? 'Your last pull was a UR' : `${sinceUR} pulls since your last UR`}`
      : 'No pulls recorded yet. Oaths sworn from now on appear here.';
    this.add.text(PAD, top, summary, { ...text.body(17, PAL.muted), lineSpacing: 4 });

    const listTop = top + 62;
    const bottom = GAME_H - TAB_BAR_H - 8;
    const list = addScrollArea(this, listTop, bottom);
    const rowH = 58;
    log.forEach((p, i) => {
      const c = CRUSADERS.find((x) => x.id === p.id);
      if (!c) return;
      const y = listTop + i * rowH + rowH / 2;
      const col = RARITY_COLOR[c.rarity];
      const bg = this.add.rectangle(GAME_W / 2, y, GAME_W - PAD * 2, rowH - 6, c.rarity === 'UR' || c.rarity === 'SSR' ? 0x2a1c22 : 0x1b121c).setStrokeStyle(1, col);
      const img = this.add.image(PAD + 28, y, portraitKey(c.id)).setDisplaySize(44, 44);
      const name = this.add.text(PAD + 60, y - 12, c.name, text.body(17, PAL.ivory)).setOrigin(0, 0.5);
      const sub = this.add.text(PAD + 60, y + 11, `${c.rarity} · ${c.order}${p.isNew ? '  ·  NEW' : ''}`, text.body(14, p.isNew ? PAL.amber : col)).setOrigin(0, 0.5);
      const when = new Date(p.at);
      const date = this.add
        .text(GAME_W - PAD - 10, y, `${when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}\n${when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`, { ...text.hud(12, PAL.steel), align: 'right' })
        .setOrigin(1, 0.5);
      list.content.add([bg, img, name, sub, date]);
      holdForCard(this, img, c.id);
    });
    list.fit(listTop + log.length * rowH + 8);
    if (!log.length) this.add.text(GAME_W / 2, listTop + 80, '—', text.body(20, PAL.steel)).setOrigin(0.5);
  }
}
