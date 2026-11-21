import Phaser from 'phaser';
import { FONT, GAME_H, GAME_W, PAL, hex } from '../config';
import { CRUSADERS } from '../data/crusaders';
import { applyCrt } from '../fx/crt';
import { commit, game, resetGame } from '../state/game';
import { saveSettings, settings } from '../state/settings';
import { autoChoose } from '../systems/autoplay';
import type { BattleEvent, Unit } from '../systems/combat';
import { makeBattle, maxHpOf, type RunState } from '../systems/crusade';
import { RARITY_ORDER } from '../systems/gacha';
import { VIGIL_CAP_HOURS, VIGIL_SIZE, claimVigil, cryptOf, ensureVigil, setVigil, vigilCrypts, vigilPending, vigilRates, type VigilClaim, type VigilState } from '../systems/vigil';
import { enemyKey } from '../ui/enemyArt';
import { makeButton } from '../ui/button';
import { CURRENCY_BAR_H, addCurrencyBar } from '../ui/currencyBar';
import { portraitKey } from '../ui/placeholderPortrait';
import { addTabBar } from '../ui/tabBar';
import { PAD, addBackdrop, addFrame, addHeading, addScreenGlow, text } from '../ui/theme';

/** Home screen: the Vigil (idle auto-battle and offline gathering), destinations and the tab bar. */
export class SanctumScene extends Phaser.Scene {
  private refreshBar?: () => void;

  constructor() {
    super('Sanctum');
  }

  create() {
    addScreenGlow(this);
    this.refreshBar = addCurrencyBar(this);
    const top = addHeading(this, 'The Sanctum', CURRENCY_BAR_H + 16);

    const owned = CRUSADERS.filter((c) => game.save.owned[c.id]);
    const fw = GAME_W - PAD * 2;
    const fh = owned.length ? 486 : 420;
    const fx = GAME_W / 2;
    const fy = top + 14 + fh / 2;
    const bottom = fy + fh / 2;

    if (!owned.length) {
      addBackdrop(this, 'bg-altar', fx, fy, fw, fh, { alpha: 0.75, fade: 0.7 });
      addFrame(this, fx, fy, fw, fh);
      this.add
        .text(PAD + 24, bottom - 190, 'The Sanctum stands empty. No Sister keeps the vigil.', text.display(26, 0xfff1d6))
        .setShadow(0, 2, '#000000', 9, false, true);
      this.add.text(PAD + 24, bottom - 146, 'Your first ten Sisters await\nat the Sealed Altar.', { ...text.body(20, 0xd8c2bc), fontStyle: 'italic' });
      makeButton(this, PAD + 24 + 130, bottom - 56, 260, 64, 'Go to the altar', () => this.scene.start('Recruit'), { active: true, icon: 'seal' });
    } else {
      this.drawVigil(fx, fy, fw, fh);
    }

    // Two destination cards, as in the preview
    const dh = owned.length ? 140 : 150;
    const dw = (fw - 12) / 2;
    const dy = bottom + 14 + dh / 2;
    const dest = (x: number, art: string, eyebrow: string, title: string, label: string, to: string) => {
      addBackdrop(this, art, x, dy, dw, dh, { alpha: 0.85, fade: 0.85, fadeColor: 0x140e16 });
      addFrame(this, x, dy, dw, dh, { edge: PAL.armorShadow, ticks: false });
      this.add.text(x - dw / 2 + 12, dy - dh / 2 + 12, eyebrow, text.hud(12, PAL.amber));
      this.add.text(x - dw / 2 + 12, dy - dh / 2 + 30, title, { ...text.display(17, PAL.ivory), wordWrap: { width: dw - 20 } });
      makeButton(this, x - dw / 2 + 12 + 70, dy + dh / 2 - 30, 140, 42, label, () => this.scene.start(to), { fontSize: 18 });
    };
    const firstClear = !game.save.cleared.length;
    dest(PAD + dw / 2, 'bg-hall', 'CRUSADE', 'The Drowned\nOssuary', firstClear ? 'Begin' : 'View crusade', 'Crusade');
    dest(GAME_W - PAD - dw / 2, 'bg-altar', 'RECRUITMENT', 'The Sealed\nAltar', 'Visit altar', 'Recruit');

    // Prototype-only: settings, and wiping the save to replay the first-time flow.
    const linkY = dy + dh / 2 + 34;
    this.textLink(PAD + 4, linkY, 'Settings', () => this.showSettings());
    this.textLink(GAME_W - PAD - 4, linkY, 'Reset save', () => this.confirmReset(), 1);

    addTabBar(this, 'Sanctum');
  }

