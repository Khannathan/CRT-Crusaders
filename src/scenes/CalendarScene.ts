import Phaser from 'phaser';
import { GAME_H, GAME_W, PAL } from '../config';
import { CRUSADERS } from '../data/crusaders';
import { blessingsWeek, calendar, shortDate, type EventKind } from '../systems/calendar';
import { timeLeft } from '../systems/limited';
import { modeScreen } from '../ui/modeScreen';
import { portraitKey } from '../ui/placeholderPortrait';
import { addScrollArea } from '../ui/scroll';
import { TAB_BAR_H } from '../ui/tabBar';
import { PAD, fitLine, text } from '../ui/theme';

const KIND_COLOR: Record<EventKind, number> = { saint: PAL.amber, feast: 0xd98a4a, inquisition: PAL.damage, pass: PAL.violet, weekly: PAL.steel };
const KIND_TAG: Record<EventKind, string> = { saint: 'LIMITED', feast: 'FEAST', inquisition: 'INQUISITION', pass: 'PASS', weekly: 'WEEKLY' };
/** Short names for the blessing strip's narrow columns. */
const SHORT: [RegExp, string][] = [[/Crusade spoils/, 'Crusade'], [/Bell Tower spoils/, 'Tower'], [/Relic Trial spoils/, 'Trials'], [/Vigil gathering/, 'Vigil'], [/Errand spoils/, 'Errands'], [/Battle EXP/, 'EXP'], [/Saint's Fragments/, 'Fragments']];
const short = (s: string) => SHORT.reduce((t, [re, w]) => t.replace(re, w), s);

/** The Calendar: this week's blessings, then four weeks of Saints, Feasts, Inquisitions and seasons. */
export class CalendarScene extends Phaser.Scene {
  private scroll = 0;

  constructor() {
    super('Calendar');
  }

  init(data: { scroll?: number }) {
    this.scroll = data?.scroll ?? 0;
  }

  create() {
    const now = Date.now();
    const { top } = modeScreen(this, 'The Calendar', 'Know what comes. Save your Seals. Strike on the day!');
    const bw = GAME_W - PAD * 2;

    // This week's blessings, today lit.
    const days = blessingsWeek(now);
    const cw = bw / 7;
    const stripH = 106;
    const today = new Date(now).toDateString();
    days.forEach((d, i) => {
      const x = PAD + cw * i + cw / 2;
      const on = new Date(d.day).toDateString() === today;
      this.add.rectangle(x, top + stripH / 2, cw - 4, stripH, on ? 0x2c1a24 : 0x1b131d).setStrokeStyle(on ? 2 : 1, on ? PAL.amber : PAL.armorShadow);
      this.add.text(x, top + 8, new Date(d.day).toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase(), text.hud(11, on ? PAL.amber : PAL.steel)).setOrigin(0.5, 0);
      this.add
        .text(x, top + 26, d.boosts.map(short).join('\n'), { ...text.body(11, on ? 0xfff1d6 : PAL.muted), align: 'center', lineSpacing: -3, wordWrap: { width: cw - 6 } })
        .setOrigin(0.5, 0);
    });

    const listTop = top + stripH + 10;
    const list = addScrollArea(this, listTop, GAME_H - TAB_BAR_H - 6, { start: this.scroll, onScroll: (y) => (this.scroll = y) });
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => (list.content.add(o), o);
    let y = listTop + 4;
    calendar(now).forEach((week, w) => {
      const label = w === 0 ? 'THIS WEEK' : w === 1 ? 'NEXT WEEK' : `IN ${w} WEEKS`;
      add(this.add.text(PAD + 4, y, `${label}  ·  ${shortDate(week.starts).toUpperCase()}`, text.hud(13, w === 0 ? PAL.amber : PAL.steel)));
      y += 26;
      for (const e of week.events) {
        const saint = e.kind === 'saint' ? CRUSADERS.find((c) => e.title.endsWith(c.name)) : undefined;
        const art = saint && this.textures.exists(portraitKey(saint.id)) ? portraitKey(saint.id) : undefined;
        const h = e.kind === 'saint' ? 84 : 66;
        add(this.add.rectangle(GAME_W / 2, y + h / 2, bw, h, e.running ? 0x1b131d : 0x241722).setStrokeStyle(1, e.kind === 'saint' && !e.running ? PAL.amber : PAL.armorShadow));
        add(this.add.rectangle(PAD + 3, y + h / 2, 5, h - 2, KIND_COLOR[e.kind]));
        const tx = PAD + 16 + (art ? h - 8 + 8 : 0);
        if (art) add(this.add.image(PAD + 14 + (h - 8) / 2, y + h / 2, art).setDisplaySize(h - 10, h - 10));
        const when = e.running ? (e.ends ? `UNTIL ${shortDate(e.ends).toUpperCase()} · ${timeLeft(e.ends, now).toUpperCase()} LEFT` : 'RUNNING') : `${shortDate(e.at).toUpperCase()}${e.ends && e.kind !== 'weekly' ? ` · ${Math.round((e.ends - e.at) / 864e5)} DAYS` : ''}`;
        add(this.add.text(tx, y + 8, `${KIND_TAG[e.kind]}  ·  ${when}`, text.hud(10, KIND_COLOR[e.kind])));
        add(fitLine(this.add.text(tx, y + 22, e.title, text.body(18, 0xfff1d6)).setFontStyle('600'), GAME_W - PAD - tx - 10));
        add(this.add.text(tx, y + 44, e.sub, { ...text.body(14, PAL.muted), wordWrap: { width: GAME_W - PAD - tx - 10 } }));
        y += h + 6;
      }
      y += 10;
    });
    list.fit(y + 10);
  }
}
