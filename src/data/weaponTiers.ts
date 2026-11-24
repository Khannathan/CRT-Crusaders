import type { Rarity } from './types';

/** Signature weapon tiers, one per rarity: R Epic, SR Legendary, SSR Mythic, UR Divine Arsenal. */
export type WeaponTier = 'epic' | 'legendary' | 'mythic' | 'divine';

export const WEAPON_TIER: Record<WeaponTier, { label: string; color: number; max: number }> = {
  epic: { label: 'Epic', color: 0xb07cf0, max: 15 },
  legendary: { label: 'Legendary', color: 0xf0a040, max: 15 },
  mythic: { label: 'Mythic', color: 0xf05a5a, max: 20 },
  divine: { label: 'Divine Arsenal', color: 0xfff1a8, max: 25 },
};

export const TIER_OF_RARITY: Record<Rarity, WeaponTier> = { R: 'epic', SR: 'legendary', SSR: 'mythic', UR: 'divine' };