  /**
   * The Vigil card: the chosen Sisters fight the chosen crypt's horrors on a
   * loop (real combat, played by the Auto player), and below it what the Vigil
   * has gathered since it was last claimed.
   */
  private drawVigil(fx: number, fy: number, fw: number, fh: number) {
    const save = game.save;
    const v = ensureVigil(save, Date.now())!;
    commit();
    const crypt = cryptOf(v);
    const top = fy - fh / 2;
    const left = fx - fw / 2;
    const zoneH = 300;
    const art = this.textures.exists(`bg-${crypt.id}`) ? `bg-${crypt.id}` : 'bg-hall';
    addBackdrop(this, art, fx, top + zoneH / 2, fw, zoneH, { alpha: 0.55, fade: 0.35, fadeColor: 0x140e16 });
    this.add.rectangle(fx, top + zoneH + (fh - zoneH) / 2, fw, fh - zoneH, 0x1b121c);
    this.add.rectangle(fx, top + zoneH, fw, 1, PAL.armorShadow);
    addFrame(this, fx, fy, fw, fh);

    // Header: which crypt, with arrows to change it.
    const crypts = vigilCrypts(save);
    const ci = Math.max(0, crypts.findIndex((c) => c.id === crypt.id));
    this.add.text(left + 18, top + 16, 'THE VIGIL', text.hud(13, PAL.amber));
    this.add.text(left + 18, top + 34, crypt.name, { ...text.display(19, 0xfff1d6) }).setShadow(0, 2, '#000000', 6, false, true);
    if (crypts.length > 1) {
      const shift = (d: number) => () => {
        const next = crypts[(ci + d + crypts.length) % crypts.length];
        this.showClaim(setVigil(save, Date.now(), { crypt: next.id }));
        commit();
        this.scene.restart();
      };
      makeButton(this, left + fw - 84, top + 36, 40, 38, '‹', shift(-1), { fontSize: 20 });
      makeButton(this, left + fw - 36, top + 36, 40, 38, '›', shift(1), { fontSize: 20 });
    }
    this.purged = 0;
    this.purgedText = this.add.text(left + fw - 16, top + zoneH - 14, '', text.hud(12, PAL.muted)).setOrigin(1, 1);

    // Gathering
    const rateText = this.add.text(left + 18, top + zoneH + 14, '', text.body(16, PAL.muted));
    const gotText = this.add.text(left + 18, top + zoneH + 40, '', { ...text.body(19, PAL.amber), fontStyle: '600' });
    const barW = fw - 36;
    this.add.rectangle(left + 18, top + zoneH + 82, barW, 8, PAL.deepShadow).setOrigin(0, 0.5);
    const bar = this.add.rectangle(left + 18, top + zoneH + 82, 1, 8, PAL.amber).setOrigin(0, 0.5);
    const timeText = this.add.text(left + 18, top + zoneH + 96, '', text.hud(12, PAL.steel));
    const claim = makeButton(this, left + 18 + 100, top + fh - 42, 200, 54, 'Claim', () => {
      this.showClaim(claimVigil(save, Date.now()));
      commit();
      this.refreshBar?.();
      update();
    }, { active: true, fontSize: 19, icon: 'tithe' });
    makeButton(this, left + fw - 18 - 100, top + fh - 42, 200, 54, 'Sisters', () => this.choosePartyFor(), { fontSize: 19, icon: 'roster' });

    const update = () => {
      const now = Date.now();
      const r = vigilRates(save, v);
      const p = vigilPending(save, v, now);
      const every = (perHour: number) => (perHour <= 0 ? 'never' : perHour >= 1 ? `${perHour.toFixed(1)}/h` : `every ${Math.round(1 / perHour)}h`);
      rateText.setText(`Strength ${Math.round(r.eff * 100)}% · ${Math.round(r.tithes)} Tithes/h · gear ${every(r.gear)} · Seal ${every(r.seals)}`);
      const parts = [`${p.tithes} Tithes`, ...(p.gear ? [`${p.gear} gear`] : []), ...(p.seals ? [`${p.seals} Seal${p.seals > 1 ? 's' : ''}`] : [])];
      gotText.setText(`Gathered: ${parts.join(' · ')}`);
      bar.setSize(Math.max(1, barW * (p.hours / VIGIL_CAP_HOURS)), 8);
      const hm = (h: number) => `${Math.floor(h)}h ${String(Math.floor((h % 1) * 60)).padStart(2, '0')}m`;
      timeText.setText(p.full ? `FULL · ${VIGIL_CAP_HOURS}H REACHED · CLAIM TO KEEP GATHERING` : `${hm(p.hours).toUpperCase()} OF ${VIGIL_CAP_HOURS}H · GATHERS WHILE YOU ARE AWAY`);
      claim.box.setAlpha(p.tithes > 0 ? 1 : 0.5);
    };
    update();
    this.time.addEvent({ delay: 1000, loop: true, callback: update });

    this.startSkirmish(v, left, top, fw);
  }

