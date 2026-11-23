import Phaser from 'phaser';
import { FONT, GAME_W, PAL, hex } from '../config';
import { game } from '../state/game';
import { current, type Challenge } from '../state/run';
import { saveSettings, settings } from '../state/settings';
import { makeButton } from './button';
import type { RunState } from '../systems/crusade';
import type { Battle } from '../systems/combat';
import { battleHosanna } from '../systems/hosanna';
import { advanceField, screenField, type FieldBattle } from '../systems/field';
import { newSeed, seeded } from '../systems/rng';
import { settleBattle, type Settled } from '../systems/settle';

/**
 * A fight on Auto keeps going when the player opens another tab: it plays out
 * here in real time with no screen. While it runs the Crusade tab
 * wears a badge and leads back into the fight; when it ends a notice says how
 * it went, and the Crusade tab (or the notice) opens what comes next.
 */
interface Running {
  battle: Battle;
  /** The fight on the open field: it plays on in real time with no screen. */
  field: FieldBattle;
  vigilMax: number;
  run?: RunState;
  challenge?: Challenge;
  timer: ReturnType<typeof setTimeout>;
}

export const bgFight: {
  game?: Phaser.Game;
  running?: Running;
  /** A fight that ended in the background, waiting to be looked at. */
  done?: Settled;
} = {};

/** Real milliseconds between background steps; each plays that much fight at the chosen speed. */
const FIELD_MS = 250;

/** Hands an Auto fight to the background: it plays on in real time. */
export function runFieldInBackground(field: FieldBattle, vigilMax: number) {
  stopBackground();
  bgFight.done = undefined;
  field.opts.manualLitany = false;
  bgFight.running = { battle: field.battle, field, vigilMax, run: current.run, challenge: current.challenge, timer: schedule() };
}

/** Takes the running fight back (the Battle screen shows it again). */
export function takeBackground(): Running | undefined {
  const r = bgFight.running;
  if (!r) return undefined;
  clearTimeout(r.timer);
  bgFight.running = undefined;
  // Another screen may have changed these while away: the fight's own come back.
  current.challenge = r.challenge;
  if (r.run) current.run = r.run;
  return r;
}

export function stopBackground() {
  if (bgFight.running) clearTimeout(bgFight.running.timer);
  bgFight.running = undefined;
}

/** Where the Crusade tab leads: back into a fight, or to its outcome. */
export function crusadeTabTarget(): { scene: string; data?: object } | undefined {
  if (bgFight.running) return { scene: 'Battle' };
  if (bgFight.done) {
    const d = bgFight.done;
    bgFight.done = undefined;
    return { scene: d.scene, data: d.data };
  }
  return undefined;
}

/**
 * Stops a running Auto fight: Auto goes off and the fight waits at the next
 * Sister's turn, as if paused from the screen. Pick it up from the Crusade
 * tab, or leave it be. An Auto-push stops there too.
 */
export function stopAuto(): string {
  const r = bgFight.running;
  if (!r) return '';
  clearTimeout(r.timer);
  settings.autoBattle = false;
  saveSettings();
  // The fight simply waits where it stands, Litanies back in the player's hands.
  r.field.opts.manualLitany = true;
  bgFight.running = undefined;
  current.challenge = r.challenge;
  if (r.run) current.run = r.run;
  current.paused = { battle: r.battle, field: r.field, vigilMax: r.vigilMax, run: r.challenge ? undefined : r.run, floor: r.run?.floor, at: r.run?.at, challenge: r.challenge };
  return 'Auto halted. The fight waits on the Crusade tab.';
}

function schedule() {
  return setTimeout(tick, FIELD_MS);
}

function tick() {
  const r = bgFight.running;
  if (!r) return;
  const outcome = advanceField(r.field, (FIELD_MS / 1000) * (settings.battleSpeed || 1));
  if (outcome) return finish(r, outcome);
  r.timer = schedule();
}

function finish(r: Running, outcome: 'victory' | 'defeat') {
  current.challenge = r.challenge;
  if (r.run) current.run = r.run;
  const s = settleBattle(r.battle, outcome);
  // Auto-push marches straight on to the next stage.
  if (s.scene === 'Battle' && current.challenge && settings.autoBattle) {
    r.battle = current.challenge.make(seeded(newSeed()));
    r.vigilMax = r.battle.vigil;
    r.challenge = current.challenge;
    r.field = screenField(r.battle, false, battleHosanna(game.save, r.battle));
    r.timer = schedule();
    return;
  }
  bgFight.running = undefined;
  bgFight.done = s;
  const notice = (s.data as { notice?: string } | undefined)?.notice;
  const head = s.won ? 'Auto fight won!' : 'Auto fight lost';
  toast(`${head}. ${notice ?? s.line.trim()}`, s.won);
}

/** A fight that ended while the game was closed: the Crusade tab leads to it, and a notice says how it went. */
export function announceSettled(s: Settled) {
  bgFight.done = s;
  toast(`${s.won ? 'The fight you left was won' : 'The fight you left was lost'} while you were away. ${s.line.trim()}`, s.won);
}

/** A notice across the top of whatever screen is open; tap it to see the outcome. */
function toast(msg: string, won: boolean) {
  topNotice(`${msg}\nTap to see.`, won, (scene) => {
    const go = crusadeTabTarget();
    if (go) scene.scene.start(go.scene, go.data ?? {});
  });
}

