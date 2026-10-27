# The poedb button opens a flask's or a tablet's own page instead of its calculator

**Status:** done 2026-10-27
**Area:** renderer
**Origin:** [renderer/src/web/item-check/hotkeyable-actions.ts](../../../../renderer/src/web/item-check/hotkeyable-actions.ts)
**Verified:** 2026-10-27

`getPoe2dbPath()` in `hotkeyable-actions.ts` looks up an item's English base name in
`POE2DB_CONVERSIONS` before its category. The map lists `Life Flask`, `Mana Flask` and six tablets
named `... Precursor Tablet`. No base in `renderer/public/data/en/items.ndjson` has any of these
names: the life flasks are `Lesser Life Flask` to `Ultimate Life Flask`, and the tablets are
`Breach Tablet`, `Delirium Tablet` and the others. The categories `Flask` and `TowerAugment` are not
in the map either, so a flask or a tablet copied now opens its own page, such as
`Ultimate_Life_Flask` or `Delirium_Tablet`, and these eight entries are never read.
[docs/item-info.md](../../../item-info.md) says that an item opens the modifier calculator of its
kind.

The case "is named by the kind of a tablet" in `renderer/specs/web/item-check.test.ts` passes only
because the `TwoLineOneImplicitItem` fixture was copied when the base was `Delirium Precursor Tablet`.

Done looks like: check on poe2db.tw which calculator page a flask and a tablet have now. Then one
`fix(renderer)` commit matches them by their current bases or their category, with copied flask and
tablet text as test cases, or removes the entries and says on the docs page that these kinds open
their own page.

## History

- 2026-10-25: Found while tests were added for the poe2db page, by comparing the map's names with
  the base names in the English item data.
- 2026-10-27: Fixed in "fix(renderer): open the poe2db calculator of flasks and tablets". poe2db
  has the calculators `Life_Flasks` and `Mana_Flasks`, and each tablet base has one on its own
  page. No copied flask text is in the repo, so the flask case reads the bases of the item data,
  and the tablet case reads `TempleTablet`. Host task
  [020](../../host/tasks/020-copy-items-for-hand-built-parser-cases.md) asks for both copies.
