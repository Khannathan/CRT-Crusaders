import Phaser from 'phaser';
import { GAME_W, PAL } from '../config';
import { commit, game } from '../state/game';
import { current } from '../state/run';
import {
  FAVOURED,
  PROCESSION_ENTRIES,
  PROCESSION_TIERS,
  finishProcession,
  honouredToday,
  offeringsHeld,
  offeringsText,
  processionBattle,
  processionLeft,
  processionRecommended,
  tierOpen,
} from '../systems/offerings';
import { partyPower } from '../systems/power';
import { makeButton } from '../ui/button';
import { modeScreen, toast } from '../ui/modeScreen';
import { drawOfferingIcon } from '../ui/offeringIcon';
import { pickParty } from '../ui/partyPicker';
import { drawRecommended } from '../ui/recommended';
import { addOrderSigil } from '../ui/sisterCard';
import { tapForSources } from '../ui/sources';
import { PAD, addFrame, text } from '../ui/theme';

const POTENCY_NAME = { common: 'common', fine: 'fine', holy: 'holy' } as const;

/**
 * The Reliquary Procession: carry the relics through the dead. Three victories
 * a day (a loss costs nothing), four tiers, each won opening the next. Wins pay
 * offerings for Confession, leaning to the favourites of the Order honoured today.
 */
export class ProcessionScene extends Phaser.Scene {
  private notice?: string;

  constructor() {
    super('Procession');
  }

  init(data: { notice?: string }) {
    this.notice = data?.notice;
  }

  create() {
    const save = game.save;
    const { top } = modeScreen(this, 'The Procession', '');
    const bw = GAME_W - PAD * 2;
    const left = processionLeft(save);
    this.add.text(PAD, top, `VICTORIES LEFT TODAY ${left}/${PROCESSION_ENTRIES}`, text.hud(14, left ? PAL.amber : PAL.steel));
    tapForSources(this, this.add.text(GAME_W - PAD, top, `OFFERINGS HELD ${offeringsHeld(save)}`, text.hud(12, PAL.muted)).setOrigin(1, 0), 'offerings');

    // Today's honoured Order and its favourites.
    const order = honouredToday();
    let y = top + 30;
    addFrame(this, GAME_W / 2, y + 44, bw, 88, { fill: 0x1e1520 });
    addOrderSigil(this, PAD + 36, y + 44, order.name, 48);
    this.add.text(PAD + 72, y + 12, 'TODAY THE PROCESSION HONOURS', text.hud(11, PAL.steel));
    this.add.text(PAD + 72, y + 28, `The ${order.name}`, text.display(18, 0xfff1d6));
    this.add.text(PAD + 72, y + 56, 'More of its favourites drop:', text.body(14, PAL.muted));
    (FAVOURED[order.name] ?? []).forEach((id, i) => {
      const x = GAME_W - PAD - 34 - i * 56;
      drawOfferingIcon(this, x, y + 44, id, 44);
      this.add.star(x + 20, y + 24, 5, 4, 9, PAL.amber);
    });
    y += 100;

    const party = save.lastParty.filter((id) => save.owned[id]);
    PROCESSION_TIERS.forEach((t, tier) => {
      const h = 108;
      const open = tierOpen(save, tier);
      addFrame(this, GAME_W / 2, y + h / 2, bw, h, { fill: open ? 0x1e1520 : 0x151017, edge: open ? PAL.goldEdge : PAL.armorShadow });
      this.add.text(PAD + 14, y + 12, t.name.toUpperCase(), text.hud(13, open ? PAL.amber : PAL.steel));
      const win = (Object.entries(t.win) as [keyof typeof POTENCY_NAME, number][]).map(([p, n]) => `${n} ${POTENCY_NAME[p]}`).join(' + ');
      this.add.text(PAD + 14, y + 34, open ? `Wins ${win} offering${t.win.fine || t.win.holy || (t.win.common ?? 0) > 1 ? 's' : ''}` : 'Locked', text.body(15, open ? PAL.ivory : PAL.steel));
      if (open) {
        drawRecommended(this, PAD + 14, y + 66, processionRecommended(save, tier), partyPower(save, party), { size: 12, label: 'PARTY' });
        makeButton(this, GAME_W - PAD - 70, y + h / 2, 116, 52, 'Walk', () => this.fight(tier), { active: left > 0, disabled: left <= 0, icon: 'blade', fontSize: 17 });
      }
      y += h + 8;
    });

    this.add.text(PAD, y + 4, 'A loss spends no entry. Give offerings to Sisters in Confession.', { ...text.body(14, PAL.muted), wordWrap: { width: bw } });
    if (this.notice) toast(this, this.notice);
  }

  private fight(tier: number) {
    const save = game.save;
    const t = PROCESSION_TIERS[tier];
    pickParty(
      this,
      save,
      { title: t.name, sub: 'Tap Sisters in rank order; the first stands in front.', initial: save.lastParty, confirm: 'Walk', rec: processionRecommended(save, tier) },
      (party) => {
        current.challenge = {
          label: `${t.name}. The relics pass, and the dead rise to take them back.`,
          make: (rng) => processionBattle(save, party, tier, rng),
          finish: (_outcome, battle) => {
            const r = finishProcession(save, tier, battle);
            commit();
            const notice = r.won ? `The relics are safe. Offerings: ${offeringsText(r.offerings)}` : 'The procession is driven back. No entry was spent.';
            return { scene: 'Procession', data: { notice } };
          },
        };
        this.scene.start('Battle');
      },
    );
  }
}