/** A notice across the top of whatever screen is open; `onTap` runs when it is tapped. */
export function topNotice(msg: string, good: boolean, onTap?: (scene: Phaser.Scene) => void) {
  const scene = bgFight.game?.scene.getScenes(true).filter((s) => s.scene.key !== 'Boot').at(-1);
  if (!scene) return;
  refreshBadges(scene);
  const box = scene.add.container(GAME_W / 2, -60).setDepth(200);
  const body = scene.add.text(0, 0, msg, { fontFamily: FONT, fontSize: '17px', color: hex(PAL.ivory), align: 'center', wordWrap: { width: GAME_W - 70 } }).setOrigin(0.5);
  const bg = scene.add.rectangle(0, 0, GAME_W - 40, body.height + 22, 0x1b121c, 0.96).setStrokeStyle(2, good ? PAL.amber : 0xb04040);
  box.add([bg, body]);
  bg.setInteractive({ useHandCursor: true }).on('pointerup', () => {
    box.destroy();
    onTap?.(scene);
  });
  scene.tweens.add({ targets: box, y: body.height / 2 + 24, duration: 260, ease: 'Back.out' });
  scene.time.delayedCall(6000, () => scene.tweens.add({ targets: box, alpha: 0, duration: 400, onComplete: () => box.destroy() }));
}

/** Badges drawn on the Crusade tab, so they can change when the fight ends. */
const badges = new Set<Phaser.GameObjects.Text>();

/** The Crusade tab's badge: "Auto" while a fight runs, its outcome once it ends. */
export function drawBadge(scene: Phaser.Scene, x: number, y: number, depth: number) {
  if (!bgFight.running && !bgFight.done) return undefined;
  const t = scene.add.text(x, y, '', { fontFamily: FONT, fontSize: '13px', color: hex(PAL.ivory), padding: { x: 5, y: 2 } }).setOrigin(0.5).setDepth(depth + 1);
  badges.add(t);
  // Tapping the badge while a fight runs offers Watch or Stop.
  t.setInteractive({ useHandCursor: true }).on('pointerup', (_p: unknown, _x: unknown, _y: unknown, e: Phaser.Types.Input.EventData) => {
    if (!bgFight.running) return;
    e?.stopPropagation();
    autoPanel(scene);
  });
  t.once(Phaser.GameObjects.Events.DESTROY, () => badges.delete(t));
  paint(t);
  if (bgFight.running) scene.tweens.add({ targets: t, alpha: { from: 1, to: 0.55 }, duration: 600, yoyo: true, repeat: -1 });
  return t;
}

function paint(t: Phaser.GameObjects.Text) {
  if (bgFight.running) t.setText('AUTO').setBackgroundColor('#7a2f2f');
  else if (bgFight.done) t.setText(bgFight.done.won ? 'WON' : 'LOST').setBackgroundColor(bgFight.done.won ? '#8a6a1c' : '#5a2a2a');
}

function refreshBadges(scene: Phaser.Scene) {
  for (const t of badges) {
    if (!t.active) continue;
    scene.tweens.killTweensOf(t);
    t.setAlpha(1);
    paint(t);
  }
}

/** Watch the running Auto fight, or stop it. */
export function autoPanel(scene: Phaser.Scene) {
  const r = bgFight.running;
  if (!r) return;
  const layer = scene.add.container(0, 0).setDepth(210);
  const H = scene.scale.gameSize.height;
  layer.add(scene.add.rectangle(GAME_W / 2, H / 2, GAME_W, H, 0x09060b, 0.75).setInteractive().on('pointerup', () => layer.destroy()));
  layer.add(scene.add.rectangle(GAME_W / 2, H / 2, GAME_W - 60, 250, 0x241925).setStrokeStyle(2, PAL.goldEdge).setInteractive());
  const what = r.challenge ? r.challenge.label.split('.')[0] : 'A crypt fight';
  layer.add(scene.add.text(GAME_W / 2, H / 2 - 80, `${what} is playing on Auto.${r.battle.round ? `\nRound ${r.battle.round}.` : ''}`, { fontFamily: FONT, fontSize: '19px', color: hex(PAL.ivory), align: 'center', wordWrap: { width: GAME_W - 100 } }).setOrigin(0.5));
  const watch = makeButton(scene, GAME_W / 2 - 110, H / 2 + 40, 190, 56, 'Watch', () => scene.scene.start('Battle', {}));
  const stop = makeButton(scene, GAME_W / 2 + 110, H / 2 + 40, 190, 56, 'Stop Auto', () => {
    const msg = stopAuto();
    scene.scene.restart();
    // the note shows on the fresh screen
    scene.events.once(Phaser.Scenes.Events.CREATE, () => note(scene, msg));
  }, { active: true });
  layer.add([...watch.all, ...stop.all]);
}

function note(scene: Phaser.Scene, msg: string) {
  const t = scene.add.text(GAME_W / 2, 40, msg, { fontFamily: FONT, fontSize: '17px', color: hex(PAL.ivory), backgroundColor: '#1b121c', padding: { x: 10, y: 8 }, align: 'center', wordWrap: { width: GAME_W - 60 } }).setOrigin(0.5, 0).setDepth(200);
  scene.time.delayedCall(4000, () => scene.tweens.add({ targets: t, alpha: 0, duration: 400, onComplete: () => t.destroy() }));
}
