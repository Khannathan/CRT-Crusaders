import { recordBanner } from '../ui/juice';
import { beatenText, noteTower } from '../systems/records';
import Phaser from 'phaser';
import { GAME_H, GAME_W, PAL } from '../config';
import { addScrollArea } from '../ui/scroll';
import { TAB_BAR_H } from '../ui/tabBar';
import { game, commit } from '../state/game';
import { current } from '../state/run';
import { BELL_VIGIL, bellBonus } from '../systems/campaign';
import {
  ORDER_PARTY,
  ORDER_TOWER_FLOORS,
  TOWER_LOOKAHEAD,
  allowedOn,
  finishFloor,
  finishOrderFloor,
  floorDef,
  floorRecommended,
  floorReward,
  foesOf,
  orderBest,
  orderFloorDef,
  orderFloorRecommended,
  orderFloorReward,
  orderSisters,
  orderTowerBattle,
  rewardLine,
  ruleText,
  towerBattle,
  towerOf,
  type FloorDef,
  type FloorReward,
} from '../systems/tower';
import { ORDER_LIST } from '../data/orders';
import { boostPct } from '../systems/boosts';
import { makeButton } from '../ui/button';
import { sigilKey } from '../ui/icons';
import { modeScreen, progressBar, toast } from '../ui/modeScreen';
import { pickParty } from '../ui/partyPicker';
import { accountPower, formatPower } from '../systems/power';
import { drawRecommended } from '../ui/recommended';
import { PAD, addFrame, text, fitLine } from '../ui/theme';

type View = 'bell' | 'orders';

/** The Bell Tower (open to all) and the Order Towers (one per Order, a full party of that Order). */
export class TowerScene extends Phaser.Scene {
  private notice?: string;
  private record?: string;
  private view: View = 'bell';
  private order?: string;

  constructor() {
    super('Tower');
  }

  init(data: { notice?: string; record?: string; view?: View; order?: string }) {
    this.notice = data?.notice;
    this.record = data?.record;
    if (data?.view) this.view = data.view;
    this.order = data?.order ?? (data?.view === 'bell' ? undefined : this.order);
  }

  create() {
    const sub = this.view === 'bell' ? 'Bells that ring for no one living, floor upon floor without end. Any Sisters may climb.' : this.order ? `The ${this.order}'s own tower. Fifty floors, climbed only by four of its Sisters.` : 'Ten towers, one for each Order. Only a full party of the Order may climb, and each pays its Writs.';
    const { top } = modeScreen(this, this.view === 'bell' ? 'The Bell Tower' : this.order ?? 'The Order Towers', sub);
    const half = (GAME_W - PAD * 2 - 8) / 2;
    makeButton(this, PAD + half / 2, top + 20, half, 40, 'Bell Tower', () => this.scene.restart({ view: 'bell' }), { active: this.view === 'bell', fontSize: 16 });
    makeButton(this, GAME_W - PAD - half / 2, top + 20, half, 40, 'Order Towers', () => this.scene.restart({ view: 'orders', order: undefined }), { active: this.view === 'orders', fontSize: 16 });
    const y0 = top + 56;
    const pct = boostPct('tower');
    if (pct) this.add.text(GAME_W - PAD, y0, `+${pct}% SPOILS TODAY`, text.hud(11, PAL.amber)).setOrigin(1, 0);
    if (this.view === 'bell') this.bell(y0);
    else if (this.order) this.orderTower(y0, this.order);
    else this.orderList(y0);
    if (this.notice) toast(this, this.notice);
    if (this.record) recordBanner(this, this.record);
  }

  private bell(top: number) {
    const save = game.save;
    const t = towerOf(save);
    const bw = GAME_W - PAD * 2;
    const bell = Math.floor(t.best / 10) * 10 + 10;
    this.add.text(PAD, top, `HIGHEST FLOOR ${t.best} · NEXT BELL ${bell}`, text.hud(14, PAL.amber));
    progressBar(this, PAD, top + 28, bw, (t.best % 10) / 10, PAL.amber, 8);
    this.add.text(PAD, top + 42, `EVERY FLOOR: VIGIL +${Math.round(BELL_VIGIL * 100)}%  ·  NOW +${Math.round((bellBonus(save) - 1) * 100)}%`, text.hud(11, PAL.amber));
    this.add.text(GAME_W - PAD, top, 'A LOSS COSTS NOTHING', text.hud(11, PAL.muted)).setOrigin(1, 0);
    const next = t.best + 1;
    const f = floorDef(next);
    this.climbCard(top + 64, f, floorReward(next), floorRecommended(save, next), accountPower(save, allowedOn(f.rule)), () => this.climbBell(next), (n) => ({ def: floorDef(n), reward: floorReward(n), rec: floorRecommended(save, n) }), next + TOWER_LOOKAHEAD);
  }

