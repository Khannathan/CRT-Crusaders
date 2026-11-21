import Phaser from 'phaser';
import { FONT, GAME_H, GAME_W, PAL, hex } from '../config';
import { RARITY_COLOR } from '../data/classes';
import { CRUSADERS } from '../data/crusaders';
import { ENCOUNTERS, ENEMIES } from '../data/enemies';
import { EVENTS } from '../data/events';
import { RELICS } from '../data/relics';
import { commit, game } from '../state/game';
import { current } from '../state/run';
import {
  REWARDS,
  ROMAN,
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
  takeRelic,
  type MapNode,
  type NodeKind,
} from '../systems/crusade';
import { makeButton } from '../ui/button';
import { nodeIconKey } from '../ui/icons';
import { portraitKey } from '../ui/placeholderPortrait';
import { addScreenGlow, text as txt } from '../ui/theme';

const MAP_TOP = 112;
const MAP_BOTTOM = 500;
const KIND_NAME: Record<NodeKind, string> = {
  fight: 'Fight',
  elite: 'Elite fight',
  event: 'Temptation',
  shrine: 'Shrine',
  reliquary: 'Reliquary',
  boss: 'Boss',
};

/** The crypt map: pick a path floor by floor, from the bottom up to the boss. */
export class CryptScene extends Phaser.Scene {
  private selected?: number;
  private info: Phaser.GameObjects.GameObject[] = [];

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
      .text(GAME_W / 2, 62, `Earned so far: ${run.tithes} Tithes · ${run.seals} Seals`, { ...style, fontSize: '18px', color: hex(PAL.muted) })
      .setOrigin(0.5);

    this.drawMap();
    this.drawParty();
    makeButton(this, GAME_W / 2, GAME_H - 48, 260, 60, 'Retreat (keep Tithes)', () => this.finish('retreat'), { fontSize: 17 });

