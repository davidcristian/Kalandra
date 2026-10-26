# The data loader cannot read the stat group lines of Exiled Exchange 2's newer data

**Status:** open
**Area:** data
**Origin:** [docs/dev/runbooks/cherry-pick-upstream.md](../../runbooks/cherry-pick-upstream.md)
**Verified:** 2026-10-26

Two commits by Kvan7 on `upstream/dev` were tried as cherry-picks and aborted:

- `0a8fe61b` "add support for match v2 from upstream" lets a line of `stats.ndjson` be a group of
  stats, `{"resolve": {...}, "stats": [...]}`, in the format of Awakened PoE Trade. The resolve
  strategy `select` picks a member by the item category, and `trivial-merge` merges the members'
  trade ids. `percent-merge` and `flag-merge` are typed but not handled. The pick conflicts in 6
  of its 10 files. Its lookups `STAT_BY_MATCH_STR_V2` and `STAT_BY_REF_V2` read one index row per
  hash, where Kalandra's `statsByMatcherText()` and `statByRef()` read every row with the hash, to
  find stats that share a text and refs whose hashes collide. Its spec changes assert mock calls,
  its trade and pseudo filter changes add non-null assertions, and its `make-index-files.mjs`
  indexes a matcher with an advanced text only by that text.
- `d95f53e1` "[Bug]: Pricechecking Mask of the Sanguimancer with Blood Magic fails" moves the
  random keystone stat `#(Ancestral Bond-Zealot's Oath)` and the nine keystone stats into one
  group with a new `filter` strategy, in all nine languages. It needs the first commit:
  `make-index-files.mjs` stops with a `TypeError` on the group line, which has no `ref`. Its
  `filter` uses the members without a category only when `list.length === 0`, which never holds,
  because `map` keeps the length. So on an item other than a jewel it returns no stat, and the
  parser falls back to the trade site's stat text. This is read from the code, not run.

The bug that the second commit fixes is not in Kalandra. `statMatchForLine()` in
`renderer/src/parser/match-stats.ts` picks the keystone's own stat for the `Blood Magic` line, and
the parser case `KeystoneUniqueLine` is the item text of that bug report (host task
[019](../../host/tasks/019-keystone-lines.md)). The committed `stats.ndjson` files have no group
line, and this copy of the data tool writes none ([052](052-dataparser-older-than-committed-data.md)).

Done looks like: a decision for the maintainer. Decline both commits, or read group lines once
Kalandra takes data that has them. Then `make-index-files.mjs`, `statsByMatcherText()`,
`statByRef()`, `STATS_ITERATOR` and `stat-refs.test.ts` read each member of a group,
`match-stats.ts` applies the `select` and `filter` strategies with the item category, each
strategy has a test, and the group record of `d95f53e1` goes into the data with parser cases for a
jewel and a helmet.

## History

- 2026-10-26: Found when the two commits were tried as cherry-picks and aborted.
