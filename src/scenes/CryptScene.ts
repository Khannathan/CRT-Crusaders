import Phaser from 'phaser';
import { TAB_BAR_H, addTabBar } from '../ui/tabBar';
import { FONT, GAME_H, GAME_W, PAL, hex } from '../config';
import { RARITY_COLOR } from '../data/classes';
import { CRUSADERS } from '../data/crusaders';
import { ENCOUNTERS, ENEMIES } from '../data/enemies';
import { EVENTS } from '../data/events';
import { FAMILY_BONUS, FAMILY_COLOR, FAMILY_NAME, relicById, type RelicFamily } from '../data/relics';
import { commit, game } from '../state/game';
import { current } from '../state/run';
import {
  REWARDS,
  ROMAN,
  SANCTUARY_HEAL,
  chooseEvent,
  choices,
  cryptCleared,
  currentNode,
  enterNode,
  finishRun,
  maxHpOf,
  relicOffer,
  rewardMult,
  shrine,
  miracle,
  familyCounts,
  MIRACLE_SEALS,
  takeRelic,
  type MapNode,
  type NodeKind,
} from '../systems/crusade';
import { makeButton } from '../ui/button';
import { nodeIconKey } from '../ui/icons';
import { portraitKey } from '../ui/placeholderPortrait';
import { addArt, addScreenGlow, text as txt } from '../ui/theme';
import { addScrollArea } from '../ui/scroll';
import { holdForCard } from '../ui/sisterCard';

const MAP_TOP = 96;
const MAP_BOTTOM = 486;
/** Height of one floor on the map; a long crypt scrolls (drag or wheel). */
const FLOOR_H = 78;
const KIND_NAME: Record<NodeKind, string> = {
  fight: 'Fight',
  elite: 'Elite fight',
  event: 'Temptation',
  shrine: 'Shrine',
  reliquary: 'Reliquary',
  boss: 'Boss',
  miracle: 'Miracle',
};

/** The crypt map: pick a path floor by floor, from the bottom up to the boss. */
export class CryptScene extends Phaser.Scene {
  private selected?: number;
  private info: Phaser.GameObjects.GameObject[] = [];
  /** The scrolling map, so the selection ring moves with it. */
  private mapLayer?: Phaser.GameObjects.Container;

  constructor() {
    super('Crypt');
  }

  create() {
    const run = current.run;
    if (!run) {
      this.scene.start('Crusade');
      return;
    }
    if (cryptCleared(run)) {
      this.finish('victory');
      return;
    }
    this.selected = undefined;
    this.info = [];
    addScreenGlow(this);
    const style = { fontFamily: FONT, color: hex(PAL.ivory), align: 'center' };
    this.add.text(GAME_W / 2, 30, run.crypt.name.toUpperCase() + (run.heresy ? `  ·  HERESY ${ROMAN[run.heresy - 1]}` : ''), txt.display(run.heresy ? 20 : 24, run.heresy ? 0xe58a8a : PAL.ivory)).setOrigin(0.5);
    this.add
      .text(GAME_W / 2, 56, `Earned so far: ${run.tithes} Tithes · ${run.seals} Seals`, { ...style, fontSize: '18px', color: hex(PAL.muted) })
      .setOrigin(0.5);

    this.drawMap();
    this.drawParty();
    this.drawBuild();
    addTabBar(this, 'Crusade');
    makeButton(this, GAME_W / 2, GAME_H - TAB_BAR_H - 28, 260, 48, 'Retreat (keep spoils)', () => this.finish('retreat'), { fontSize: 17 });

    // Resume whatever the current node still needs.
    const node = currentNode(run);
    if (run.pendingRelic) this.showRelics();
    else if (node?.kind === 'event') this.showEvent(node);
    else if (node?.kind === 'reliquary') this.showRelics();
    else if (node?.encounter) this.scene.start('Battle');
    else if (run.sanctuary) this.showSanctuary(run.sanctuary);
    else this.prompt(choices(run).length ? 'Choose your path through the dark!' : '');
  }

