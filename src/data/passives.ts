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
  sentinel: (sr) => ({ name: sr ? 'Tomb Riposte' : 'Warden\'s Reply', desc: `When struck, she strikes back for ${sr ? 35 : 25}% of her attack.`, kind: 'riposte', value: sr ? 0.35 : 0.25 }),
  martyr: (sr) => ({ name: sr ? 'Dawn Unbroken' : 'Last Breath', desc: 'Once a fight, a killing blow leaves her at 1 HP instead.', kind: 'unbroken' }),
  hospitaller: (sr) => ({ name: sr ? 'Chalice Grace' : 'Gentle Hands', desc: `At the start of her turn, every Sister heals ${sr ? 2 : 1.5}% of max HP.`, kind: 'healAura', value: sr ? 0.02 : 0.015 }),
  abbess: (sr) => ({ name: sr ? 'Iron Briars' : 'Thorned Habit', desc: `Foes that strike her take ${sr ? 15 : 10}% of the damage back.`, kind: 'thorns', value: sr ? 0.15 : 0.1 }),
  cantor: (sr) => ({ name: sr ? 'Rising Chorus' : 'Grave Note', desc: `Each foe she kills gives her ${sr ? 9 : 6} Zeal.`, kind: 'zealOnKill', value: sr ? 9 : 6 }),
  adjudicator: (sr) => ({ name: sr ? 'Swift Verdict' : 'Watchful Eye', desc: `+${sr ? 2 : 1} speed: she acts sooner.`, kind: 'swift', value: sr ? 2 : 1 }),
  veilblade: (sr) => ({ name: sr ? 'Mercy Stroke' : 'Quiet Knife', desc: `Deals ${sr ? 15 : 10}% more damage to foes under half HP.`, kind: 'executioner', value: sr ? 0.15 : 0.1 }),
  arbalist: () => ({ name: 'Marked Quarry', desc: 'Her hits on Accused foes always crit.', kind: 'critOnAccused' }),
  exorcist: (sr) => ({ name: sr ? 'Witchfire Wick' : 'Lantern Soot', desc: `Her burns are ${sr ? 25 : 15}% stronger.`, kind: 'plague', value: sr ? 0.25 : 0.15 }),
};

/** Her own passive, or her class's R/SR passive. */
export function basePassive(c: Pick<CrusaderDef, 'classId' | 'rarity'>): PassiveDef | undefined {
  if (c.rarity !== 'R' && c.rarity !== 'SR') return undefined;
  return BY_CLASS[c.classId]?.(c.rarity === 'SR');
}
