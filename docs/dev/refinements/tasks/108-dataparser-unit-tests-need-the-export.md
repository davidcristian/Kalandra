# dataParser unit tests that build a ValueConverterService need the game export

**Status:** done 2026-10-27
**Area:** dataparser
**Origin:** [dataParser/tests/inputs.py](../../../../dataParser/tests/inputs.py)
**Verified:** 2026-10-27

`ValueConverterService.__init__` in `dataParser/src/services/value_converter_service.py` calls
`get_blight()`, which reads the `PassiveSkills`, `BlightCraftingRecipes` and `BlightCraftingResults`
tables of the game export. `NdBuilderService` builds one, and `TaggedStats` builds an
`NdBuilderService`. `historic_agg` also reads `advanced_mod_stat_descriptions.csd`. So every test in
`test_nd_builder_service.py`, `test_nd_builder_english_list.py` and `test_tagged_stats.py`, and
three tests in `test_value_converter_service.py`, have the `needs_game_export` marker: 41 unit test
cases that skip in CI, which has no export.

Done looks like: these tests run without the export, with fakes of `GameStore` such as the
`FakeGameStore` in `test_value_converter_service.py`, for example by passing the stores in or by
reading the tables only when a method needs them. Then the marker leaves them.

## History

- 2026-10-27: Left when the tests that read the game export were made to skip without it
  ([051](051-dataparser-tests-and-ci.md)).
- 2026-10-27: test(dataparser): run the stat builder tests without the game export. With the
  export and trade data hidden, 269 tests pass and 280 skip, where 227 passed and 321 skipped.
- 2026-10-27: The byte for byte comparison of two full builds found
  [112](112-dataparser-output-depends-on-hash-seed.md).
