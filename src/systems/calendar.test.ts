import { describe, expect, it } from 'vitest';
import { blessingsWeek, calendar, nextSaint } from './calendar';
import { limitedWindow } from './limited';

const T0 = new Date(2026, 10, 25, 12).getTime(); // a Wednesday

describe('the Calendar', () => {
  it('starts this week on Monday and covers four weeks', () => {
    const weeks = calendar(T0);
    expect(weeks).toHaveLength(4);
    expect(new Date(weeks[0].starts).getDay()).toBe(1);
    expect(weeks[1].starts - weeks[0].starts).toBeGreaterThan(6.9 * 864e5);
  });

  it("shows this week's running Saint, and the next Saint in the week her banner opens", () => {
    const weeks = calendar(T0);
    const cur = limitedWindow(T0);
    expect(weeks[0].events.some((e) => e.kind === 'saint' && e.running && e.title.endsWith(cur.saint.name))).toBe(true);
    const next = nextSaint(T0)!;
    const wk = weeks.find((w) => next.starts >= w.starts && next.starts < w.ends)!;
    expect(wk.events.some((e) => e.kind === 'saint' && !e.running && e.title.endsWith(next.saint.name))).toBe(true);
    expect(wk.events.some((e) => e.kind === 'feast')).toBe(true);
  });

  it('marks every week turn and lists seven days of blessings', () => {
    for (const w of calendar(T0)) expect(w.events.filter((e) => e.kind === 'weekly')).toHaveLength(1);
    const days = blessingsWeek(T0);
    expect(days).toHaveLength(7);
    expect(days.every((d) => d.boosts.length > 0)).toBe(true);
  });
});
