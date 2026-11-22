import { describe, expect, it } from 'vitest';
import { newSave } from '../state/save';
import { PRESET_MAX, deletePreset, presetIconsFor, presetsOf, savePreset, setPresetIcon } from './presets';

describe('party presets', () => {
  const save = newSave();
  ['a', 'b', 'c', 'd', 'e'].forEach((id) => (save.owned[id] = { level: 1, vow: 0 }));

  it('saves, overwrites, re-icons and deletes', () => {
    expect(savePreset(save, ['a', 'b', 'zzz'], 'ui-blade')).toBe(0);
    expect(presetsOf(save)[0].party).toEqual(['a', 'b']);
    savePreset(save, ['c', 'd', 'e', 'a', 'b'], 'ui-shield', 0);
    expect(presetsOf(save)[0]).toMatchObject({ icon: 'ui-shield', party: ['c', 'd', 'e', 'a'] });
    savePreset(save, ['a'], 'ui-flame');
    setPresetIcon(save, 1, 'ui-book');
    expect(presetIconsFor(save, 'a')).toEqual(['ui-shield', 'ui-book']);
    expect(presetIconsFor(save, 'b')).toEqual([]);
    deletePreset(save, 0);
    expect(presetIconsFor(save, 'a')).toEqual(['ui-book']);
  });

  it('holds at most PRESET_MAX', () => {
    while (presetsOf(save).length < PRESET_MAX) savePreset(save, ['a'], 'ui-blade');
    expect(savePreset(save, ['a'], 'ui-blade')).toBe(-1);
  });
});