  /** Between acts: the Sisters have been healed; go deeper or leave with everything. */
  private showSanctuary(act: number) {
    const run = current.run!;
    const layer = this.overlay();
    const acts = Math.max(...run.map.flat().map((n) => n.act ?? 1));
    const next = run.crypt.actNames?.[act - 1];
    const style = { fontFamily: FONT, color: hex(PAL.ivory), align: 'center', wordWrap: { width: GAME_W - 70 } };
    layer.add(this.add.text(GAME_W / 2, 210, `ACT ${ROMAN[act - 1]} PURIFIED`, txt.display(28, PAL.amber)).setOrigin(0.5));
    layer.add(
      this.add
        .text(
          GAME_W / 2,
          330,
          `A Sanctuary! Every Sister standing heals ${Math.round(SANCTUARY_HEAL * 100)}%.\n\nAct ${ROMAN[act]} of ${acts}${next ? `, ${next},` : ''} lies below. Its foes are stronger.\n\nSpoils banked, safe even if you fall: ${run.tithes} Tithes, ${run.seals} Seals, ${run.loot.length} gear.`,
          { ...style, fontSize: '21px', lineSpacing: 4 },
        )
        .setOrigin(0.5),
    );
    const go = makeButton(this, GAME_W / 2, 520, GAME_W - 100, 80, `Descend to Act ${ROMAN[act]}`, () => {
      run.sanctuary = undefined;
      commit();
      this.scene.restart();
    }, { active: true, fontSize: 22 });
    const leave = makeButton(this, GAME_W / 2, 620, GAME_W - 100, 64, 'Leave with your spoils', () => this.finish('retreat'), { fontSize: 19 });
    layer.add([...go.all, ...leave.all]);
  }

  /** Floor spacing: the whole map fits when it can, else FLOOR_H a floor and it scrolls. */
  private floorH() {
    const floors = current.run!.map.length;
    return Math.max(FLOOR_H, (MAP_BOTTOM - MAP_TOP - 40) / Math.max(1, floors - 1));
  }

  /** Map position, with the boss at the top and the first floor at the bottom (before scrolling). */
  private nodePos(floor: number, i: number) {
    const run = current.run!;
    const floors = run.map.length;
    const width = run.map[floor].length;
    const y = MAP_TOP + 26 + (floors - 1 - floor) * this.floorH();
    const x = GAME_W / 2 + (i - (width - 1) / 2) * 150;
    return { x, y };
  }

