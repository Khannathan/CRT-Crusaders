import { describe, expect, it } from 'vitest';
import { ORDERS, ORDER_LIST } from './orders';

describe('Order creeds and rivals', () => {
  it('every Order has a creed, lore, a crucifix and one sworn rival, and the rivals pair up', () => {
    for (const o of ORDER_LIST) {
      expect(o.creed, o.name).toBeTruthy();
      expect(o.lore, o.name).toBeTruthy();
      expect(o.cross, o.name).toBeTruthy();
      expect(ORDERS[o.rival], `${o.name} rival`).toBeDefined();
      expect(o.rival).not.toBe(o.name);
      expect(ORDERS[o.rival].rival, `${o.rival} feuds back`).toBe(o.name);
    }
  });

  it('the text is zealous, not righteous', () => {
    for (const o of ORDER_LIST) expect(`${o.creed} ${o.lore}`, o.name).not.toMatch(/\b(holy|righteous|blessed)\b/i);
  });
});
