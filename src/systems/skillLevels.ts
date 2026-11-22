import type { SaveData } from '../state/save';
import { countOf, hasAll, itemDef, spend, type Bag, type ItemId } from './items';

/**
 * Skill levels: each of a Sister's four skills (three skills and her Rite)
 * rises from level 1 to 5 with Psalter Pages and Tithes. Each level adds
 * SKILL_STEP to the skill's effect (damage, healing, shields, poison), on top
 * of any Vow upgrade. Higher levels need a higher Sister level, so they follow
 * Ascension.
 */
export const MAX_SKILL_LEVEL = 5;
export const SKILL_STEP = 0.06;

export interface SkillStep {
  /** Sister level needed. */
  level: number;
  items: Bag;
  tithes: number;
}

/** Index 0 is the step to level 2. */
export const SKILL_STEPS: SkillStep[] = [
  { level: 5, items: { page1: 8 }, tithes: 400 },
  { level: 15, items: { page1: 15, page2: 3 }, tithes: 800 },
  { level: 25, items: { page2: 8 }, tithes: 1500 },
  { level: 35, items: { page2: 10, page3: 3 }, tithes: 3000 },
];

export const skillLevels = (save: SaveData, id: string): number[] => {
  const o = save.owned[id];
  return [0, 1, 2, 3].map((i) => o?.skills?.[i] ?? 1);
};

/** Effect multiplier for a skill level. */
export const skillLevelMult = (lv: number) => 1 + SKILL_STEP * (lv - 1);

/** Levels above 1 across her four skills (0-16), for Power. */
export const skillLevelsGained = (save: SaveData, id: string) => skillLevels(save, id).reduce((n, lv) => n + lv - 1, 0);

export const nextSkillStep = (save: SaveData, id: string, skill: number): SkillStep | undefined => SKILL_STEPS[skillLevels(save, id)[skill] - 1];

export function skillBlock(save: SaveData, id: string, skill: number): string | undefined {
  const o = save.owned[id];
  if (!o) return 'Not sworn';
  const step = nextSkillStep(save, id, skill);
  if (!step) return 'Mastered';
  if (o.level < step.level) return `Needs level ${step.level}`;
  if (!hasAll(save, step.items)) return 'Not enough Pages';
  if (save.tithes < step.tithes) return 'Not enough Tithes';
  return undefined;
}

export function raiseSkill(save: SaveData, id: string, skill: number): boolean {
  const step = nextSkillStep(save, id, skill);
  if (!step || skillBlock(save, id, skill)) return false;
  spend(save, step.items);
  save.tithes -= step.tithes;
  const o = save.owned[id];
  const lv = skillLevels(save, id);
  lv[skill] += 1;
  o.skills = lv;
  return true;
}

/** "8 Torn Page (12) · 400 Tithes", with what the player holds in brackets. */
export const stepText = (save: SaveData, step: SkillStep) =>
  [...(Object.entries(step.items) as [ItemId, number][]).map(([i, n]) => `${n} ${itemDef(i).name} (${countOf(save, i)})`), `${step.tithes.toLocaleString('en-US')} Tithes`].join(' · ');
