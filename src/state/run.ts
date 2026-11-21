import type { RunState } from '../systems/crusade';

/** The crusade in progress, if any. Lives in memory only; a reload abandons it. */
export const current: { run?: RunState; /** Crypt picked on the Crusade tab. */ cryptId?: string; /** Heresy tier picked per crypt. */ heresy?: Record<string, number> } = {};
