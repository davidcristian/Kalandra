# The anointment filter decodes oil indexes with its own copy of a game table's order

**Status:** done 2026-10-26
**Area:** data
**Origin:** [renderer/src/web/price-check/filters/pseudo/anointments.ts](../../../../renderer/src/web/price-check/filters/pseudo/anointments.ts)
**Verified:** 2026-10-26

The committed `stats.ndjson` of every language writes the oils of an anointment as comma-joined row
indexes of the game's `BlightCraftingItems` table, such as `"oils": "9,0,5"`. `decodeOils()` in
`renderer/src/web/price-check/filters/pseudo/anointments.ts` turns each index into a name through
`EMOTIONS`, its own ordered list of the thirteen English oil names. The order of the table is in no
file under `renderer/public/data/`, so a game patch that adds or reorders a row maps the indexes to
the wrong oils.

What is done: `get_blight()` in `dataParser/src/services/value_converter_service.py` writes each
oil as the English name of its `BaseItemType`, such as
`"oils": ["Concentrated Liquid Isolation", "Diluted Liquid Ire", "Liquid Disgust"]`. `decodeOils()`
reads such a list as it is and still reads the indexes of the committed data. It names no oils when
an index is past the end of `EMOTIONS` or when `ITEM_BY_REF` has no item for a name, so
`FilterModifierAnointment.vue` gets no name it cannot show. The game export of 2026-10-26 has the
table in the order of `EMOTIONS`, so the committed indexes name the right oils today.

What remains needs the maintainer's go-ahead for a data update
([runbooks/game-data-update.md](../../runbooks/game-data-update.md)):

1. Regenerate `renderer/public/data/<lang>/stats.ndjson`. The update changes one line per language,
   the `Allocates #` stat: line 865 in `en`, `es` and `pt`, 864 in `de` and `fr`, 863 in `ja`, 861
   in `ko`, 866 in `ru` and 839 in `cmn-Hant`. Each of its 875 `oils` strings becomes the list of
   the same three oils by name. A local build from the export of 2026-10-26 gave each oil list the
   same oils as the committed indexes in all nine languages, and nothing else on the line changed
   except in `fr`, where 13 notable names, such as `Attribue Paragon`, get their French name and
   the matchers come in another order. A full regeneration also changes other lines
   ([052](052-dataparser-older-than-committed-data.md)).
2. In the same commit, remove `EMOTIONS` and the string branch of `decodeOils()`, set `oils` in
   `StatMatcher` (`renderer/src/assets/data/interfaces.ts`) to `string[]`, and remove the test of
   an index past the end of the table from `specs/web/price-check/filters/pseudo/anointments.test.ts`.

## History

- 2026-10-22: Found while checking whether `renderer/public/data/` has the oil names in table
  order. It has the names but not the order, so `EMOTIONS` stays until the data tool writes it.
- 2026-10-26: dataParser writes the oil names, and `decodeOils()` reads them and names no unknown
  oil. The data update waits for the maintainer.
- 2026-10-26: Done by fix(data): name the anointment oils in the game data. Each language's
  `Allocates #` line is the tool's output: its oils are the names of the oils that the indexes
  named, and the French line has the 13 French notable names of the game's `PassiveSkills` table.
  `EMOTIONS`, the string branch and its test are gone, and `oils` is `string[]` in both types.
