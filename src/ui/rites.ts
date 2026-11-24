import { FORTS, attacksLeft, rivalName, warReady, warScore } from '../systems/chapterWar';
import { RAID_BOSSES, delvesLeft, raidOf } from '../systems/raid';
import { HOLD_WAVES, holdLeft, holdOf } from '../systems/holdLine';
import { HOUNDS } from '../data/hounds';
import type { BoostKind } from '../systems/boosts';
import { armoryOf, featuredArms, PITY } from '../systems/armory';
import { chapterLevel, chapterReady, siegeBeast } from '../systems/chapter';
import { ENEMIES } from '../data/enemies';
import { HUNT_ENTRIES, huntEntriesLeft, huntOn } from '../systems/hunts';
import { freeWhistle, houndsOf } from '../systems/hounds';
import type { SaveData } from '../state/save';
import { matinsReady } from '../systems/matins';
import { DISCOUNT_TEN, discountReady } from '../systems/gacha';
import { packsReady } from '../systems/packs';
import { missivesReady } from '../systems/missives';
import { passReady } from '../systems/pass';
import { BRACKET, LEAGUES, ORDEALS_PER_DAY, bracket, ordealsLeft, ordealsOf, ordealsReady } from '../systems/ordeals';
import { unlocked } from '../systems/rank';
import { anyClaimable } from '../systems/tasks';
import { noviceOpen, noviceReady } from '../systems/novitiate';
import { anyDeedReady, deedPoints } from '../systems/deeds';
import { anyBondRewards, anyUnheard } from '../systems/bonds';
import { entriesLeft } from '../systems/trials';
import { PROCESSION_ENTRIES, candleReady, honouredToday, processionLeft } from '../systems/offerings';

const BRAND_MAX = 9;
import { RELICS, relicBlock } from '../systems/reliquary';
import { codexBlock } from '../systems/codex';
import { claimable as setsClaimable, SETS } from '../systems/collection';
import { CRYPTS, PILGRIMAGE_CLEARS, cryptUnlocked, pilgrimageLeft } from '../systems/crusade';
import { towerOf } from '../systems/tower';
import { TRIAL_ENTRIES } from '../systems/trials';
import { rotation, totalBrands } from '../systems/inquisition';
import { untilText } from './modeScreen';
import { nextStage, roadRates, stageDef } from '../systems/campaign';
import { ORDER_LIST } from '../data/orders';
import { ERRAND_SLOTS, anyErrandDone, errandsOf, openErrands } from '../systems/errands';
import { ladder, renownOf } from '../systems/rivals';
import { feastName, feastOf, feastReady } from '../systems/feast';
import { limitedUnseen, limitedWindow, timeLeft } from '../systems/limited';
import { countOf } from '../systems/items';

/**
 * Every mode and side screen, and where it lives: the Sanctum's rail (daily
 * duties), the Crusade board (modes you fight in) or the Cloister (growth and
 * spending). Each entry opens its scene; a gold dot marks one with something to claim.
 */
export interface RiteEntry {
  label: string;
  scene: string;
  icon: string;
  /** Its own icon (ui-<art>.png), used in place of `icon` once the file exists. */
  art?: string;
  /** Rank of Faith needed (see UNLOCKS in rank.ts). */
  rank: number;
  /** Something is waiting to be claimed. */
  ready?: (save: SaveData) => boolean;
  /** Where it lives: the Sanctum's rail, the Crusade board or the Cloister. */
  home: RiteHome;
  /** Scene data when opening it. */
  data?: object;
  /** One line for its card on a board. */
  blurb?: string;
  /** A short live status for its card (entries left, best floor...). */
  status?: (save: SaveData) => string;
  /** The daily blessing that boosts it (systems/boosts.ts), shown on its card. */
  boost?: BoostKind;
  /** Shown only while this is true (e.g. the Novitiate's first fortnight). */
  shown?: (save: SaveData) => boolean;
  /** Kept off the Sanctum's rail (it has its own strip there). */
  noRail?: boolean;
  /** Card art (a bg-* key); falls back to the hall. */
  bg?: string;
}

