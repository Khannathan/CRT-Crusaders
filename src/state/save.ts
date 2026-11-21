/** Everything the player owns, stored on the device. */
export interface OwnedCrusader {
  level: number;
  /** Duplicate copies absorbed, 0-5. */
  vow: number;
  /** Crusades left to sit out after falling (0 = ready). Tithes can revive early. */
  recovering?: number;
}

export interface SaveData {
  version: 1;
  seals: number;
  tithes: number;
  /** Pulls since the last SSR or UR. */
  pity: number;
  totalPulls: number;
  freeTenUsed: boolean;
  owned: Record<string, OwnedCrusader>;
  /** Crypt ids cleared at least once (first-clear bonus). */
  cleared: string[];
  /** Highest Heresy tier cleared per crypt id (0 = the base crypt). */
  heresy?: Record<string, number>;
  /** Last party, in rank order, to pre-fill the muster screen. */
  lastParty: string[];
}

const KEY = 'crt-crusaders.save.v1';

/**
 * Prototype starting purse. Crusades (step 3) will earn Seals; until then this
 * lets you try the altar beyond the free first 10-pull.
 */
export function newSave(): SaveData {
  return { version: 1, seals: 30, tithes: 500, pity: 0, totalPulls: 0, freeTenUsed: false, owned: {}, cleared: [], lastParty: [] };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw) as SaveData;
      if (data && data.version === 1) return { ...newSave(), ...data };
    }
  } catch {
    // storage blocked or corrupt: start fresh
  }
  return newSave();
}

export function writeSave(data: SaveData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // storage unavailable (private mode); progress lasts for this session only
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
