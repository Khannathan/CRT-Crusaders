import { DEEP_HOSTS } from '../data/deepFoes';
import { current } from '../state/run';
import type { Battle } from '../systems/combat';
import { CRYPTS } from '../systems/crusade';
import { HUNTS } from '../systems/hunts';
import { setSceneMusic, type LoopId } from './music';

const DEEP_IDS = new Set(DEEP_HOSTS.map((h) => h.crypt));
const HUNT_BOSSES = new Set(HUNTS.map((h) => h.boss));
/** True while the party is in one of the sixteen deeper crypts. */
const inDeep = (cryptId?: string) => !!cryptId && DEEP_IDS.has(cryptId);

/** The loop for a fight: hunt bosses, the First Heretic, the deeper crypts, else the usual pair. */
export function battleLoop(battle: Pick<Battle, 'units'>): LoopId {
  const boss = battle.units.find((u) => u.side === 'enemy' && u.boss);
  if (boss && HUNT_BOSSES.has(boss.ref)) return 'hunt';
  if (boss?.ref === 'first-heretic') return 'heretic';
  const deep = inDeep(current.run?.crypt.id);
  if (boss) return deep ? 'deep-boss' : 'boss';
  return deep ? 'deep-battle' : 'battle';
}

/** The deeper crypts' map screens play their own loop. */
export function wireSceneMusic() {
  const cryptLoop = (): LoopId => (inDeep(current.run?.crypt.id) ? 'deep-crypt' : 'crypt');
  setSceneMusic('Crypt', cryptLoop);
  setSceneMusic('Muster', cryptLoop);
  // The Crusade tab plays the deep theme while a deeper crypt is picked.
  setSceneMusic('Crusade', () => (inDeep(current.cryptId ?? CRYPTS[0].id) ? 'deep-crypt' : 'crypt'));
}
