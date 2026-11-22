import type { CrusaderDef, PassiveDef } from './types';

/**
 * Passives for R and SR Sisters, who once had none. Each class has its own,
 * at about half (R) or two-thirds (SR) the strength of an SSR's, so every
 * pull adds something to a party and a starred-up R stays worth fielding.
 */
const BY_CLASS: Record<string, (sr: boolean) => PassiveDef> = {
  warsister: (sr) => ({ name: sr ? 'Scourged Devotion' : 'Penitent Thirst', desc: `Heals for ${sr ? 10 : 7}% of the damage she deals.`, kind: 'lifesteal', value: sr ? 0.1 : 0.07 }),
  hierophant: (sr) => ({ name: sr ? 'Reliquary Ward' : 'Shield Sister', desc: `While she stands, your Sisters take ${sr ? 5 : 3}% less damage.`, kind: 'bulwark', value: sr ? 0.05 : 0.03 }),
  inquisitor: (sr) => ({ name: sr ? 'Swift Judgement' : 'Quick Eyes', desc: `+${sr ? 2 : 1} speed: she acts sooner.`, kind: 'swift', value: sr ? 2 : 1 }),
  confessor: (sr) => ({ name: sr ? 'Dawn Litany' : 'Soft Psalm', desc: `At the start of her turn, every Sister heals ${sr ? 2 : 1.5}% of max HP.`, kind: 'healAura', value: sr ? 0.02 : 0.015 }),
  censer: (sr) => ({ name: sr ? 'Thick Smoke' : 'Smouldering Coals', desc: `Her burns and poisons are ${sr ? 25 : 15}% stronger.`, kind: 'plague', value: sr ? 0.25 : 0.15 }),
  oracle: (sr) => ({ name: sr ? 'Ashen Augury' : 'Small Omen', desc: `Your Sisters start every fight with +${sr ? 7 : 5} Zeal.`, kind: 'startZeal', value: sr ? 7 : 5 }),
};

/** Her own passive, or her class's R/SR passive. */
export function basePassive(c: Pick<CrusaderDef, 'classId' | 'rarity'>): PassiveDef | undefined {
  if (c.rarity !== 'R' && c.rarity !== 'SR') return undefined;
  return BY_CLASS[c.classId]?.(c.rarity === 'SR');
}
