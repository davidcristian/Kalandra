# The anointment filter decodes oil indexes with its own copy of a game table's order

**Status:** open
**Area:** data
**Origin:** [renderer/src/web/price-check/filters/pseudo/anointments.ts](../../../../renderer/src/web/price-check/filters/pseudo/anointments.ts)
**Verified:** 2026-10-22

dataParser writes the oils of an anointment as comma-joined row indexes of the game's
`BlightCraftingItems` table: `get_blight()` in `dataParser/src/services/value_converter_service.py`
joins the `BlightCraftingItems` column of `BlightCraftingRecipes`, and `stats.ndjson` keeps the
result as `oils`, such as `"oils": "9,0,5"`. `decodeOils()` in
`renderer/src/web/price-check/filters/pseudo/anointments.ts` turns each index into a name through
`EMOTIONS`, an ordered list of thirteen English item names, and `FilterModifierAnointment.vue` looks
each name up with `ITEM_BY_REF`.

The order of the table is in no file under `renderer/public/data/`. `items.ndjson` has the thirteen
oil items and their thirteen `Ancient` versions, sorted by name with no table index. The oil list in
`item-drop.json` has another order and lacks the three `Potent` oils. So a game patch that adds or
reorders a row maps the indexes to the wrong oils without an error. An index past the end of the
list makes `ITEM_BY_REF` return nothing, which the `!` in `FilterModifierAnointment.vue` turns into
a TypeError.

Done looks like: dataParser writes the oil ref names, or the table's names in row order, and the
renderer reads them from the data instead of `EMOTIONS`, with a test of `decodeOils` against the
committed data. This copy of dataParser cannot write the current data
([052](052-dataparser-older-than-committed-data.md)), so the data change waits for a run of the
version of the tool that wrote it.

## History

- 2026-10-22: Found while checking whether `renderer/public/data/` has the oil names in table
  order. It has the names but not the order, so `EMOTIONS` stays until the data tool writes it.
