# Nothing reads the gem field of the item data

**Status:** done 2026-10-27
**Area:** dataparser
**Origin:** [dataParser/src/services/specific_column_service.py](../../../../dataParser/src/services/specific_column_service.py)
**Verified:** 2026-10-27

`apply_gem_column` in `specific_column_service.py` writes `"gem": {"awakened": false,
"transfigured": false}` on each record of the `GEM` namespace: 870 records in each language's
`items.ndjson` on 2026-10-27. No code reads the field since the gem filters stopped checking
`gem.awakened` and `gem.transfigured`. `BaseType` in `renderer/src/assets/data/interfaces.ts` declares only
`gem.vaal`, which the tool never writes, and `TRADE_ITEM_BY_REF` in
`renderer/src/assets/data/index.ts` sets `gem: {}` on a gem it builds from the trade site's list.

Done looks like: the tool writes no `gem` field, `BaseType` and the trade list fallback drop it, and
the committed data loses it at the next data build, which
[052](052-dataparser-older-than-committed-data.md) covers.

## History

- 2026-10-27: Found when the transfigured and awakened gem filters were removed
  ([082](082-checks-for-item-names-the-data-lacks.md)).
- 2026-10-27: refactor: remove the unread gem field of the item data. The
  committed `items.ndjson` keeps the field until the next data build
  ([052](052-dataparser-older-than-committed-data.md)).
