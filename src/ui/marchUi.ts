import Phaser from 'phaser';
import { GAME_H, GAME_W, PAL } from '../config';
import { commit, game } from '../state/game';
import { settings } from '../state/settings';
import { stageDef } from '../systems/campaign';
import { bagText } from '../systems/items';
import { advanceMarch, clearMarchSummary, clearedText, marchOf, marchSummary, setMarch, stopText, type MarchSummary } from '../systems/march';
import { topNotice } from './bgFight';
import { makeButton } from './button';
import { addFrame, text } from './theme';

/**
 * The March on screen: the toggle, a status line, the summary of what it
 * cleared, and the clock that keeps it going on every screen (systems/march.ts).
 */
export const marchUi: {
  /** Stages were cleared while the game was closed: the Sanctum shows the summary. */
  away?: boolean;
  timer?: ReturnType<typeof setInterval>;
} = {};

/** Plays out the time the game was closed, then keeps the March going. Call once on open. */
export function catchUpMarch() {
  startMarchClock();
  const before = marchOf(game.save)?.cleared.length ?? 0;
  if (!advanceMarch(game.save, Date.now(), settings.battleSpeed)) return;
  commit();
  const m = marchOf(game.save)!;
  if (m.cleared.length > before || m.stopped) marchUi.away = true;
}

/** Keeps the March going while the game is open, whatever screen shows. */
export function startMarchClock() {
  if (marchUi.timer) return;
  marchUi.timer = setInterval(() => {
    const save = game.save;
    const m = marchOf(save);
    if (!m?.on) return;
    if (!advanceMarch(save, Date.now(), settings.battleSpeed)) return;
    commit();
    if (!m.on && m.stopped) {
      const msg = `The Vigil's march has halted. ${stopText(m.stopped)}\nTap to see.`;
      topNotice(msg, m.stopped.why === 'end', (scene) => scene.scene.start('Sanctum', {}));
    }
  }, 1000);
}

/** The March toggle: "March: On" lit while it runs. */
export function drawMarchToggle(scene: Phaser.Scene, x: number, y: number, w: number, h: number, fontSize = 15) {
  const on = !!marchOf(game.save)?.on;
  return makeButton(
    scene,
    x,
    y,
    w,
    h,
    on ? 'March: On' : 'March: Off',
    () => {
      setMarch(game.save, !on, Date.now());
      advanceMarch(game.save, Date.now(), settings.battleSpeed);
      commit();
      scene.scene.restart();
    },
    { active: on, fontSize, icon: 'blade' },
  );
}

/** One short line on the March: running, halted, or what it cleared. Empty when there is nothing to say. */
export function marchLine(): { text: string; good: boolean } {
  const m = marchOf(game.save);
  if (!m) return { text: '', good: true };
  if (m.stopped) return { text: m.stopped.why === 'end' ? 'MARCH DONE: THE ROAD IS WALKED ›' : `MARCH HALTED AT ${stageDef(Math.max(1, m.stopped.n)).label} ›`, good: m.stopped.why === 'end' };
  if (m.on) {
    const at = m.fight ? stageDef(m.fight.n).label : '';
    const tries = m.tries ? ` · TRY ${m.tries + 1}` : '';
    return { text: `MARCHING${at ? ` ON ${at}` : ''}${tries} · ${m.cleared.length} CLEARED ›`, good: true };
  }
  return m.cleared.length ? { text: `MARCH: ${m.cleared.length} CLEARED ›`, good: true } : { text: '', good: true };
}

function rewardLine(s: MarchSummary) {
  const r = s.reward;
  return [r.tithes ? `${r.tithes} Tithes` : '', r.seals ? `${r.seals} Seal${r.seals > 1 ? 's' : ''}` : '', r.gilt ? `${r.gilt} Gilt` : '', r.stigmata ? `${r.stigmata} Stigmata` : '', bagText(r.items)].filter(Boolean).join(' + ');
}

/** What the March cleared and why it halted. Done starts the count afresh. */
export function showMarchSummary(scene: Phaser.Scene, away = false) {
  const save = game.save;
  const s = marchSummary(save);
  if (!s) return false;
  const m = marchOf(save)!;
  const layer = scene.add.container(0, 0).setDepth(40);
  layer.add(scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x09060b, 0.9).setInteractive());
  const lines = [
    away ? 'While you were away, your Sisters marched on!' : '',
    clearedText(s.cleared) + (s.cleared.length ? '!' : '.'),
    s.cleared.length ? `First clears: ${rewardLine(s)}` : '',
    s.exp ? `+${s.exp} EXP to each Sister` : '',
    s.scenes ? `${s.scenes} story scene${s.scenes > 1 ? 's' : ''} passed on the way. Hear ${s.scenes > 1 ? 'them' : 'it'} in the Chronicle.` : '',
    s.stopped ? `\n${stopText(s.stopped)}` : m.on ? '\nThe march goes on.' : '',
  ].filter(Boolean);
  const t = scene.add.text(GAME_W / 2, 200, lines.join('\n'), { ...text.body(17, PAL.ivory), align: 'center', lineSpacing: 4, wordWrap: { width: GAME_W - 100 } }).setOrigin(0.5, 0);
  const h = t.height + 130;
  layer.add(addFrame(scene, GAME_W / 2, 140 + h / 2, GAME_W - 40, h, { fill: 0x241925 }));
  layer.add(scene.add.text(GAME_W / 2, 166, 'THE MARCH', text.display(24, PAL.amber)).setOrigin(0.5));
  layer.add(t);
  const close = () => {
    clearMarchSummary(save);
    commit();
    scene.scene.restart();
  };
  const halted = s.stopped && s.stopped.why !== 'end';
  if (halted) {
    const again = makeButton(scene, GAME_W / 2 - 112, 140 + h - 44, 200, 54, 'March again', () => {
      clearMarchSummary(save);
      setMarch(save, true, Date.now());
      commit();
      scene.scene.restart();
    }, { active: true, fontSize: 17 });
    const done = makeButton(scene, GAME_W / 2 + 112, 140 + h - 44, 200, 54, 'Done', close, { fontSize: 17 });
    layer.add([...again.all, ...done.all]);
  } else layer.add(makeButton(scene, GAME_W / 2, 140 + h - 44, 220, 54, 'Done', close, { active: true }).all);
  return true;
}
