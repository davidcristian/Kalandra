# The committed augment lines have a socketBound field that nothing reads

**Status:** open
**Area:** dataparser
**Origin:** [dataParser/src/services/augment_builder.py](../../../../dataParser/src/services/augment_builder.py)
**Verified:** 2026-10-27

Each augment line in the committed `items.ndjson` has `socketBound`: `true` on 20 lines in English,
such as Atziri's Soul Core of Alacrity and the Aldur cores, and `false` on 495. The data tool does
not write it, and `AugmentLineData` in `renderer/src/assets/data/interfaces.ts` does not declare it,
so no code reads it. `AugmentEditor.vue` reads `socketBound` of an `EditorItem`, which no code sets,
so the editor never marks an augment as bound to its socket. The `Legacy of #` stat also has a
`trade.count` that nothing reads and the tool does not write.

Done looks like: a decision for the maintainer. Either the next data build drops both fields, as it
drops the `gem` field ([111](111-unread-gem-field.md)), and `AugmentEditor.vue` stops reading
`socketBound`; or the tool writes `socketBound` from a game table that names the cores bound to
their socket, which is not yet known, and the parser passes it to the `EditorItem`.

## History

- 2026-10-27: Found while comparing a data build with the committed data
  ([052](052-dataparser-older-than-committed-data.md)).
