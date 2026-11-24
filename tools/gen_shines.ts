import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { KITS } from '../src/data/kits';
import { HUNTS } from '../src/systems/hunts';
import { SHINE_LABEL, nicheTableAsync, rankIn } from '../src/systems/niche';

/** For each hand-made kit: the hunts where she ranks in the top third of her role on the field (best first, up to 3). */
it('writes src/data/shines.ts', async () => {
  const rows = await nicheTableAsync({ seeds: 4, engine: 'field' });
  const made = rows.filter((x) => !KITS[x.id]?.generated);
  const out: Record<string, string[]> = {};
  for (const r of made) {
    const n = made.filter((x) => x.role === r.role).length;
    const good = HUNTS.map((h) => ({ h: h.id, rank: rankIn(made, r.id, h.id) }))
      .filter((x) => x.rank <= Math.ceil(n / 3))
      .sort((a, b) => a.rank - b.rank)
      .slice(0, 3)
      .map((x) => SHINE_LABEL[x.h]);
    out[r.id] = good;
  }
  const body = Object.entries(out)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, l]) => `  '${id}': [${l.map((s) => `'${s}'`).join(', ')}],`)
    .join('\n');
  writeFileSync(
    'src/data/shines.ts',
    `/**\n * "Shines in" hunts for the hand-made kits, read off the field niche sim.\n * Generated: \`npx vitest run --config tools/shines.config.ts\` rewrites this file.\n * Rerun it after any change to kits, stats or the Kit Forge.\n */\nexport const FIELD_SHINES: Record<string, string[]> = {\n${body}\n};\n`,
  );
});