/** Where it lives (see ui/nav.ts): a Crusade wing, the Road card, the event strip, the lobby rail, a sub-tab strip, the Altar or the Market. */
export type RiteHome = 'labors' | 'crypts' | 'contest' | 'abyss' | 'road' | 'event' | 'lobby' | 'duties' | 'sisters' | 'altar' | 'market';

export const RITES: RiteEntry[] = [
  // The Crusade board: every mode you fight in. The Feast (a two-week event) leads it.
  {
    label: 'Feast', scene: 'Feast', icon: 'flame', rank: 1, home: 'event', bg: 'bg-altar', ready: (s) => feastReady(s),
    blurb: 'Win Candles for the Saint\'s feast table.',
    status: (s) => `${feastName()}  ·  ${feastOf(s).candles} Candles  ·  ends in ${timeLeft(limitedWindow().ends)}`,
  },
  {
    label: 'Crypts', scene: 'Crusade', icon: 'blade', rank: 1, home: 'crypts', bg: 'bg-drowned-ossuary', boost: 'crusade',
    blurb: 'Descend and purge the crypt\'s heart.',
    status: (s) => `${CRYPTS.filter((c) => cryptUnlocked(s, c)).length} of ${CRYPTS.length} crypts open  ·  Pilgrimage ${pilgrimageLeft(s)}/${PILGRIMAGE_CLEARS} today`,
  },
  {
    label: "Pilgrim's Road", scene: 'Campaign', icon: 'flame', rank: 1, home: 'road', bg: 'bg-weeping-cloister', boost: 'vigil',
    blurb: 'Each stage won quickens the Vigil.',
    status: (s) => `Stage ${stageDef(nextStage(s)).label}  ·  Vigil ${Math.round(roadRates(s).tithes)} Tithes/h`,
  },
  {
    label: 'Sworn Errands', scene: 'Errands', icon: 'book', rank: 1, home: 'labors', bg: 'bg-altar', boost: 'errands', ready: (s) => anyErrandDone(s),
    blurb: 'Send Sisters on the Church\'s work.',
    status: (s) => `${errandsOf(s).active.length} of ${ERRAND_SLOTS} away  ·  ${openErrands(s).length} errands on offer`,
  },
  {
    label: 'Purge Hunts', scene: 'Hunt', icon: 'blade', rank: 4, home: 'labors', bg: 'bg-battle', ready: (s) => huntEntriesLeft(s) > 0,
    blurb: 'One beast a day. Bleed it for Godblood!',
    status: (s) => `Today: ${ENEMIES[huntOn().boss].name}  ·  ${huntEntriesLeft(s)}/${HUNT_ENTRIES} hunts left`,
  },
  {
    label: 'The Ordeals', scene: 'Ordeals', icon: 'blade', rank: 3, home: 'contest', bg: 'bg-hall', ready: (s) => ordealsReady(s),
    blurb: 'Twenty Orders a week. Top four rise!',
    status: (s) => `${LEAGUES[ordealsOf(s).league]} League  ·  place ${bracket(s).place}/${BRACKET}  ·  ${ordealsLeft(s)}/${ORDEALS_PER_DAY} today`,
  },
  {
    label: 'Relic Trials', scene: 'Trials', icon: 'shield', rank: 3, home: 'labors', bg: 'bg-iron-oubliette', boost: 'trials', ready: (s) => entriesLeft(s) > 0,
    blurb: 'The dead guard a new spoil each dawn.',
    status: (s) => `${entriesLeft(s)} of ${TRIAL_ENTRIES} entries left today`,
  },
  {
    label: 'Hold the Line', scene: 'Hold', icon: 'shield', rank: 4, home: 'crypts', bg: 'bg-candle-maze', ready: (s) => holdLeft(s) > 0 || !!holdOf(s).stand,
    blurb: 'Ten waves. Wounds carry. Hold!',
    status: (s) => `${holdOf(s).stand ? `Wave ${holdOf(s).stand!.held + 1} waits` : `${holdLeft(s)} stand left today`}  ·  best ${holdOf(s).best}/${HOLD_WAVES}`,
  },
  {
    label: 'Nightmare Raid', scene: 'Raid', icon: 'blade', rank: 6, home: 'abyss', bg: 'bg-abyssal-ossuary', ready: (s) => delvesLeft(s) > 0 || !!raidOf(s).delve,
    blurb: 'Three bosses. Three Squads. Its wounds carry!',
    status: (s) => `${raidOf(s).delve ? `Boss ${raidOf(s).delve!.boss + 1} waits` : `${delvesLeft(s)} delve left today`}  ·  week best ${raidOf(s).best}/${RAID_BOSSES}`,
  },
  {
    label: 'Chapter War', scene: 'War', icon: 'blade', rank: 6, home: 'contest', bg: 'bg-chapter', ready: (s) => warReady(s),
    blurb: 'Storm a rival Chapter\'s forts for stars!',
    status: (s) => (s.chapter ? `${warScore(s).us} to ${warScore(s).them} vs the ${rivalName(s)}  ·  ${attacksLeft(s)} storms left` : `Join the Chapter first  ·  ${FORTS.length} forts a week`),
  },
  {
    label: 'Reliquary Procession', scene: 'Procession', icon: 'flame', rank: 5, home: 'labors', bg: 'bg-candle-maze', ready: (s) => processionLeft(s) > 0,
    blurb: 'Guard the relics. Win offerings.',
    status: (s) => `${processionLeft(s)} of ${PROCESSION_ENTRIES} entries left  ·  honours the ${honouredToday().name}`,
  },
  {
    label: 'Bell Tower', scene: 'Tower', icon: 'sanctum', rank: 6, home: 'crypts', bg: 'bg-tower', boost: 'tower',
    blurb: 'Climb without end. Ring every bell!',
    status: (s) => `Best floor ${towerOf(s).best}${towerOf(s).best ? `  ·  Vigil +${towerOf(s).best}%` : ''}  ·  Order floors ${Object.values(towerOf(s).orders ?? {}).reduce((a, b) => a + b, 0)}`,
  },
  {
    label: 'Inquisition', scene: 'Inquisition', icon: 'blade', rank: 8, home: 'abyss', bg: 'bg-confessional',
    blurb: 'Judge the heretics. Each Sister fights once.',
    status: (s) => `${totalBrands(s)} of ${BRAND_MAX} Brands  ·  ends in ${untilText(rotation().ends - Date.now())}`,
  },
  // The Sealed Altar: one card per thing you can pull for, each with its own currency.
  {
    label: 'Sisters', scene: 'Recruit', icon: 'seal', art: 'altar', rank: 1, home: 'altar', bg: 'bg-altar',
    ready: (s) => limitedUnseen(s) || !s.freeTenUsed || (discountReady(s) && s.seals >= DISCOUNT_TEN),
    blurb: 'Call new Sisters to the faith!',
    status: (s) => `${s.seals} Seals  ·  ${limitedWindow().saint.name.split(' ')[0]} leaves in ${timeLeft(limitedWindow().ends)}`,
  },
  {
    label: 'Gear', scene: 'Armory', icon: 'shield', rank: 1, home: 'altar', bg: 'bg-reliquary', data: { back: 'Altar' }, boost: 'fragments',
    ready: (s) => countOf(s, 'armory2') > 0 || !armoryOf(s).gifted,
    blurb: "Arm your Sisters with the Saints' own steel.",
    status: (s) => `${countOf(s, 'armory2')} Writs  ·  ${featuredArms().arms.name} featured  ·  Arms within ${PITY - armoryOf(s).pity}`,
  },
  {
    label: 'Hounds', scene: 'Kennel', icon: 'shield', rank: 1, home: 'altar', bg: 'bg-kennel',
    ready: (s) => freeWhistle(s) || countOf(s, 'kennel2') > 0 || !houndsOf(s).gifted,
    blurb: 'The Church\'s war-dogs, hungry for heretics.',
    status: (s) => `${countOf(s, 'kennel2')} Whistles  ·  ${Object.keys(houndsOf(s).owned).length}/${HOUNDS.length} hounds  ·  ${freeWhistle(s) ? 'free call ready' : 'free call spent'}`,
  },
  // The Cloister: growth and spending.
  {
    label: 'Rival Orders', scene: 'Rivals', icon: 'sigil', rank: 1, home: 'contest', bg: 'bg-hall',
    blurb: 'Outshine the lesser Orders.',
    status: (s) => `Place ${ladder(s).place} of ${ladder(s).rows.length}  ·  Renown ${renownOf(s)}`,
  },
  {
    label: 'Deeds', scene: 'Deeds', icon: 'sigil', rank: 1, home: 'duties', bg: 'bg-hall', ready: (s) => anyDeedReady(s),
    blurb: 'Great works, remembered. Earn Gilt and titles!',
    status: (s) => `${deedPoints(s)} Deed points  ·  ${(s.titles ?? []).length} titles`,
  },
  { label: 'Inventory', scene: 'Inventory', icon: 'shield', art: 'inventory', rank: 1, home: 'sisters', bg: 'bg-hall', blurb: 'What your Sisters carried home.' },
  {
    label: 'The Chapter', scene: 'Chapter', icon: 'roster', rank: 1, home: 'lobby', bg: 'bg-hall', ready: (s) => chapterReady(s),
    blurb: 'Tithe daily. Besiege a beast each week.',
    status: (s) => (s.chapter ? `Level ${chapterLevel(s.chapter.xp)}  ·  Siege ${Math.min(100, Math.round((s.chapter.siege.dealt / siegeBeast(s).pool) * 100))}%  ·  ${s.chapter.marks} Marks` : 'Not yet joined'),
  },
  { label: 'Shop', scene: 'Shop', icon: 'seal', art: 'shop', rank: 1, home: 'market', bg: 'bg-shop', blurb: 'The Church sells what it can spare.', ready: (s) => packsReady(s) },
  {
    label: 'Reliquary', scene: 'Reliquary', icon: 'flame', art: 'reliquary', rank: 1, home: 'sisters', bg: 'bg-reliquary', data: { tab: 'relics' },
    ready: (s) => RELICS.some((r) => !relicBlock(s, r.id)),
    blurb: 'Light the relics. Lift every Sister.',
  },
  {
    label: 'Order Codex', scene: 'Reliquary', icon: 'book', rank: 1, home: 'sisters', bg: 'bg-altar', data: { tab: 'codex' },
    ready: (s) => ORDER_LIST.some((o) => !codexBlock(s, o.id)),
    blurb: 'Raise an Order and all its Sisters.',
  },
  // The Sanctum's rail: daily duties.
  {
    label: 'Order Book', scene: 'OrderBook', icon: 'book', rank: 1, home: 'sisters', bg: 'bg-hall',
    ready: (s) => setsClaimable(s).length > 0,
    blurb: 'Gather each Order. Earn Seals and titles.',
    status: (s) => `${SETS.filter((x) => (s.sets ?? []).includes(x.id)).length} of ${SETS.length} sets complete`,
  },
  { label: 'Novitiate', scene: 'Novitiate', icon: 'sigil', rank: 1, home: 'duties', noRail: true, shown: (s) => noviceOpen(s), ready: (s) => noviceReady(s) },
  { label: 'Missives', scene: 'Missives', icon: 'book', rank: 1, home: 'lobby', ready: (s) => missivesReady(s) },
  { label: 'Calendar', scene: 'Calendar', icon: 'book', rank: 1, home: 'lobby' },
  { label: 'Matins', scene: 'Matins', icon: 'flame', rank: 1, home: 'lobby', ready: (s) => matinsReady(s) },
  { label: 'Pass', scene: 'Pass', icon: 'sigil', rank: 1, home: 'lobby', ready: (s) => passReady(s) },
  { label: 'Penance', scene: 'Penance', icon: 'book', rank: 2, home: 'duties', ready: (s) => anyClaimable(s) },
  { label: 'Confession', scene: 'Confession', icon: 'book', rank: 5, home: 'sisters', ready: (s) => anyUnheard(s) || anyBondRewards(s) || (Object.keys(s.owned).length > 0 && candleReady(s)) },
];

/** The Rite (or board) a scene belongs to, for its tab and its Back button. */
export const homeOf = (sceneKey: string): RiteHome | undefined => RITES.find((r) => r.scene === sceneKey && r.scene !== 'Sanctum')?.home;

/** True when a Rite in `home` has something to claim (for a dot on its tab). */
export const anyReady = (save: SaveData, home: RiteHome) => RITES.some((r) => r.home === home && (r.shown?.(save) ?? true) && unlocked(save, r.rank) && r.ready?.(save));