  private orderList(top: number) {
    const save = game.save;
    const bw = GAME_W - PAD * 2;
    this.add.text(PAD, top, `${ORDER_TOWER_FLOORS} FLOORS EACH · ${ORDER_PARTY} SISTERS OF THE ORDER`, text.hud(12, PAL.amber));
    const listTop = top + 24;
    const list = addScrollArea(this, listTop, GAME_H - TAB_BAR_H);
    const before = this.children.list.length;
    let y = listTop + 4;
    for (const o of ORDER_LIST) {
      const best = orderBest(save, o.name);
      const have = orderSisters(save, o.name).length;
      const ready = have >= ORDER_PARTY;
      const h = 76;
      const row = this.add.rectangle(GAME_W / 2, y + h / 2, bw, h, 0x1b131d).setStrokeStyle(1, best >= ORDER_TOWER_FLOORS ? PAL.amber : o.color);
      if (this.textures.exists(sigilKey(o.id))) this.add.image(PAD + 34, y + h / 2, sigilKey(o.id)).setDisplaySize(44, 44).setAlpha(ready ? 1 : 0.45);
      else this.add.circle(PAD + 34, y + h / 2, 18, o.color);
      this.add.text(PAD + 66, y + 10, o.name, { ...text.body(19, ready ? 0xfff1d6 : PAL.muted), fontStyle: '600' });
      this.add.text(PAD + 66, y + 38, best >= ORDER_TOWER_FLOORS ? 'Conquered' : ready ? `Floor ${best + 1} next` : `Needs ${ORDER_PARTY} Sisters of the Order: you have ${have}`, text.body(15, ready ? PAL.ivory : 0xe5a86a));
      this.add.text(GAME_W - PAD - 30, y + 14, `${best}/${ORDER_TOWER_FLOORS}`, text.hud(14, PAL.amber)).setOrigin(1, 0);
      progressBar(this, GAME_W - PAD - 130, y + 50, 100, best / ORDER_TOWER_FLOORS, o.color, 6);
      this.add.text(GAME_W - PAD - 12, y + h / 2, '›', text.display(30, PAL.amber)).setOrigin(1, 0.5);
      list.tap(row, () => this.scene.restart({ view: 'orders', order: o.name }));
      y += h + 8;
    }
    list.content.add(this.children.list.slice(before));
    list.fit(y + 8);
  }

  private orderTower(top: number, order: string) {
    const save = game.save;
    const bw = GAME_W - PAD * 2;
    const best = orderBest(save, order);
    this.add.text(PAD, top, `HIGHEST FLOOR ${best} OF ${ORDER_TOWER_FLOORS}`, text.hud(14, PAL.amber));
    progressBar(this, PAD, top + 28, bw, best / ORDER_TOWER_FLOORS, PAL.amber, 8);
    this.add.text(PAD, top + 42, `ONLY SISTERS OF THE ${order.toUpperCase()} · ${ORDER_PARTY} MUST CLIMB`, text.hud(11, 0xe5a86a));
    const next = best + 1;
    if (next > ORDER_TOWER_FLOORS) {
      this.add.text(GAME_W / 2, top + 160, `The ${order} tower is conquered.\nIts bells ring for your Sisters now.`, { ...text.body(20, PAL.amber), align: 'center' }).setOrigin(0.5);
      makeButton(this, GAME_W / 2, top + 260, 240, 52, 'All Order Towers', () => this.scene.restart({ view: 'orders', order: undefined }), { fontSize: 16 });
      return;
    }
    const f = orderFloorDef(order, next);
    this.climbCard(top + 64, f, orderFloorReward(next), orderFloorRecommended(save, order, next), accountPower(save, (c) => c.order === order), () => this.climbOrder(order, next), (n) => ({ def: orderFloorDef(order, n), reward: orderFloorReward(n), rec: orderFloorRecommended(save, order, n) }), ORDER_TOWER_FLOORS);
  }

