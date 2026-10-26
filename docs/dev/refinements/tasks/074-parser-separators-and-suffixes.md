# The parser reads modifier suffixes, separators and the socket letter with literals

**Status:** open
**Area:** parser
**Origin:** [renderer/src/parser/advanced-mod-desc.ts](../../../../renderer/src/parser/advanced-mod-desc.ts)
**Verified:** 2026-10-26

The parser reads these parts of copied item text with string literals, and no `client_strings.js`
of the nine languages has a key for any of them:

| Literal | Code | What it reads |
| --- | --- | --- |
| `" (implicit)"`, `" (enchant)"`, `" (rune)"`, `" (added rune)"`, `" (scourge)"`, `" (desecrated)"`, `" (crafted)"`, `" (fractured)"` | the `*_LINE` constants in `advanced-mod-desc.ts`, read by `parseModType()` and `Parser.ts` | the suffix of a stat line that names its modifier type |
| `"\u2014"`, the em dash | `parseModInfoLine()` in `advanced-mod-desc.ts` | the parts of a `{ ... }` modifier line: its type, its tags and its roll increase |
| `", "` | `parseModInfoLine()` | the tags of a modifier line |
| `"{"` and `"}"` | `isModInfoLine()` in `advanced-mod-desc.ts` | a modifier line of the advanced item description |
| `", "` | `parseWeapon()` in `Parser.ts` | the damage ranges of the elemental, fire, cold and lightning damage lines |
| `"S"` | `parseAugmentSockets()` in `Parser.ts` | the sockets after `SOCKETS`, one letter each |

The game export of 2026-10-26 in `dataParser/data/vendor/tables/<Language>/ClientStrings.json` has
three strings of a `{ ... }` modifier line, and two of them differ by language:

| Game string | Text | Languages |
| --- | --- | --- |
| `AdvancedModDisplayTags` | `" \u2014 {0}"` | all nine |
| `AdvancedModDisplayTagSeparator` | `", "` | all but Traditional Chinese, which has `","` |
| `AlternateQualityModIncreaseText` | `" \u2014 {0}% Increased"` in English | German starts with `"\u2014 "`, Japanese with `"- "` |

So the em dash before the tags is the same in every language, and
[ADR-0007](../../adr/ADR-0007-game-text-from-game-data.md) lists it. `tagsText.split(", ")` keeps
the tags of a Traditional Chinese line as one tag, and the em dash split does not separate a
Japanese roll increase, if the copied text uses these strings. `MODIFIER_INCREASED` already reads
the Japanese text after its `"- "`. No `ClientStrings` row in any language holds a modifier type
suffix, the braces, the `", "` between damage ranges or the socket letter `S`. The non-English item
texts in `renderer/specs/Parser/items.ts` are normal and unique items without modifier lines,
sockets or elemental damage, so no test shows how another language writes these parts.

What remains:

1. [Host task 015](../../host/tasks/015-other-game-languages.md) records copied text of a weapon
   with runes in its sockets, elemental damage and modifiers, one with catalyst quality in Japanese
   and one with tags in Traditional Chinese. That text becomes parser cases under
   `renderer/specs/Parser/`, and a literal it shows to be the same in every language is listed in
   ADR-0007.
2. With the maintainer's go-ahead for a data update
   ([runbooks/game-data-update.md](../../runbooks/game-data-update.md)), the tag separator becomes
   a client string: an entry for `AdvancedModDisplayTagSeparator` in
   `dataParser/src/constants/client_string_data.py`, a `TranslationDict` key in
   `renderer/src/assets/data/interfaces.ts`, and one new line in each `client_strings.js`, such as
   `MODIFIER_TAG_SEPARATOR: ', ',` in eight languages and `MODIFIER_TAG_SEPARATOR: ',',` in
   `cmn-Hant`. `parseModInfoLine()` then splits the tags with it. The key and the line need the
   data update in the same commit, because the tool's tests require every key it writes to be a
   `TranslationDict` key.

## History

- 2026-10-21: Found by comparing the literals in `advanced-mod-desc.ts` and `Parser.ts` with the
  keys of every language's `client_strings.js`. This clone has no game export to add strings from.
- 2026-10-22: `filters/fill-augments.ts`, which also read the suffixes, was removed with the augment
  fill code that had no caller.
- 2026-10-26: Compared the modifier line strings of the nine languages in a fresh game export. The
  em dash before the tags is the same in all nine; the tag separator and the roll increase differ.
