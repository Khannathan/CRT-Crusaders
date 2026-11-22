import Phaser from 'phaser';
import { GAME_W, PAL } from '../config';
import { game } from '../state/game';
import { current } from '../state/run';
import { TOWER_FLOORS, allowedOn, finishFloor, floorDef, floorRecommended, floorReward, foesOf, rewardLine, ruleText, towerBattle, towerOf } from '../systems/tower';
import { makeButton } from '../ui/button';
import { modeScreen, progressBar, toast } from '../ui/modeScreen';
import { pickParty } from '../ui/partyPicker';
import { accountPower, formatPower } from '../systems/power';
import { drawRecommended } from '../ui/recommended';
import { PAD, addFrame, text } from '../ui/theme';

/** The Bell Tower: the next floor up, what guards it, and the floors above. */
export class TowerScene extends Phaser.Scene {
  private notice?: string;

  constructor() {
    super('Tower');
  }

  init(data: { notice?: string }) {
    this.notice = data?.notice;
  }

  create() {
    const save = game.save;
    const { top } = modeScreen(this, 'The Bell Tower', 'Sixty floors of bells that ring for no one living. Climb as high as faith allows.');
    const t = towerOf(save);
    const bw = GAME_W - PAD * 2;
    this.add.text(PAD, top, `HIGHEST FLOOR ${t.best} / ${TOWER_FLOORS}`, text.hud(14, PAL.amber));
    this.add.text(GAME_W - PAD, top, 'A LOSS COSTS NOTHING', text.hud(11, PAL.muted)).setOrigin(1, 0);
    progressBar(this, PAD, top + 28, bw, t.best / TOWER_FLOORS, PAL.amber, 8);

    const next = t.best + 1;
    let y = top + 50;
    if (next > TOWER_FLOORS) {
      this.add.text(GAME_W / 2, y + 80, 'The summit. The last bell is silent.\nNo floor remains to climb.', { ...text.body(20, PAL.amber), align: 'center' }).setOrigin(0.5);
    } else {
      const f = floorDef(next);
      const h = 196;
      addFrame(this, GAME_W / 2, y + h / 2, bw, h, { fill: f.boss ? 0x2a1520 : 0x1e1520, edge: f.boss ? 0xe58a8a : PAL.goldEdge });
      this.add.text(PAD + 18, y + 16, `FLOOR ${next}`, text.display(26, 0xfff1d6));
      if (f.boss) this.add.text(GAME_W - PAD - 18, y + 22, 'BOSS', text.hud(14, 0xe58a8a)).setOrigin(1, 0);
      this.add.text(PAD + 18, y + 56, foesOf(f), { ...text.body(17, PAL.ivory), wordWrap: { width: bw - 36 } });
      this.add.text(PAD + 18, y + 84, `Foes at ${Math.round(f.scale * 100)}% strength`, text.body(15, PAL.muted));
      drawRecommended(this, GAME_W - PAD - 18, y + 88, floorRecommended(save, next), accountPower(save, allowedOn(f.rule)), { align: 'right' });
      if (f.rule) this.add.text(PAD + 18, y + 106, ruleText(f.rule), { ...text.body(16, 0xe5a86a), fontStyle: '600' });
      this.add.text(PAD + 18, y + 132, `First clear: ${rewardLine(floorReward(next))}`, { ...text.body(15, PAL.amber), wordWrap: { width: bw - 36 } });
      makeButton(this, GAME_W / 2, y + h - 2, 220, 56, 'Climb', () => this.climb(next), { active: true, fontSize: 20, icon: 'blade' });
      y += h + 40;

      this.add.text(PAD, y, 'ABOVE', text.hud(13, PAL.amber));
      y += 22;
      for (let n = next + 1; n <= Math.min(TOWER_FLOORS, next + 5); n++) {
        const g = floorDef(n);
        this.add.rectangle(GAME_W / 2, y + 27, bw, 54, 0x18111a).setStrokeStyle(1, g.boss ? 0x7a3a44 : PAL.armorShadow);
        this.add.text(PAD + 12, y + 8, `${n}`, text.hud(14, g.boss ? 0xe58a8a : PAL.steel));
        this.add.text(PAD + 52, y + 6, g.boss ? `Boss: ${foesOf(g).split(',')[0]}` : foesOf(g), { ...text.body(15, PAL.muted), wordWrap: { width: bw - 70 } }).setCrop(0, 0, bw - 70, 22);
        this.add.text(PAD + 52, y + 28, ruleText(g.rule) || rewardLine(floorReward(n), false), text.body(14, g.rule ? 0xe5a86a : PAL.steel));
        this.add.text(GAME_W - PAD - 12, y + 32, `REC ${formatPower(floorRecommended(save, n))}`, text.hud(11, PAL.steel)).setOrigin(1, 0);
        y += 60;
      }
    }
    if (this.notice) toast(this, this.notice);
  }

  private climb(floor: number) {
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
            const r = finishFloor(save, floor, battle);
            const notice = r.reward ? `Floor ${floor} taken: ${rewardLine(r.reward)}${r.gear ? `\n${r.gear.name} (${r.gear.rarity})` : ''}` : 'Driven back down the stair. Climb again when ready.';
            return { scene: 'Tower', data: { notice } };
          },
        };
        this.scene.start('Battle');
      },
    );
  }
}