  /** The next floor's card and the floors above it, for either kind of tower. */
  private climbCard(y: number, f: FloorDef, reward: FloorReward, rec: number, power: number, climb: () => void, above: (n: number) => { def: FloorDef; reward: FloorReward; rec: number }, last: number) {
    const bw = GAME_W - PAD * 2;
    const h = 196;
    addFrame(this, GAME_W / 2, y + h / 2, bw, h, { fill: f.boss ? 0x2a1520 : 0x1e1520, edge: f.boss ? 0xe58a8a : PAL.goldEdge });
    this.add.text(PAD + 18, y + 16, `FLOOR ${f.floor}`, text.display(26, 0xfff1d6));
    if (f.boss) this.add.text(GAME_W - PAD - 18, y + 22, 'BOSS', text.hud(14, 0xe58a8a)).setOrigin(1, 0);
    this.add.text(PAD + 18, y + 56, foesOf(f), { ...text.body(17, PAL.ivory), wordWrap: { width: bw - 36 } });
    this.add.text(PAD + 18, y + 84, `Foes at ${Math.round(f.scale * 100)}% strength`, text.body(15, PAL.muted));
    drawRecommended(this, GAME_W - PAD - 18, y + 88, rec, power, { align: 'right' });
    if (f.rule && f.rule.kind !== 'order') this.add.text(PAD + 18, y + 106, ruleText(f.rule), { ...text.body(16, 0xe5a86a), fontStyle: '600' });
    this.add.text(PAD + 18, y + 132, `First clear: ${rewardLine(reward)}`, { ...text.body(15, PAL.amber), wordWrap: { width: bw - 36 } });
    makeButton(this, GAME_W / 2, y + h - 2, 220, 56, 'Climb', climb, { active: true, fontSize: 20, icon: 'blade' });
    y += h + 40;
    if (f.floor >= last) return;
    this.add.text(PAD, y, 'ABOVE', text.hud(13, PAL.amber));
    y += 22;
    // The floors above: drag or wheel to look up the tower.
    const list = addScrollArea(this, y - 2, GAME_H - TAB_BAR_H);
    const before = this.children.list.length;
    for (let n = f.floor + 1; n <= last; n++) {
      const { def: g, reward: r, rec: rp } = above(n);
      this.add.rectangle(GAME_W / 2, y + 27, bw, 54, 0x18111a).setStrokeStyle(1, g.boss ? 0x7a3a44 : PAL.armorShadow);
      this.add.text(PAD + 12, y + 8, `${n}`, text.hud(14, g.boss ? 0xe58a8a : PAL.steel));
      fitLine(this.add.text(PAD + 52, y + 6, g.boss ? `Boss: ${foesOf(g).split(',')[0]}` : foesOf(g), text.body(15, PAL.muted)), bw - 70);
      const special = g.rule && g.rule.kind !== 'order';
      fitLine(this.add.text(PAD + 52, y + 28, special ? ruleText(g.rule) : rewardLine(r, g.rule?.kind === 'order'), text.body(14, special ? 0xe5a86a : PAL.steel)), bw - 140);
      this.add.text(GAME_W - PAD - 12, y + 32, `REC ${formatPower(rp)}`, text.hud(11, PAL.steel)).setOrigin(1, 0);
      y += 60;
    }
    list.content.add(this.children.list.slice(before));
    list.fit(y + 8);
  }

  private climbBell(floor: number) {
    const save = game.save;
    const f = floorDef(floor);
    const allow = allowedOn(f.rule);
    pickParty(
      this,
      save,
      { title: `Floor ${floor}`, sub: f.rule ? `${ruleText(f.rule)}. Tap in rank order.` : 'Tap Sisters in rank order; the first stands in front.', initial: save.lastParty, allow, why: f.rule ? ruleText(f.rule) : undefined, confirm: 'Climb', rec: floorRecommended(save, floor) },
      (party) => {
        current.challenge = {
          label: `Floor ${floor} of the Bell Tower. ${f.boss ? 'Something vast stirs in the belfry.' : 'The bells toll for you.'}`,
          make: (rng) => towerBattle(save, party, floor, rng),
          finish: (_o, battle) => {
            const before = towerOf(save).best;
            const r = finishFloor(save, floor, battle);
            const notice = r.reward ? `Floor ${floor} taken: ${rewardLine(r.reward)}${r.gear ? `\n${r.gear.name} (${r.gear.rarity})` : ''}` : 'Driven back down the stair. Climb again when ready.';
            const rec = r.reward ? noteTower(save, floor, before) : undefined;
            return { scene: 'Tower', data: { notice, record: rec && beatenText(rec), view: 'bell' } };
          },
        };
        this.scene.start('Battle');
      },
    );
  }

  private climbOrder(order: string, floor: number) {
    const save = game.save;
    const f = orderFloorDef(order, floor);
    const allow = allowedOn(f.rule);
    const initial = save.lastParty.filter((id) => orderSisters(save, order).some((c) => c.id === id));
    pickParty(
      this,
      save,
      { title: `${order}: floor ${floor}`, sub: `Four Sisters of the ${order}, in rank order.`, initial, allow, why: ruleText(f.rule), confirm: 'Climb', min: ORDER_PARTY, rec: orderFloorRecommended(save, order, floor) },
      (party) => {
        current.challenge = {
          label: `Floor ${floor} of the ${order} tower. ${f.boss ? 'The Order\'s old shame waits at the top of the stair.' : 'Your Sisters climb their own house.'}`,
          make: (rng) => orderTowerBattle(save, party, order, floor, rng),
          finish: (_o, battle) => {
            const r = finishOrderFloor(save, order, floor, battle);
            commit();
            const notice = r.reward ? `Floor ${floor} taken: ${rewardLine(r.reward)}${r.gear ? `\n${r.gear.name} (${r.gear.rarity})` : ''}` : 'Driven back down the stair. Climb again when ready.';
            return { scene: 'Tower', data: { notice, view: 'orders', order } };
          },
        };
        this.scene.start('Battle');
      },
    );
  }
}
