/**
 * Combat runs in real time, so no player-facing text speaks of turns, rounds or
 * ranks. Skill data keeps its counts (a "turn" of a status is PULSE = 2 seconds
 * on the fight clock, a cooldown of N lasts 2(N + 1) seconds, a round is 2
 * seconds), and this turns the authored words into seconds and positions:
 *
 * - for 2 turns -> for 4s; Cooldown 2 -> Cooldown 6s; 4% a round -> 4% every 2s
 * - rank 1-2 -> a front-line foe (the two foes nearest the Sisters); rank 1-3 ->
 *   a near foe (the three nearest); any rank -> any foe; a Sister's ranks 1-2
 *   and 3-4 are her Vanguard and Rearguard
 * - Delay / "its turn goes to the end" -> Stagger (its next attack comes late,
 *   breaking a charge); "acts first" -> Haste; "lose its next turn" -> Stunned
 *
 * realtime.test.ts fails if any turn, round or rank slips through.
 */
const NUM: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5 };
const n = (w: string) => NUM[w.toLowerCase()] ?? Number(w);
const secs = (turns: number) => `${+(turns * 2).toFixed(1)}s`;

/** [pattern, replacement], applied in order. */
const RULES: [RegExp, string | ((...m: string[]) => string)][] = [
  // --- Cooldowns ---
  [/\bCooldown (\d+)\b(?!s)/g, (_, c) => `Cooldown ${2 * (+c + 1)}s`],
  [/-1 cooldown/g, '-2s cooldown'],
  // --- Turn order ---
  [/\bthe next (foe|enemy) to act\b/g, 'the next $1 to attack in her sights'],
  [/\b(and )?push(es)? its turn to the end\b/g, (_, and, es) => `${and ?? ''}Stagger${es ? 's' : ''} it`],
  [/\band its turn goes to the end\b/g, 'and is Staggered'],
  [/\bits turn goes to the end\b/g, 'it is Staggered'],
  [/\band its turn pushed to the end\b/g, 'and Staggered'],
  [/\bto the end of the turn order\b/g, 'into a Stagger'],
  [/\bacts first next round\b/g, 'acts 25% faster for 2s'],
  [/\bact first next round\b/g, 'act 25% faster for 2s'],
  [/\bshe acts first in round 1\b/g, 'she strikes first'],
  [/\bthe foe that acts first\b/g, 'the fastest foe'],
  [/\b(?:and )?act last\b/g, (m) => `${m.startsWith('and') ? 'and ' : ''}act 25% slower`],
  [/\b(foes|enemies) lose their next turns?\b/g, '$1 are Stunned for 2s'],
  [/\bloses? (its|her) next turn\b/g, 'is Stunned for 2s'],
  [/\buntil (her|its|the target's|their) next turn\b/g, 'for 2s'],
  [/\bDelay(ed|s)?\b/g, (_, e) => `Stagger${e ?? ''}`],
  [/\bdelay(ed|s)?\b/g, (_, e) => `stagger${e ?? ''}`],
  // --- Starts of turns and rounds ---
  [/\b[Aa]t the start of (?:her|its|each|every) turn,? /g, (m) => (m[0] === 'A' ? 'Each time she acts, ' : 'each time she acts, ')],
  [/\b[Aa]t the start of (?:each|every) round(?:, | )/g, (m) => (m[0] === 'A' ? 'Every 2s, ' : 'every 2s, ')],
  [/\b[Aa]t the start of the next round\b/g, 'after 2s'],
  [/\bat the start of every round\b/g, 'every 2s'],
  [/\b[Ee]ach round\b/g, (m) => (m[0] === 'E' ? 'Every 2s' : 'every 2s')],
  [/\b[Ee]very round\b/g, (m) => (m[0] === 'E' ? 'Every 2s' : 'every 2s')],
  [/\b[Oo]nce a (?:round|turn)\b/g, (m) => (m[0] === 'O' ? 'Once every 2s' : 'once every 2s')],
  [/\btwice a turn\b/g, 'twice each time she acts'],
  [/\ba (?:turn|round) longer\b/g, '2s longer'],
  [/\bin round 1\b/g, 'at once'],
  // --- Foes' moves ---
  [/\bKnocks a Sister (?:a|one) rank back\b/g, 'Hurls a Sister back'],
  [/\bKnocks a Sister two ranks back\b/g, 'Hurls a Sister far back'],
  [/\bCasts a Sister two ranks back\b/g, 'Casts a Sister far back'],
  [/\bDrags a back-rank Sister into the front line\b/g, 'Drags a Rearguard Sister into the Vanguard'],
  [/\bHammers the front ranks\b/g, 'Hammers the Vanguard'],
  [/\bafter a turn of charging\b/g, 'after a wind-up'],
  [/\bCharges (?:for )?a turn\b/g, 'Winds up'],
  [/\bfires it on its next turn\b/g, 'fires it when its wind-up ends'],
  // --- Durations ---
  [/\bfor (\d+(?:\.\d+)?|an?|one|two|three|four|five) (?:more )?(?:of (?:its|her|their) own )?(?:turns?|rounds?)\b/g, (_, w) => `for ${secs(n(w))}`],
  [/\b(\d+|two|three) more (?:turns|rounds)\b/g, (_, w) => `${secs(n(w))} more`],
  [/\b(\d+(?:\.\d+)?) (?:turns?|rounds?)\b/g, (_, w) => secs(n(w))],
  [/\ba (?:turn|round)\b/g, 'every 2s'],
  // --- Ranks: where a foe stands ---
  [/\bLunge (?:a|two) ranks? forward into rank 1-2\b/g, 'Lunge at a front-line foe'],
  [/\bLunge (?:a|two) ranks? forward into rank 1-3\b/g, 'Lunge at a near foe'],
  [/\bLunge into rank 1-2\b/g, 'Lunge at a front-line foe'],
  [/\bLunge into rank 1-3\b/g, 'Lunge at a near foe'],
  [/\bCrash into rank 1-2\b/g, 'Crash into a front-line foe'],
  [/\bCrash into rank 1-3\b/g, 'Crash into a near foe'],
  [/\brank 1-2\b/g, 'a front-line foe'],
  [/\brank 1-3\b/g, 'a near foe'],
  [/\brank 3-4\b/g, 'a back-line foe'],
  [/\brank 2-4\b/g, 'a foe behind the foremost'],
  [/\bany rank\b/g, 'any foe'],
  [/\bstrike ranks 1 and 2\b/g, 'strike the front line'],
  [/\bthe foe in rank 1\b/g, 'the foremost foe'],
  [/\bthe Sisters in ranks 1 and 2\b/g, 'the Sisters of the Vanguard'],
  [/\bthe Sister in rank 1\b/g, 'the foremost Sister'],
  [/\bfrom rank 3 or 4\b/g, 'from the Rearguard'],
  [/\bfrom rank 1 or 2\b/g, 'from the Vanguard'],
  [/\b(?:she )?stands in rank 1\b/g, (m) => (m.startsWith('she') ? 'she leads the Vanguard' : 'leads the Vanguard')],
  [/\bin rank 1\b/g, 'at the very front'],
  // --- Ranks: knockback and her own footwork ---
  [/\bknocks? (it|them|the foe) (?:a|one) rank back\b/g, (m, w) => `${m.startsWith('knocks') ? 'hurls' : 'hurl'} ${w} back`],
  [/\bknocks? (it|them|the foe) back a rank\b/g, (m, w) => `${m.startsWith('knocks') ? 'hurls' : 'hurl'} ${w} back`],
  [/\bthrows? her (?:a|one) rank back\b/g, (m) => (m.startsWith('throws') ? 'throws her back' : 'throw her back')],
  [/\b([Ss])teps? (?:a|one) rank forward\b/g, (m, s) => `${s === 'S' ? 'D' : 'd'}ash${m.endsWith('forward') && /^steps/i.test(m) ? 'es' : ''} forward`],
  [/\b([Ss])teps? (?:a|one) rank back\b/g, (m, s) => `${s === 'S' ? 'L' : 'l'}eap${/^steps/i.test(m) ? 's' : ''} back`],
  [/\b([Ss])tep back a rank\b/g, (_, s) => `${s === 'S' ? 'L' : 'l'}eap back`],
  [/\b([Ss])tep two ranks back\b/g, (_, s) => `${s === 'S' ? 'L' : 'l'}eap far back`],
  [/\b([Ss])tep two ranks forward\b/g, (_, s) => `${s === 'S' ? 'D' : 'd'}ash far forward`],
  [/\b([Ss])tep forward to rank 1\b/g, (_, s) => `${s === 'S' ? 'D' : 'd'}ash to the very front`],
  [/\b([Ff])all back a rank\b/g, (_, f) => `${f === 'F' ? 'L' : 'l'}eap back`],
  [/\b([Cc])harge a rank forward\b/g, (_, c) => `${c}harge forward`],
  [/\b([Ll])unge (?:a|two) ranks? forward\b/g, (_, l) => `${l}unge forward`],
  [/\bsteps one rank\b/g, 'shifts its line'],
  [/\b([Ss])tep(s)? forward\b(?! to)/g, (_, s, p) => `${s === 'S' ? 'D' : 'd'}ash${p ? 'es' : ''} forward`],
];

/** Real-time wording for a line of combat text. */
export function realtimeText(s: string): string {
  if (!s) return s;
  let out = s;
  for (const [re, to] of RULES) out = out.replace(re, to as never);
  return out;
}

/** Words that must never reach a player in combat text. */
export const TURN_WORDS = /\b(turns?|rounds?|ranks?)\b/i;