  private drawMap() {
    const run = current.run!;
    const open = choices(run);
    const floors = run.map.length;
    // Start scrolled so the next floor to choose sits low in the window.
    const focus = this.nodePos(Math.min(floors - 1, run.floor + 1), 0).y;
    const map = addScrollArea(this, MAP_TOP, MAP_BOTTOM, { start: Math.min(0, MAP_BOTTOM - 60 - focus) });
    this.mapLayer = map.content;
    const before = this.children.list.length;
    const g = this.add.graphics();
    run.map.forEach((floor, f) =>
      floor.forEach((node, i) => {
        const a = this.nodePos(f, i);
        for (const j of node.next) {
          const b = this.nodePos(f + 1, j);
          const fromHere = f === run.floor && i === run.at && run.resolved && open.includes(j);
          const walked = run.path[f] === i && run.path[f + 1] === j;
          g.lineStyle(fromHere || walked ? 4 : 2, fromHere ? PAL.amber : walked ? PAL.bronze : PAL.armorShadow, fromHere || walked ? 1 : 0.7);
          g.lineBetween(a.x, a.y, b.x, b.y);
        }
      }),
    );

    run.map.forEach((floor, f) =>
      floor.forEach((node, i) => {
        const { x, y } = this.nodePos(f, i);
        const here = f === run.floor && i === run.at;
        const passed = run.path[f] === i && (f < run.floor || run.resolved);
        const available = (run.floor === f - 1 && open.includes(i)) || (run.floor < 0 && f === 0 && open.includes(i));
        const size = node.kind === 'boss' ? 64 : 46;
        if (available) {
          const ring = this.add.circle(x, y, size / 2 + 6).setStrokeStyle(3, PAL.amber);
          this.tweens.add({ targets: ring, alpha: 0.3, duration: 600, yoyo: true, repeat: -1 });
        }
        if (here) this.add.circle(x, y, size / 2 + 6).setStrokeStyle(4, PAL.ivory);
        const img = this.add.image(x, y, nodeIconKey(node.kind)).setDisplaySize(size, size);
        if (!available && !here) img.setAlpha(passed ? 0.8 : f > run.floor ? 0.55 : 0.25);
        if (available) map.tap(img, () => this.select(i));
        // Any room further ahead can be looked at (not entered) with a tap.
        else if (f > run.floor && !here) map.tap(img, () => this.peek(f, i));
        // Bosses carry their names; a Warden is a smaller boss mid-act.
        if (node.kind === 'boss' && node.name) {
          this.add.text(x + size / 2 + 12, y, `${node.name}${node.warden ? '\nWARDEN' : node.actEnd ? `\nEND OF ACT ${ROMAN[(node.act ?? 1) - 1]}` : ''}`, txt.hud(11, node.warden ? 0xe5a86a : 0xe58a8a)).setOrigin(0, 0.5);
        }
      }),
    );
    // Act banners where each act begins (only when there is more than one).
    const acts = Math.max(...run.map.flat().map((n) => n.act ?? 1));
    if (acts > 1) {
      run.map.forEach((floor, f) => {
        const act = floor[0].act ?? 1;
        if (f > 0 && (run.map[f - 1][0].act ?? 1) === act) return;
        const y = this.nodePos(f, 0).y + this.floorH() / 2;
        this.add.rectangle(GAME_W / 2, y, GAME_W - 40, 1, PAL.bronze, 0.6);
        const name = act > 1 ? run.crypt.actNames?.[act - 2] : undefined;
        this.add.text(24, y - 14, `ACT ${ROMAN[act - 1]}${name ? ` · ${name.toUpperCase()}` : ''}`, txt.hud(11, PAL.bronze));
      });
    }
    map.content.add(this.children.list.slice(before));
    map.fit(this.nodePos(0, 0).y + 40);
  }

  private select(index: number) {
    const run = current.run!;
    const floor = run.floor + 1;
    const node = run.map[floor][index];
    this.selected = index;
    this.clearInfo();
    const { x, y } = this.nodePos(floor, index);
    const ring = this.add.circle(x, y, 32).setStrokeStyle(4, PAL.ivory);
    this.mapLayer?.add(ring);
    this.info.push(ring);
    const style = { fontFamily: FONT, color: hex(PAL.ivory), align: 'center', wordWrap: { width: GAME_W - 40 } };
    this.info.push(this.add.text(GAME_W / 2, 530, `${KIND_NAME[node.kind]}\n${this.describe(node)}`, { ...style, fontSize: '20px', lineSpacing: 2 }).setOrigin(0.5));
    const go = makeButton(this, GAME_W / 2, 592, 220, 52, 'Go', () => this.go(), { active: true });
    this.info.push(...go.all);
  }

  /** A room further up the map: what it holds, without walking there. */
  private peek(floor: number, index: number) {
    const run = current.run!;
    const node = run.map[floor][index];
    this.selected = undefined;
    this.clearInfo();
    const { x, y } = this.nodePos(floor, index);
    const ring = this.add.circle(x, y, node.kind === 'boss' ? 38 : 29).setStrokeStyle(3, PAL.steel);
    this.mapLayer?.add(ring);
    this.info.push(ring);
    const ahead = floor - run.floor;
    const style = { fontFamily: FONT, color: hex(PAL.ivory), align: 'center', wordWrap: { width: GAME_W - 40 } };
    this.info.push(this.add.text(GAME_W / 2, 530, `${KIND_NAME[node.kind]}  ·  ${ahead} floor${ahead === 1 ? '' : 's'} ahead\n${this.describe(node)}`, { ...style, fontSize: '19px', lineSpacing: 2 }).setOrigin(0.5));
    this.info.push(this.add.text(GAME_W / 2, 592, 'Out of reach. March to a glowing room.', { ...style, fontSize: '16px', color: hex(PAL.steel) }).setOrigin(0.5));
  }

