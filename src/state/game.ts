import { clearSave, loadSave, newSave, writeSave, type SaveData } from './save';
import { current } from './run';
import { moveIds } from './rosterMigration';

/** The live save, shared by every scene. Call commit() after changing it. */
export const game: { save: SaveData } = { save: loadSave() };

/**
 * The crypt run in progress, kept beside the save so a reload (or Android
 * closing the tab in the background) doesn't throw away a long descent.
 * The crypt is stored by id and looked up again on load (see restoreRun).
 */
const RUN_KEY = 'crt-crusaders.run.v1';

function writeRun() {
  try {
    const run = current.run;
    if (run) localStorage.setItem(RUN_KEY, JSON.stringify({ ...run, crypt: run.crypt.id }));
    else localStorage.removeItem(RUN_KEY);
  } catch {
    // storage unavailable: the run lives for this session only
  }
}

/** The stored run with its crypt as an id, if one was left unfinished. */
export function storedRun(): (Omit<NonNullable<typeof current.run>, 'crypt'> & { crypt: string }) | undefined {
  try {
    const raw = localStorage.getItem(RUN_KEY);
    return raw ? JSON.parse(moveIds(raw)) : undefined;
  } catch {
    return undefined;
  }
}

export function commit() {
  writeSave(game.save);
  writeRun();
}

export function resetGame() {
  clearSave();
  game.save = newSave();
  current.run = undefined;
  current.paused = undefined;
  current.challenge = undefined;
  writeRun();
}
