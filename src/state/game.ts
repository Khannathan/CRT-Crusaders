import { clearSave, loadSave, newSave, writeSave, type SaveData } from './save';

/** The live save, shared by every scene. Call commit() after changing it. */
export const game: { save: SaveData } = { save: loadSave() };

export function commit() {
  writeSave(game.save);
}

export function resetGame() {
  clearSave();
  game.save = newSave();
}
