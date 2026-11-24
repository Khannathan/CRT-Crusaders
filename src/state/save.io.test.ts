import { describe, expect, it } from 'vitest';
import { exportSave, importSave, newSave } from './save';

describe('save export and import', () => {
  it('round-trips a save through a code and through raw JSON', () => {
    const s = newSave();
    s.seals = 1234;
    s.owned['VT-SSR-VEI'] = { level: 42, vow: 2 };
    (s as { note?: string }).note = 'Sœur Él';
    const code = exportSave(s);
    expect(code.startsWith('CRT1.')).toBe(true);
    expect(importSave(code)).toEqual(s);
    expect(importSave(`  ${code.slice(0, 20)}\n${code.slice(20)} `)).toEqual(s);
    expect(importSave(JSON.stringify(s))?.seals).toBe(1234);
  });

  it('rejects text that is not a save', () => {
    expect(importSave('hello')).toBeUndefined();
    expect(importSave('CRT1.e30=')).toBeUndefined();
    expect(importSave('{"version":2}')).toBeUndefined();
  });
});