  private describe(node: MapNode): string {
    const m = rewardMult(current.run!);
    const foes = (enc: string) => ENCOUNTERS[enc].map((t) => ENEMIES[t].name).join(', ');
    switch (node.kind) {
      case 'fight':
        return `${foes(node.encounter!)}. +${Math.round(REWARDS.fightTithes * m)} Tithes.`;
      case 'elite':
        return `${foes(node.encounter!)}. A greater horror! Its death yields a relic and +${REWARDS.eliteSeals} Seal.`;
      case 'boss':
        if (node.warden) return `${node.name}, Warden of this act. Slay it for boss spoils!`;
        if (node.actEnd) return `${node.name} bars the way down. Slay it to reach a Sanctuary.`;
        return `${node.name ?? current.run!.crypt.bossName}. Destroy it and purify the crypt!`;
      case 'event':
        return 'Something waits in the dark. A temptation, not a fight.';
      case 'shrine':
        return `Kneel and pray. Every Sister heals ${REWARDS.shrineHealPct * 100}%.`;
      case 'reliquary':
        return 'Claim one holy relic for this crusade!';
      case 'miracle':
        return `A Miracle! Every Sister, fallen or not, rises whole. +${MIRACLE_SEALS} Seals and a relic of your choice.`;
    }
  }

  private go() {
    const run = current.run!;
    if (this.selected === undefined) return;
    const node = enterNode(run, this.selected);
    commit(); // a reload from here on knows which room was entered
    if (node.kind === 'shrine') {
      shrine(game.save, run);
      commit();
      this.scene.restart();
    } else if (node.kind === 'miracle') {
      miracle(game.save, run);
      commit();
      this.cameras.main.flash(500, 255, 240, 200);
      this.time.delayedCall(450, () => this.scene.restart());
    } else this.scene.restart(); // create() routes to the battle, event or relic choice
  }

  private prompt(text: string) {
    this.clearInfo();
    this.info.push(
      this.add.text(GAME_W / 2, 545, text, { fontFamily: FONT, fontSize: '21px', color: hex(PAL.muted), align: 'center' }).setOrigin(0.5),
    );
  }

  private clearInfo() {
    this.info.forEach((o) => o.destroy());
    this.info = [];
  }

  private drawParty() {
    const run = current.run!;
    const style = { fontFamily: FONT, color: hex(PAL.ivory), align: 'center' };
    const py = 680;
    run.party.forEach((id, i) => {
      const c = CRUSADERS.find((x) => x.id === id)!;
      const cx = GAME_W / 2 + (i - 1.5) * 120;
      const hp = run.hp[id];
      const max = maxHpOf(game.save, run, id);
      this.add.rectangle(cx, py, 96, 96).setStrokeStyle(3, hp > 0 ? RARITY_COLOR[c.rarity] : PAL.armorShadow);
      const img = this.add.image(cx, py, portraitKey(id)).setDisplaySize(90, 90);
      holdForCard(this, img, id);
      if (hp <= 0) img.setTint(0x333333);
      this.add.rectangle(cx - 45, py + 58, 90, 8, PAL.deepShadow).setOrigin(0, 0.5);
      this.add.rectangle(cx - 45, py + 58, (90 * hp) / max, 8, hp / max > 0.4 ? 0x7a9a5a : PAL.oxblood).setOrigin(0, 0.5);
      this.add.text(cx, py + 74, hp > 0 ? `${hp}/${max}` : 'Fallen', { ...style, fontSize: '17px', color: hex(PAL.muted) }).setOrigin(0.5);
    });
    const notes: string[] = [];
    if (run.blessZeal) notes.push(`Next fight: +${run.blessZeal} Zeal`);
    if (run.curseVigil) notes.push(`Next fight: Vigil ${run.curseVigil} shorter`);
    if (notes.length) {
      this.add
        .text(GAME_W / 2, py + 110, notes.join('\n'), { ...style, fontSize: '18px', color: hex(PAL.violet), wordWrap: { width: GAME_W - 40 } })
        .setOrigin(0.5);
    }
  }

