# The wrong language message can name English for an item in another language

**Status:** open
**Area:** parser
**Origin:** [renderer/src/parser/Parser.ts](../../../../renderer/src/parser/Parser.ts)
**Verified:** 2026-10-18

When the first line of copied item text is not the item class line of the app's language,
`parseNamePlate()` in `Parser.ts` looks up the game language with
`LANGUAGE_DETECTOR.find(({ rarityLine }) => section[1].startsWith(rarityLine))`. The `rarityLine`
of `en`, `th` and `cmn-Hans` in that list is `Rarity: `, and `en` comes first. Every entry also has
an `itemClassLine`, and no code reads it.

Main passes Thai and Simplified Chinese item text on, because `isPoeItem()` in
`main/src/shortcuts/HostClipboard.ts` accepts text that starts with their item class lines. The renderer lookup then
returns `en` for both, whatever the app's language. With the app set to English, the window shows
`POE2 language doesn't match Kalandra` with the help text
`POE2 is set to English but Kalandra is currently set to English`.

Done looks like: the lookup uses the item class line, which differs between those languages, or
uses `Rarity: ` only as a last resort, with a parser test for each case. A parser case uses real
copied item text ([AGENTS.md](../../../../AGENTS.md#what-every-change-must-pass)), so the Thai and
Simplified Chinese samples come from the game ([host task 015](../../host/tasks/015-other-game-languages.md)).

## History

- 2026-10-18: Found while the parser module doc was written, by reading `LANGUAGE_DETECTOR` and
  `parseNamePlate()`.
- 2026-10-18: Checked against the tree with a script that runs the same lookup on the list in
  `Parser.ts`: a `th` and a `cmn-Hans` entry both return `en`.
