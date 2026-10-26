# Item text and log lines from a game client in another language

**Status:** never attempted
**Needs:** Path of Exile 2 on Windows
**Origin:** [docs/dev/adr/ADR-0007-game-text-from-game-data.md](../../adr/ADR-0007-game-text-from-game-data.md)
**Verified:** 2026-10-21

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
- The parser also reads the em dash and the `, ` of a `{ ... }` modifier line, the `, ` between
  weapon damage ranges and the letter `S` of each socket as literals
  ([refinement 074](../../refinements/tasks/074-parser-separators-and-suffixes.md)). The open
  question is whether every client writes them the same. The game data says that the tag
  separator is `,` in Traditional Chinese and the roll increase starts with `- ` in Japanese, so
  copied text of such items in those two languages answers the most.
- In `Client.txt`, Kalandra matches the `level-up` line in the app's language and every other line
  type in English. The open question is whether a client in another language writes those other
  lines in English ([refinement 073](../../refinements/tasks/073-client-log-chat-lines-in-english.md)
  lists them). The game data has the Atlas skill point, AFK and NPC texts in each language, so
  only real lines show the slain, `has received` and Passive skill point texts. A `Temple Atlas`
  skill point line in English is also needed.

The item texts in other languages in `renderer/specs/Parser/items.ts` are normal and unique items
without modifier lines, sockets or elemental damage.

**Do.** Pick at least one language besides English from Settings, General, Language. Set the game
and that setting to it, and price check an item with an implicit, one with an enchant, one with a
rune, a weapon with elemental damage and runes in its sockets, and an uncut skill gem. Set the app
to English and check the same items again. Gain a level and read the new lines of `Client.txt`.
Then set the game to Thai or Simplified Chinese, whichever its language list has. Settings,
General, Language has neither, so leave the app on English, and copy an item and an uncut gem.

**Pass.** Each claim holds for the languages tried.

**Record.** The languages tried, and copied item text for each as parser cases. A literal that does
not match goes into a refinement.

## History

- 2026-10-18: Filed from the claims about language that the parser, main and ADR writers could not
  settle without a client in another language.
- 2026-10-18: Checked against the code. Thai and Simplified Chinese are not in the app's Language
  list, so the Do keeps the app on English for them.
- 2026-10-21: Added the modifier line separators, the weapon damage separator and the socket letter
  to the claims, a weapon to the Do, and links to the refinements that list the literals.