  /** The run's build: family counts at a glance; tap for every relic and synergy. */
  private drawBuild() {
    const run = current.run!;
    if (!run.relics.length) return;
    const counts = familyCounts(run);
    const parts: Phaser.GameObjects.Text[] = [];
    const label = this.add.text(0, 82, `${run.relics.length} relic${run.relics.length > 1 ? 's' : ''}`, txt.hud(13, PAL.muted)).setOrigin(0, 0.5);
    parts.push(label);
    for (const f of ['burn', 'bell', 'martyr'] as RelicFamily[]) {
      if (!counts[f]) continue;
      parts.push(this.add.text(0, 82, `${FAMILY_NAME[f]} ${counts[f]}${counts[f] >= 2 ? '★' : ''}`, txt.hud(13, FAMILY_COLOR[f])).setOrigin(0, 0.5));
    }
    parts.push(this.add.text(0, 82, '›', txt.hud(14, PAL.amber)).setOrigin(0, 0.5));
    const gap = 16;
    const total = parts.reduce((n, p) => n + p.width, 0) + gap * (parts.length - 1);
    let x = GAME_W / 2 - total / 2;
    for (const p of parts) {
      p.setX(x);
      x += p.width + gap;
    }
    const hit = this.add.rectangle(GAME_W / 2, 82, total + 30, 24, 0x000000, 0.001).setInteractive({ useHandCursor: true });
    hit.on('pointerup', () => this.showBuild());
  }

  private showBuild() {
    const run = current.run!;
    const layer = this.overlay();
    layer.add(this.add.text(GAME_W / 2, 90, 'YOUR BUILD', txt.display(26, PAL.ivory)).setOrigin(0.5));
    let y = 140;
    const counts = familyCounts(run);
    for (const f of ['burn', 'bell', 'martyr'] as RelicFamily[]) {
      const [two, three] = FAMILY_BONUS[f];
      const n = counts[f];
      const line = `${FAMILY_NAME[f]} ${n}/3   ${n >= 2 ? '✓' : '○'} ${two.name.split(' (')[0]}: ${two.desc}   ${n >= 3 ? '✓' : '○'} ${three.name.split(' (')[0]}: ${three.desc}`;
      const t = this.add.text(30, y, line, { ...txt.body(15, n >= 2 ? FAMILY_COLOR[f] : PAL.steel), wordWrap: { width: GAME_W - 60 } });
      layer.add(t);
      y += t.height + 12;
    }
    y += 6;
    for (const id of run.relics) {
      const r = relicById(id);
      if (!r) continue;
      const col = r.burden ? 0xd65f5f : r.family ? FAMILY_COLOR[r.family] : PAL.ivory;
      const tag = r.burden ? 'BURDEN' : r.family ? FAMILY_NAME[r.family].toUpperCase() : '';
      layer.add(this.add.text(30, y, `${r.name}${tag ? `  ·  ${tag}` : ''}`, txt.body(17, col)));
      const d = this.add.text(30, y + 22, r.desc, { ...txt.body(15, PAL.muted), wordWrap: { width: GAME_W - 60 } });
      layer.add(d);
      y += 26 + d.height + 8;
    }
    const close = makeButton(this, GAME_W / 2, Math.min(GAME_H - 140, y + 50), 220, 60, 'Close', () => layer.destroy());
    layer.add(close.all);
  }

