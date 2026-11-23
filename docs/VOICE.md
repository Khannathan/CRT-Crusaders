# CRT Crusaders voice bible: Zealous Sermon

Every word the player reads is preached from the pulpit of a church at war.
The speaker is a fervent preacher addressing the faithful (the player) about
the Sisters. The preacher's faith is total and a little frightening. The
preacher is never cute, never ironic and never long-winded.

Aaron chose this voice on 2026-11-23. Use it for all new text. Tutorial and
onboarding text is written last, in this same voice.

## The five rules

1. **Fervour lives in verbs and nouns, not in length.** "Smite", "purge",
   "absolve", "march", "kneel", "consecrate". A sermon line is short and hits
   hard. If a line needs a second sentence to be fervent, cut the line.
2. **Numbers are scripture.** Mechanics stay exact, plain and in the same
   order: target, effect, number, duration. The voice never blurs a number,
   a rank, a turn count or a condition. When in doubt, the number wins.
3. **Speak to the faithful.** Second person ("you", "your Sisters") for the
   player, imperative for actions. The Sisters are "she/her"; foes are "the
   heretic", "the damned", "the dead", "the foe".
4. **One exclamation per line, at most.** Use "!" for triumph, rewards and
   calls to battle. Never on errors, costs, timers or numbers-only labels.
   A screen should have no more than two or three "!" on it at once.
5. **No filler.** No restating what the screen already shows, no
   "tap here to", no "please", no "simply", no "you can". If removing a line
   loses no meaning, remove it.

## By text type

| Type | Length | Voice strength | Pattern |
| --- | --- | --- | --- |
| Button | 1 to 3 words | Strong verb | `Smite`, `March!`, `Claim`, `Take the Vow` |
| Screen subtitle | 0 or 1 short line | Medium | Only when it states a rule the screen does not show |
| Card blurb (mode boards) | One line, about 45 characters | Medium | `Purge the crypts, act by act.` |
| Skill / passive text | As short as the mechanics allow | Verb only | `Smite rank 1-2. Bleed 2 turns. +40% below half HP.` |
| Tooltip / glossary | 1 to 3 short sentences | Light | Plain rule first, one fervent clause allowed |
| Toast / reward | One line | Strong | `Victory! +60 Candles.` |
| Failure toast | One line | Grave, no "!" | `Driven back. Nothing was spent.` |
| Empty state | One line, a call to act | Strong | `No gear for this slot. Crusade, and the dead will arm you!` |
| Lock / requirement | 1 to 4 words | None | `Locked`, `Rank V`, `Clear the Belfry` |
| Lore / flavor (crypts, foes, events, errands) | 1 to 2 sentences, italics where shown | Strongest | `The drowned still sing. Silence them.` |
| Confirm dialogs | Question + consequence | Grave | `Burn the records? Every Sister and Seal is lost.` |

## Skill text format

- Start with the verb: Smite, Strike, Shield, Heal, Mend, Bless, Curse,
  Brand, Hex, Sunder, Haste, Ward, Absolve.
- Keyword names stay capitalised exactly as the glossary has them
  (Bleed, Burn, Poison, Stun, Accused, Overwatch, Zeal, Wrath, Guilt...),
  because tapping them opens the glossary.
- Ranks as `rank 1-2`, turns as `for 2 turns`, numbers as `+40%`, `30% of max HP`.
- Litanies begin `LITANY:`.
- Do not end with `Cooldown N.`; the cooldown shows as a tag.

## Word list

Prefer | Over
--- | ---
Smite, strike | hit, attack (as a verb in flavor)
the damned, the heretic, the foe | enemy (in flavor; "enemy/foe" is fine in mechanics)
march, descend | go, enter
fall / the fallen | die, dead (for Sisters)
absolve, mend | revive, heal (in flavor)
spoils, tithes, offerings | loot, rewards
the faithful | the player, users
Praise be, Glory to the Order | (use rarely: big wins only)

Never: modern slang, emoji, "OK", "awesome", "loot", "grind", "nerf", "buff"
(as a word on screen), real-world denominations, saints or prayers by real name.

## Formatting

- Sentence case for body text. Title Case for names of places, modes and items.
- HUD labels in the pixel font are ALL CAPS and stay data-only (`VICTORIES 3/3`).
- Use `·` to separate short facts on one line, never `|` or `/` for that.
- Use `×` for multiples on buttons (`Recruit ×10`).
- No trailing spaces, no double spaces, no line that ends in a lone word on
  its own line if a one-word trim avoids it.
- Check every changed line on a 540-wide portrait screen: no overlap, no
  text off the edge, no orphaned single word.

## Examples

Before | After
--- | ---
Leave with everything found | Leave with your spoils
Heavy strike on rank 1-2 that leaves it Bleeding for 2 turns. +40% while she is under half HP. | Smite rank 1-2 and leave it Bleeding for 2 turns. +40% while she is below half HP.
No pieces for this slot yet. Crusade, and the dead will provide. | Nothing for this slot. Crusade, and the dead will arm you!
Last Feast's Candles melted into 120 Alms. | The Feast's Candles melt into 120 Alms. Praise be!
The trial repels you. No entry was spent. | The trial repels you. Nothing was spent.
