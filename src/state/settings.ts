/** Device preferences, kept apart from the game save so Reset save leaves them alone. */
export interface Settings {
  crt: boolean;
  /** 0.35 = subtle, 0.6 = standard, 1 = heavy */
  crtStrength: number;
}

const KEY = 'crt-crusaders.settings.v1';
const DEFAULTS: Settings = { crt: true, crtStrength: 0.6 };

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
