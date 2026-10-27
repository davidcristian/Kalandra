# Two data builds write different stats files when Python's hash seed differs

**Status:** open
**Area:** dataparser
**Origin:** [dataParser/src/services/nd_builder_service.py](../../../../dataParser/src/services/nd_builder_service.py)
**Verified:** 2026-10-27

Two full builds of the same code and the same export write different `stats.ndjson` files when
`PYTHONHASHSEED` differs. On 27 Oct 2026, a build with a random seed and one with `PYTHONHASHSEED=0`
differed in 38 lines of eight files, every language but English. Each line had the same values,
with the keys of `trade.ids` in another order: `base_gain_x_rage_on_hit` in German had `implicit`,
`enchant`, `explicit` in one build and `explicit`, `implicit`, `enchant` in the other. Python
iterates a set of strings in an order that depends on the seed. `dedupe_matchers` in
`NdBuilderService` merges the trade ids of a group in the order of its rows, so a set before it is
the likely cause; which set has not been checked. A data update then shows changes that are not in
the game data, and two builds can be compared only with a fixed seed.

Done looks like: the build writes the same files for every seed, with a test that merges the trade
ids of the same rows in two orders and expects one result.

## History

- 2026-10-27: Found when two full builds were compared byte for byte
  ([108](108-dataparser-unit-tests-need-the-export.md)).
