/** Device preferences, kept apart from the game save so Reset save leaves them alone. */
export interface Settings {
  crt: boolean;
  /** 0.35 = subtle, 0.6 = standard, 1 = heavy */
  crtStrength: number;
  /** Battle animation speed. */
  battleSpeed: 1 | 2;
  /** The party fights on its own. */
  autoBattle: boolean;
  /** Music loudness, 0 to 1. */
  musicVolume: number;
  musicMuted: boolean;
  /** Camera shake on big hits. */
  screenShake: boolean;
}

const KEY = 'crt-crusaders.settings.v1';
const DEFAULTS: Settings = { crt: true, crtStrength: 0.6, battleSpeed: 1, autoBattle: false, musicVolume: 0.7, musicMuted: false, screenShake: true };

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
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
