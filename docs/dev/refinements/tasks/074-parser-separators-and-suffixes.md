# The parser reads modifier suffixes, separators and the socket letter with literals

**Status:** open
**Area:** parser
**Origin:** [renderer/src/parser/advanced-mod-desc.ts](../../../../renderer/src/parser/advanced-mod-desc.ts)
**Verified:** 2026-10-21

The parser reads these parts of copied item text with string literals, and no `client_strings.js`
of the nine languages has a key for any of them:

| Literal | Code | What it reads |
| --- | --- | --- |
| `" (implicit)"`, `" (enchant)"`, `" (rune)"`, `" (added rune)"`, `" (scourge)"`, `" (desecrated)"`, `" (crafted)"`, `" (fractured)"` | the `*_LINE` constants in `advanced-mod-desc.ts`, read by `parseModType()`, `Parser.ts` and `filters/fill-augments.ts` | the suffix of a stat line that names its modifier type |
| `"\u2014"`, the em dash | `parseModInfoLine()` in `advanced-mod-desc.ts` | the parts of a `{ ... }` modifier line: its type, its tags and its roll increase |
| `", "` | `parseModInfoLine()` | the tags of a modifier line |
| `"{"` and `"}"` | `isModInfoLine()` in `advanced-mod-desc.ts` | a modifier line of the advanced item description |
| `", "` | `parseWeapon()` in `Parser.ts` | the damage ranges of the elemental, fire, cold and lightning damage lines |
| `"S"` | `parseAugmentSockets()` in `Parser.ts` | the sockets after `SOCKETS`, one letter each |

The data gives one hint. `UNSCALABLE_VALUE`, which `dataParser` takes from the game string
`DescriptionLabelFixedValueStat`, starts with a space, the em dash and a space in all nine
languages, so the game uses the em dash in an advanced description string in every language. No
key holds the separator alone, and reading it from the first character of `UNSCALABLE_VALUE` would
make the modifier line depend on the text of another string. The other literals have no such hint,
and which game strings hold them is not known here. The non-English item texts in
`renderer/specs/Parser/items.ts` are normal and unique items without modifier lines, sockets or
elemental damage, so no test shows how another language writes these parts.

Done looks like: [host task 015](../../host/tasks/015-other-game-languages.md) records copied text
of a weapon with runes in its sockets, elemental damage and modifiers in at least one language
besides English, and that text becomes a parser case under `renderer/specs/Parser/`. A literal that
the game writes the same in every language is listed as such in
[ADR-0007](../../adr/ADR-0007-game-text-from-game-data.md). A literal that differs gets an entry in
`dataParser/src/constants/client_string_data.py`, a `TranslationDict` key in
`renderer/src/assets/data/interfaces.ts` and a data update with the maintainer's go-ahead
([runbooks/game-data-update.md](../../runbooks/game-data-update.md)), and the parser reads it
through `CLIENT_STRINGS`.

## History

- 2026-10-21: Found by comparing the literals in `advanced-mod-desc.ts` and `Parser.ts` with the
  keys of every language's `client_strings.js`. This clone has no game export to add strings from.
