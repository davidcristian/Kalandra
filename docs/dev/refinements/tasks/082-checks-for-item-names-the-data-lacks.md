# Code still checks item names and fields that the Path of Exile 2 data does not have

**Status:** open
**Area:** parser
**Origin:** [renderer/src/parser/Parser.ts](../../../../renderer/src/parser/Parser.ts)
**Verified:** 2026-10-22

On 2026-10-22 no `items.ndjson` of any language has an item named `Charged Compass`,
`Chronicle of Atzoatl`, `Mirrored Tablet`, `Forbidden Tome` or `Filled Coffin`, and neither does
the trade site's item list in `renderer/specs/data/items.json`. No gem in the data has
`"transfigured": true` or `"awakened": true`. The price check filters stopped checking these names
that day. This code still checks them, or keeps a value that only the removed filters read:

- `findInDatabase` in `Parser.ts` looks up `Charged Compass` for an item of the `Voidstone`
  category.
- `parseAreaLevel`, `parseAtzoatlRooms`, `parseMirroredTablet`, `parseFilledCoffin` and
  `parseItemLevel` in `Parser.ts` compare `item.info.refName` with these names.
- `getDetailsId` in `renderer/src/web/price-check/trends/getDetailsId.ts` has a `Filled Coffin`
  branch, and `forSkillGem` there keeps commented-out code that names `SPECIAL_SUPPORT_GEM`, a list
  the filters no longer have.
- `calcBasePercentile` in `Parser.ts` writes `basePercentile`. Nothing reads it since the filter for
  Emperor's Vigilance, a unique the data does not have, was removed.
- `parseLogbookArea` in `Parser.ts` writes `logbookAreaMods`, and nothing reads it. It also takes
  the area sections of an Expedition Logbook, which the data has, so `parseModifiers` does not read
  them as modifiers.
- `createGemFilters` in `renderer/src/web/price-check/filters/create-item-filters.ts` branches on
  `gem.transfigured`, `gem.awakened` and `gem.normalVariant`. `FiltersBlock.vue` shows the
  `discriminator` filter it sets for a transfigured gem, and `pathofexile-trade.ts` sends it.

Done looks like: each check removed, or kept with its reason in a comment. A change to
`parseLogbookArea` keeps the logbook's area sections out of the modifiers and comes with a parser
case of copied Expedition Logbook text, which `renderer/specs/Parser/items.ts` does not have yet.
[022](022-category-checks-for-missing-item-kinds.md) covers the category checks, including the
cluster jewel rules in `create-stat-filters.ts`.

## History

- 2026-10-22: Found while the filter branches for these names were removed. The parser and trends
  code was left for its own change, because removing `parseLogbookArea` changes how a real item is
  parsed.
