import { beforeEach, describe, expect, it, vi } from 'vitest';

// A tiny in-memory localStorage for node.
function fakeStorage() {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
  };
}

describe('daily save backups', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', fakeStorage());
    vi.resetModules();
    vi.useRealTimers();
  });

  it('keeps one backup per day, the last 3 days', async () => {
    vi.useFakeTimers();
    const { newSave, writeSave, autoBackups, AUTO_KEEP } = await import('./save');
    for (let d = 1; d <= 5; d++) {
      vi.setSystemTime(new Date(2026, 10, d, 12));
      const s = newSave();
      s.seals = d;
      writeSave(s);
      s.seals = d + 100; // a later save the same day leaves that day's backup alone
      writeSave(s);
    }
    const b = autoBackups();
    expect(b).toHaveLength(AUTO_KEEP);
    expect(b.map((x) => x.save.seals)).toEqual([5, 4, 3]);
  });

  it('falls back to the newest backup when the save is damaged', async () => {
    const { newSave, writeSave, loadSave } = await import('./save');
    const s = newSave();
    s.seals = 777;
    writeSave(s);
    localStorage.setItem('crt-crusaders.save.v1', '{"version":1,"owned":'); // cut off mid-write
    expect(loadSave().seals).toBe(777);
  });
});
