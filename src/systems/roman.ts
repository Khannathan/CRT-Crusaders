/** Roman numerals for tiers, ranks and acts (1 to 399). */
export function roman(n: number): string {
  const map: [number, string][] = [[100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [v, s] of map) while (n >= v) (out += s), (n -= v);
  return out;
}
