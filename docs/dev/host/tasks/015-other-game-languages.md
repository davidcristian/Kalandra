# Item text and log lines from a game client in another language

**Status:** never attempted
**Needs:** Path of Exile 2 on Windows
**Origin:** [docs/dev/adr/ADR-0007-game-text-from-game-data.md](../../adr/ADR-0007-game-text-from-game-data.md)
**Verified:** 2026-10-18

**Claims.** [ADR-0007](../../adr/ADR-0007-game-text-from-game-data.md),
[modules/main.md](../../modules/main.md), [modules/renderer-parser.md](../../modules/renderer-parser.md)
and [docs/client-log-parser.md](../../../client-log-parser.md) say:

- The game copies item text in the language the client runs in.
- `LANGUAGE_DETECTOR` in `main/src/shortcuts/HostClipboard.ts` holds the first line of copied item
  text and the rarity line of an uncut gem in each game language. Main accepts clipboard text only
  when it starts with one of them. The Thai and Simplified Chinese entries use the English
  `Rarity: ` for the uncut gem.
- `LANGUAGE_DETECTOR` in `renderer/src/parser/Parser.ts` holds the item class and rarity lines per
  language. An item copied in a language other than the app's shows
  `POE2 language doesn't match Kalandra` with the game's language
  ([refinement 026](../../refinements/tasks/026-wrong-language-message.md) is a known case).
- The suffixes `" (implicit)"`, `" (enchant)"`, `" (rune)"` and `" (added rune)"` in
  `renderer/src/parser/advanced-mod-desc.ts` are English literals. The open question is whether the
  game writes them in English in every client language.
- In `Client.txt`, Kalandra matches the `level-up` line in the app's language and every other line
  type in English. The open question is whether a client in another language writes those other
  lines in English.

No parser case in `renderer/specs/Parser/` has item text in a language other than English.

**Do.** Pick at least one language besides English from Settings, General, Language. Set the game
and that setting to it, and price check an item with an implicit, one with an enchant, one with a
rune and an uncut skill gem. Set the app to English and check the same items again. Gain a level and
read the new lines of `Client.txt`. Then set the game to Thai or Simplified Chinese, whichever its
language list has. Settings, General, Language has neither, so leave the app on English, and copy
an item and an uncut gem.

**Pass.** Each claim holds for the languages tried.

**Record.** The languages tried, and copied item text for each as parser cases. A literal that does
not match goes into a refinement.

## History

- 2026-10-18: Filed from the claims about language that the parser, main and ADR writers could not
  settle without a client in another language.
- 2026-10-18: Checked against the code. Thai and Simplified Chinese are not in the app's Language
  list, so the Do keeps the app on English for them.