    // Resume whatever the current node still needs.
    const node = currentNode(run);
    if (run.pendingRelic) this.showRelics();
    else if (node?.kind === 'event') this.showEvent(node);
    else if (node?.kind === 'reliquary') this.showRelics();
    else if (node?.encounter) this.scene.start('Battle');
    else this.prompt(choices(run).length ? 'Choose your path through the dark.' : '');
  }

  private nodePos(floor: number, i: number) {
    const run = current.run!;
    const floors = run.map.length;
    const width = run.map[floor].length;
    const y = MAP_BOTTOM - (floor * (MAP_BOTTOM - MAP_TOP)) / (floors - 1);
    const x = GAME_W / 2 + (i - (width - 1) / 2) * 150;
    return { x, y };
  }

  private drawMap() {
    const run = current.run!;
    const open = choices(run);
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
        if (available) img.setInteractive({ useHandCursor: true }).on('pointerup', () => this.select(i));
      }),
    );
  }

  private select(index: number) {
    const run = current.run!;
    const floor = run.floor + 1;
    const node = run.map[floor][index];
    this.selected = index;
    this.clearInfo();
    const { x, y } = this.nodePos(floor, index);
    this.info.push(this.add.circle(x, y, 32).setStrokeStyle(4, PAL.ivory));
    const style = { fontFamily: FONT, color: hex(PAL.ivory), align: 'center', wordWrap: { width: GAME_W - 40 } };
    this.info.push(this.add.text(GAME_W / 2, 572, `${KIND_NAME[node.kind]}\n${this.describe(node)}`, { ...style, fontSize: '20px', lineSpacing: 2 }).setOrigin(0.5));
    const go = makeButton(this, GAME_W / 2, 640, 240, 60, 'Go', () => this.go(), { active: true });
    this.info.push(...go.all);
  }

  private describe(node: MapNode): string {
    const m = rewardMult(current.run!);
    const foes = (enc: string) => ENCOUNTERS[enc].map((t) => ENEMIES[t].name).join(', ');
    switch (node.kind) {
      case 'fight':
        return `${foes(node.encounter!)}. +${Math.round(REWARDS.fightTithes * m)} Tithes.`;
      case 'elite':
        return `${foes(node.encounter!)}. A greater horror. Its death yields a relic, +${REWARDS.eliteSeals} Seal.`;
      case 'boss':
        return `${current.run!.crypt.bossName}. Destroy it and the crypt is purified.`;
      case 'event':
        return 'Something waits in the dark. A temptation, not a fight.';
      case 'shrine':
        return `Kneel and pray: every Sister heals ${REWARDS.shrineHealPct * 100}%.`;
      case 'reliquary':
        return 'Claim one holy relic for this crusade.';
    }
  }

  private go() {
    const run = current.run!;
    if (this.selected === undefined) return;
    const node = enterNode(run, this.selected);
    if (node.kind === 'shrine') {
      shrine(game.save, run);
      commit();
      this.scene.restart();
    } else this.scene.restart(); // create() routes to the battle, event or relic choice
  }

  private prompt(text: string) {
    this.clearInfo();
    this.info.push(
      this.add.text(GAME_W / 2, 580, text, { fontFamily: FONT, fontSize: '21px', color: hex(PAL.muted), align: 'center' }).setOrigin(0.5),
    );
  }

  private clearInfo() {
    this.info.forEach((o) => o.destroy());
    this.info = [];
  }

  private drawParty() {
    const run = current.run!;
    const style = { fontFamily: FONT, color: hex(PAL.ivory), align: 'center' };
    const py = 740;
    run.party.forEach((id, i) => {
      const c = CRUSADERS.find((x) => x.id === id)!;
      const cx = GAME_W / 2 + (i - 1.5) * 120;
      const hp = run.hp[id];
      const max = maxHpOf(game.save, run, id);
      this.add.rectangle(cx, py, 96, 96).setStrokeStyle(3, hp > 0 ? RARITY_COLOR[c.rarity] : PAL.armorShadow);
      const img = this.add.image(cx, py, portraitKey(id)).setDisplaySize(90, 90);
      if (hp <= 0) img.setTint(0x333333);
      this.add.rectangle(cx - 45, py + 58, 90, 8, PAL.deepShadow).setOrigin(0, 0.5);
      this.add.rectangle(cx - 45, py + 58, (90 * hp) / max, 8, hp / max > 0.4 ? 0x7a9a5a : PAL.oxblood).setOrigin(0, 0.5);
      this.add.text(cx, py + 74, hp > 0 ? `${hp}/${max}` : 'Fallen', { ...style, fontSize: '17px', color: hex(PAL.muted) }).setOrigin(0.5);
    });
    const notes: string[] = [];
    if (run.relics.length) notes.push(`Relics: ${run.relics.map((id) => RELICS.find((r) => r.id === id)!.name).join(', ')}`);
    if (run.blessZeal) notes.push(`Next fight: +${run.blessZeal} Zeal`);
    if (run.curseVigil) notes.push(`Next fight: Vigil ${run.curseVigil} shorter`);
    if (notes.length) {
      this.add
        .text(GAME_W / 2, py + 108, notes.join('\n'), { ...style, fontSize: '18px', color: hex(PAL.violet), wordWrap: { width: GAME_W - 40 } })
        .setOrigin(0.5);
    }
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
      const b = makeButton(this, GAME_W / 2, 320 + i * 130, GAME_W - 80, 110, `${r.name}\n${r.desc}`, () => {
        takeRelic(game.save, run, r.id);
        commit();
        this.scene.restart();
      }, { fontSize: 21 });
      layer.add(b.all);
    });
  }

  private showEvent(node: MapNode) {
    const run = current.run!;
    const ev = EVENTS[node.event!];
    const layer = this.overlay();
    const style = { fontFamily: FONT, color: hex(PAL.ivory), align: 'center', wordWrap: { width: GAME_W - 60 } };
    layer.add(this.add.text(GAME_W / 2, 170, ev.title.toUpperCase(), { ...txt.display(26, PAL.ivory), align: 'center', wordWrap: { width: GAME_W - 60 } }).setOrigin(0.5));
    layer.add(this.add.text(GAME_W / 2, 250, ev.text, { ...style, fontSize: '22px', lineSpacing: 4 }).setOrigin(0.5));
    const buttons: Phaser.GameObjects.GameObject[] = [];
    ev.options.forEach((o, i) => {
      const b = makeButton(this, GAME_W / 2, 400 + i * 140, GAME_W - 80, 116, `${o.label}\n${o.hint}`, () => {
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
