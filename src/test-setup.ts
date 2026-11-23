import { setBoostsEnabled } from './systems/boosts';

// Payouts in tests must not depend on which weekday they run.
setBoostsEnabled(false);
