import { describe, expect, it } from 'vitest';
import { newSave } from '../state/save';
import { ITEMS } from './items';
import { amountOf, costFocus, resourceInfo } from './sources';

describe('resource sources', () => {
  it('every material and currency says where it comes from', () => {
    for (const id of [...ITEMS.map((i) => i.id), 'gilt', 'alms', 'seals', 'tithes', 'vows', 'shards'] as const) {
      const info = resourceInfo(id);
      expect(info.name).toBeTruthy();
      expect(info.sources.length).toBeGreaterThan(0);
    }
  });

  it('a cost points at what you are short of', () => {
    const save = newSave();
    save.items = { page1: 20, page2: 0 };
    save.tithes = 0;
    expect(costFocus(save, { page1: 15, page2: 3 }, 800)).toBe('page2');
    save.items.page2 = 5;
    expect(costFocus(save, { page1: 15, page2: 3 }, 800)).toBe('tithes');
    expect(amountOf(save, 'page1')).toBe(20);
  });
});