  private purged = 0;
  private purgedText?: Phaser.GameObjects.Text;
  private skirmish: Phaser.GameObjects.GameObject[] = [];

  /** One looping fight in the Vigil card: a real Battle played by the Auto player. */
  private startSkirmish(v: VigilState, left: number, top: number, fw: number) {
    const save = game.save;
    this.skirmish.forEach((o) => o.destroy());
    this.skirmish = [];
    const crypt = cryptOf(v);
    const party = v.party.filter((id) => save.owned[id]);
    if (!party.length) {
      this.skirmish.push(this.add.text(left + fw / 2, top + 160, 'No Sister keeps this vigil.\nTap Sisters to post a watch.', { ...text.body(19, PAL.muted), align: 'center' }).setOrigin(0.5));
      return;
    }
    const run = { crypt, map: [], party, hp: {}, floor: 0, at: 0, path: [], resolved: false, relics: [], tithes: 0, seals: 0, heresy: 0, loot: [] } as RunState;
    for (const id of party) run.hp[id] = maxHpOf(save, run, id);
    const pool = [...crypt.early, ...crypt.late];
    const battle = makeBattle(save, run, pool[Math.floor(Math.random() * pool.length)]);

    const views = new Map<string, { img: Phaser.GameObjects.Image; bar: Phaser.GameObjects.Rectangle; x: number; y: number }>();
    const size = 62;
    const place = (units: Unit[], y: number) => {
      const n = units.length;
      units.forEach((u, i) => {
        const x = left + fw / 2 + (i - (n - 1) / 2) * 92;
        const key = u.side === 'party' ? portraitKey(u.ref) : enemyKey(u.ref);
        const frame = this.add.rectangle(x, y, size + 4, size + 4, 0x110b13, 0.8).setStrokeStyle(1, u.side === 'party' ? PAL.amber : PAL.oxblood);
        const img = this.add.image(x, y, key).setDisplaySize(size, size);
        const back = this.add.rectangle(x - size / 2, y + size / 2 + 8, size, 5, PAL.deepShadow).setOrigin(0, 0.5);
        const bar = this.add.rectangle(x - size / 2, y + size / 2 + 8, size, 5, u.side === 'party' ? 0x7a9a5a : PAL.oxblood).setOrigin(0, 0.5);
        this.skirmish.push(frame, img, back, bar);
        views.set(u.uid, { img, bar, x, y });
      });
    };
    // Party by rank, rank 1 nearest the foe.
    const byRank = (side: 'party' | 'enemy') => battle.units.filter((u) => u.side === side).sort((a, b) => a.rank - b.rank);
    place(byRank('enemy'), top + 110);
    place(byRank('party'), top + 220);

    const float = (uid: string, label: string, color: number) => {
      const vw = views.get(uid);
      if (!vw) return;
      const t = this.add.text(vw.x, vw.y - 10, label, { ...text.hud(16, color), stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5);
      this.tweens.add({ targets: t, y: vw.y - 44, alpha: 0, duration: 900, onComplete: () => t.destroy() });
    };
    const sync = () => {
      for (const u of battle.units) {
        const vw = views.get(u.uid);
        if (!vw) continue;
        vw.bar.setSize(Math.max(0, (size * u.hp) / u.maxHp), 5);
        if (u.hp <= 0) vw.img.setTint(0x333333).setAlpha(0.5);
      }
    };
    const show = (events: BattleEvent[]) => {
      for (const e of events) {
        if (e.type === 'damage') float(e.uid, `-${e.amount}`, e.crit ? PAL.amber : PAL.ivory);
        else if (e.type === 'heal') float(e.uid, `+${e.amount}`, 0x9ad08a);
        else if (e.type === 'shield') float(e.uid, `+${e.amount}`, 0x8fb6d8);
        else if (e.type === 'death' && battle.get(e.uid)?.side === 'enemy') this.purged += 1;
      }
      this.purgedText?.setText(this.purged ? `FOES PURGED: ${this.purged}` : '');
      sync();
    };

    const timer = this.time.addEvent({
      delay: 620,
      loop: true,
      callback: () => {
        const t = battle.nextTurn();
        show(t.events);
        if (t.outcome || !t.actor) {
          timer.remove();
          const won = t.outcome === 'victory';
          const msg = this.add
            .text(left + fw / 2, top + 165, won ? 'PURGED. THE VIGIL HOLDS.' : 'THE SISTERS FALL BACK AND PRAY.', { ...text.hud(15, won ? PAL.amber : PAL.oxblood), stroke: '#000000', strokeThickness: 4 })
            .setOrigin(0.5);
          this.skirmish.push(msg);
          this.time.delayedCall(1400, () => this.startSkirmish(v, left, top, fw));
          return;
        }
        const actor = t.actor;
        const pick = actor.side === 'party' ? autoChoose(battle, actor) : battle.enemyChoose(actor);
        const events = battle.act(actor, pick.skill, pick.target);
        const vw = views.get(actor.uid);
        if (vw) this.tweens.add({ targets: vw.img, y: vw.y + (actor.side === 'party' ? -10 : 10), duration: 110, yoyo: true });
        show(events);
      },
    });
  }

  /** A short notice of what a claim paid. */
  private showClaim(c?: VigilClaim) {
    if (!c || (!c.tithes && !c.seals && !c.gear.length)) return;
    const parts = [`+${c.tithes} Tithes`, ...(c.seals ? [`+${c.seals} Seal${c.seals > 1 ? 's' : ''}`] : []), ...c.gear.map((g) => `${g.name} (${g.rarity})`)];
    if (c.melted) parts.push(`armory full: +${c.melted} Tithes`);
    const box = this.add.container(0, 0).setDepth(30);
    const t = this.add.text(GAME_W / 2, 150, `The Vigil yields:\n${parts.join('\n')}`, { ...text.body(19, PAL.ivory), align: 'center', wordWrap: { width: GAME_W - 80 } }).setOrigin(0.5, 0);
    const bg = this.add.rectangle(GAME_W / 2, 150 + t.height / 2, t.width + 40, t.height + 28, 0x1b121c, 0.97).setStrokeStyle(1, PAL.amber);
    box.add([bg, t]);
    this.tweens.add({ targets: box, alpha: 0, delay: 2600, duration: 600, onComplete: () => box.destroy() });
  }

  /** Pick up to four Sisters for the Vigil. Changing the watch claims what was gathered. */
  private choosePartyFor() {
    const save = game.save;
    const v = save.vigil!;
    const picked = [...v.party];
    const layer = this.add.container(0, 0).setDepth(20);
    const owned = CRUSADERS.filter((c) => save.owned[c.id]).sort((a, b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity));
    const draw = () => {
      layer.removeAll(true);
      layer.add(this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.95).setInteractive());
      layer.add(addFrame(this, GAME_W / 2, GAME_H / 2, GAME_W - 24, GAME_H - 40, { fill: 0x241925 }));
      layer.add(this.add.text(GAME_W / 2, 66, 'POST THE WATCH', text.display(22, PAL.ivory)).setOrigin(0.5));
      layer.add(this.add.text(GAME_W / 2, 100, `Choose up to ${VIGIL_SIZE} Sisters. They may still crusade.`, text.body(17, PAL.muted)).setOrigin(0.5));
      const cols = 4;
      const cell = 112;
      owned.slice(0, 24).forEach((c, i) => {
        const x = GAME_W / 2 + ((i % cols) - (cols - 1) / 2) * cell;
        const y = 180 + Math.floor(i / cols) * (cell + 8);
        const on = picked.includes(c.id);
        const frame = this.add.rectangle(x, y, 100, 100, 0x150e17).setStrokeStyle(on ? 3 : 1, on ? PAL.amber : PAL.armorShadow);
        const img = this.add.image(x, y, portraitKey(c.id)).setDisplaySize(94, 94).setAlpha(on ? 1 : 0.55);
        const name = this.add.text(x, y + 40, c.name.split(' ')[0], { ...text.body(15, on ? PAL.amber : PAL.ivory), stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5);
        frame.setInteractive({ useHandCursor: true }).on('pointerup', () => {
          const at = picked.indexOf(c.id);
          if (at >= 0) picked.splice(at, 1);
          else if (picked.length < VIGIL_SIZE) picked.push(c.id);
          draw();
        });
        layer.add([frame, img, name]);
      });
      const done = makeButton(this, GAME_W / 2 + 120, GAME_H - 62, 220, 60, 'Keep watch', () => {
        this.showClaim(setVigil(save, Date.now(), { party: picked }));
        commit();
        this.scene.restart();
      }, { active: picked.length > 0, disabled: !picked.length, fontSize: 19 });
      const back = makeButton(this, GAME_W / 2 - 120, GAME_H - 62, 220, 60, 'Back', () => layer.destroy(), { fontSize: 19 });
      layer.add([...done.all, ...back.all]);
    };
    draw();
  }

  /** The preview's underlined gold text button. */
  private textLink(x: number, y: number, label: string, onTap: () => void, originX = 0) {
    const t = this.add.text(x, y, label, text.body(20, PAL.amber)).setOrigin(originX, 0.5);
    const line = this.add.rectangle(t.x - t.width * originX, y + 13, t.width, 1, 0x926642).setOrigin(0, 0.5);
    t.setInteractive({ useHandCursor: true, hitArea: new Phaser.Geom.Rectangle(-10, -14, t.width + 20, t.height + 28), hitAreaCallback: Phaser.Geom.Rectangle.Contains });
    t.on('pointerup', onTap);
    return [t, line];
  }

  private confirmReset() {
    const layer = this.add.container(0, 0).setDepth(20);
    const style = { fontFamily: FONT, color: hex(PAL.ivory), align: 'center' };
    layer.add(this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.9).setInteractive());
    layer.add(addFrame(this, GAME_W / 2, 480, GAME_W - 40, 440, { fill: 0x241925 }));
    layer.add(
      this.add
        .text(GAME_W / 2, 360, 'Burn the records?\n\nSisters, Seals, Tithes and every\ncrusade will be forgotten.', { ...style, fontSize: '22px' })
        .setOrigin(0.5),
    );
    const yes = makeButton(this, GAME_W / 2, 520, 300, 76, 'Burn it all', () => {
      resetGame();
      this.scene.restart();
    }, { active: true });
    const no = makeButton(this, GAME_W / 2, 620, 300, 76, 'Keep my progress', () => layer.destroy());
    layer.add([...yes.all, ...no.all]);
  }

