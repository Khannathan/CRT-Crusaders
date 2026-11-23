/** Device preferences, kept apart from the game save so Reset save leaves them alone. */
export interface Settings {
  crt: boolean;
  /** 0.35 = subtle, 0.6 = standard, 1 = heavy */
  crtStrength: number;
  /** Battle animation speed. */
  battleSpeed: BattleSpeed;
  /** The party fights on its own. */
  autoBattle: boolean;
  /** Music loudness, 0 to 1. */
  musicVolume: number;
  musicMuted: boolean;
  /** Sound effects (synthesized chip sounds; see audio/sfx.ts). */
  sfx: boolean;
  /** Camera shake on big hits. */
  screenShake: boolean;
  /** Tech demo: battles play out in real time on an open field instead of in turns. */
  /** A Sister's page: her splash with her pixel figure in front (both), the splash alone, or the figure alone. */
  sisterView: 'both' | 'splash' | 'sprite';
}

export type BattleSpeed = 1 | 2 | 3;
/** The speeds the battle Speed button steps through. */
export const BATTLE_SPEEDS: BattleSpeed[] = [1, 2, 3];
/** The next speed after this one (3x wraps back to 1x). */
export const nextSpeed = (s: number): BattleSpeed => BATTLE_SPEEDS[(BATTLE_SPEEDS.indexOf(s as BattleSpeed) + 1) % BATTLE_SPEEDS.length];

const KEY = 'crt-crusaders.settings.v1';
const DEFAULTS: Settings = { crt: true, crtStrength: 0.6, battleSpeed: 1, autoBattle: false, musicVolume: 0.7, musicMuted: false, sfx: true, screenShake: true, sisterView: 'both' };

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
      if (!BATTLE_SPEEDS.includes(s.battleSpeed)) s.battleSpeed = 1;
      return s;
    }
  } catch {
    // ignore
  }
  return { ...DEFAULTS };
}

export const settings: Settings = load();

export function saveSettings() {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // storage unavailable
  }
}
