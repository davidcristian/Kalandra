# This copy of dataParser produces older data than the app ships

**Status:** open
**Area:** dataparser
**Origin:** [dataParser/src/services/nd_builder_service.py](../../../../dataParser/src/services/nd_builder_service.py)
**Verified:** 2026-10-27

Exiled Exchange 2 developed the data tool in a private repo, so the committed data can be newer
than this copy ([AGENTS.md](../../../../AGENTS.md#what-this-is)). On 2026-10-18 the committed
data is newer:

- `dataParser/output/en/stats.ndjson` has 1936 lines and `renderer/public/data/en/stats.ndjson`
  has 2526 (`wc -l`).
- `dataParser/output/en/items.ndjson` has 2601 lines and `renderer/public/data/en/items.ndjson`
  has 4063.
- The 16 Waystone entries in `renderer/public/data/en/items.ndjson` have a `map` field
  (`grep -c '"map"'` prints 16). `dataParser/output/en/items.ndjson` has none, and no file in
  `dataParser/src/` writes such a field. `parseWaystone()` in `renderer/src/parser/Parser.ts`
  reads `map.tier`.

`git log` shows when the two split. `dataParser/output/` was last committed on 8 May 2026, and in
that commit the English files under `dataParser/output/en/` and `renderer/public/data/en/` are
identical. The `map` field first appears in the app's data on 11 Jun 2026. The next commit that
changes `dataParser/src/` after 8 May is the rename to Kalandra on 18 Oct 2026, and it adds no
`map` field. So the data commits after 8 May came from a version of the tool that this repo does
not have.

A `--push` from this copy would remove the `map` field and the stat and item lines that only the
committed data has. The generated files rule in AGENTS.md and
[ADR-0007](../../adr/ADR-0007-game-text-from-game-data.md) say to stop and ask in this case.

Done looks like: a decision for the maintainer. Bring this copy up to the committed data, by
writing the missing builders or by getting the newer tool's code, until a run reproduces the
committed files; or record that the data is maintained another way. Step 5 of
[runbooks/game-data-update.md](../../runbooks/game-data-update.md) and the Outputs section of
[modules/dataparser.md](../../modules/dataparser.md#outputs) then match the result.

## History

- 2026-10-18: Found while the game data update runbook was written, by comparing the tool's
  `output/` with `renderer/public/data/`.
- 2026-10-27: The maintainer chose to bring this copy up to the committed data. First compare a
  build from the local game export with the committed files, then write each missing builder, the
  Waystone `map` field first, until a run reproduces them.
- 2026-10-27: The tool now writes the Waystone `map` field, the `fixedStats` of six more uniques,
  the inverted Flesh Crucible damage, the Facebreaker `dp`, the `Grants Skill:` stats, the
  `Legacy of #` and Flesh Crucible keystone stats, and augment lines with the item classes of the
  game's categories, every stat of a core, the values the game shows and a lookup by stat hash. A
  build from the inputs of 25 Oct 2026 matches the committed English records, compared as parsed
  JSON without icons, but for newer inputs (9 stats added or renamed, the trade ids of 2 stats, the
  augment lines of 7 items, 5 `tradeTag` values), fields nothing reads (`gem` on 870 gems,
  `socketBound` on 292 items, 1 `trade.count`, the `id` of 9 merged stats) and the augment lines of
  6 items that the committed data lacks. The Japanese, Portuguese and French `Grants Skill:` texts
  differ, since the export has newer text and the French committed text has a backslash. Open until
  the maintainer's data update; the unread fields are
  [114](114-unread-augment-socket-bound-field.md).