  private showSettings() {
    const layer = this.add.container(0, 0).setDepth(20);
    const style = { fontFamily: FONT, color: hex(PAL.ivory), align: 'center' };
    const draw = () => {
      layer.removeAll(true);
      layer.add(this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.88).setInteractive());
      layer.add(addFrame(this, GAME_W / 2, 460, GAME_W - 40, 640, { fill: 0x241925 }));
      layer.add(this.add.text(GAME_W / 2, 200, 'Settings', text.display(30, PAL.amber)).setOrigin(0.5));
      layer.add(this.add.text(GAME_W / 2, 280, 'CRT screen effect', { ...style, fontSize: '22px' }).setOrigin(0.5));
      const toggle = (on: boolean) => () => {
        settings.crt = on;
        saveSettings();
        applyCrt(this);
        draw();
      };
      for (const [i, on] of [true, false].entries()) {
        const b = makeButton(this, GAME_W / 2 + (i ? 90 : -90), 340, 160, 64, on ? 'On' : 'Off', toggle(on), { active: settings.crt === on });
        layer.add(b.all);
      }
      layer.add(this.add.text(GAME_W / 2, 430, 'Strength', { ...style, fontSize: '22px', color: hex(settings.crt ? PAL.ivory : PAL.steel) }).setOrigin(0.5));
      const levels: [string, number][] = [['Subtle', 0.35], ['Standard', 0.6], ['Heavy', 1]];
      levels.forEach(([label, v], i) => {
        const b = makeButton(
          this,
          GAME_W / 2 + (i - 1) * 168,
          490,
          156,
          64,
          label,
          () => {
            settings.crtStrength = v;
            saveSettings();
            applyCrt(this);
            draw();
          },
          { active: settings.crt && settings.crtStrength === v, disabled: !settings.crt, fontSize: 19 },
        );
        layer.add(b.all);
      });
      layer.add(
        this.add
          .text(GAME_W / 2, 590, 'Scanlines, colour bleed and screen curve.\nPortrait art is never changed underneath.', { ...style, fontSize: '16px', color: hex(PAL.steel) })
          .setOrigin(0.5),
      );
      const close = makeButton(this, GAME_W / 2, 720, 240, 72, 'Done', () => layer.destroy());
      layer.add(close.all);
    };
    draw();
  }
}