  private overlay() {
    const layer = this.add.container(0, 0).setDepth(20);
    layer.add(this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x000000, 0.94).setInteractive());
    return layer;
  }

  private showRelics() {
    const run = current.run!;
    const offer = relicOffer(run);
    if (!offer.length) {
      // Nothing left to offer: the reliquary pays out instead.
      run.pendingRelic = false;
      run.tithes += 60;
      run.resolved = true;
      commit();
      this.scene.restart();
      return;
    }
    const layer = this.overlay();
    layer.add(this.add.text(GAME_W / 2, 200, 'THE RELIQUARY OFFERS', txt.display(24, PAL.ivory)).setOrigin(0.5));
    offer.forEach((r, i) => {
      const y = 320 + i * 130;
      const counts = familyCounts(run);
      const n = r.family ? counts[r.family] + 1 : 0;
      const synergy = r.family && n >= 2 && n <= 3 ? `  ·  ${n}${n === 2 ? 'nd' : 'rd'} ${FAMILY_NAME[r.family]}: ${FAMILY_BONUS[r.family][n - 2].name.split(' (')[0]}!` : r.family ? `  ·  ${FAMILY_NAME[r.family]}` : '';
      const b = makeButton(this, GAME_W / 2, y, GAME_W - 80, 110, `${r.name}${synergy}\n${r.desc}`, () => {
        takeRelic(game.save, run, r.id);
        commit();
        this.scene.restart();
      }, { fontSize: 21 });
      layer.add(b.all);
      // relic-<id>.png (48 x 48) on the left of its button when present; the words move right to make room
      const icon = addArt(this, `relic-${r.id}`, 40 + 44, y, 48);
      if (icon) {
        for (const o of [b.text, ...b.extra]) if (o instanceof Phaser.GameObjects.Text) o.setX(o.x + 30);
        layer.add(icon);
      }
    });
  }

  private showEvent(node: MapNode) {
    const run = current.run!;
    const ev = EVENTS[node.event!];
    const layer = this.overlay();
    const style = { fontFamily: FONT, color: hex(PAL.ivory), align: 'center', wordWrap: { width: GAME_W - 60 } };
    // event-<id>.png (480 x 320) as a picture above the title when present; everything below moves down
    const art = this.textures.exists(`event-${ev.id}`) ? this.add.image(GAME_W / 2, 170, `event-${ev.id}`).setDisplaySize(330, 220) : null;
    const dy = art ? 145 : 0;
    if (art) layer.add([art, this.add.rectangle(GAME_W / 2, 170, 332, 222).setStrokeStyle(1, PAL.amber, 0.6)]);
    layer.add(this.add.text(GAME_W / 2, 170 + dy, ev.title.toUpperCase(), { ...txt.display(26, PAL.ivory), align: 'center', wordWrap: { width: GAME_W - 60 } }).setOrigin(0.5));
    layer.add(this.add.text(GAME_W / 2, (art ? 230 : 250) + dy, ev.text, { ...style, fontSize: '22px', lineSpacing: 4 }).setOrigin(0.5));
    const buttons: Phaser.GameObjects.GameObject[] = [];
    ev.options.forEach((o, i) => {
      const b = makeButton(this, GAME_W / 2, (art ? 470 : 400) + i * (art ? 128 : 140), GAME_W - 80, 116, `${o.label}\n${o.hint}`, () => {
        const out = chooseEvent(game.save, run, i);
        commit();
        buttons.forEach((x) => x.destroy());
        layer.add(this.add.text(GAME_W / 2, 470, out.text, { ...style, fontSize: '24px', color: hex(PAL.amber) }).setOrigin(0.5));
        const next = makeButton(this, GAME_W / 2, 600, 240, 64, 'Continue', () => this.scene.restart(), { active: true });
        layer.add(next.all);
      }, { fontSize: 21 });
      buttons.push(...b.all);
      layer.add(b.all);
    });
  }

  private finish(outcome: 'victory' | 'retreat') {
    const result = finishRun(game.save, current.run!, outcome);
    current.run = undefined;
    commit();
    this.scene.start('Results', { result });
  }
}
