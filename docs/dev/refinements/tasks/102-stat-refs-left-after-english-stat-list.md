# Traditional Chinese stat refs and the random keystone stat still differ from English

**Status:** open
**Area:** data
**Origin:** [renderer/specs/data/stat-refs.test.ts](../../../../renderer/specs/data/stat-refs.test.ts)
**Verified:** 2026-10-26

Every language's `stats.ndjson` has the refs of the English file except Traditional Chinese. Its
file lacks 25 English refs, such as `# to Level of all Grenade Skill Gems` and the
`Expeditions contain 1 ...` stats, and has `# to Level of all Hazard Skill Gems` and
`# to Level of all Storm Skill Gems`, which the English file does not have. A build of this copy
of the data tool writes all 25 for Traditional Chinese, but these records are not among those that
the English stat list changes. `stat-refs.test.ts` lists both groups as the expected difference.
The parser does not recognize the lines of the 25 stats in Traditional Chinese.

The random keystone stat `#(Ancestral Bond-Zealot's Oath)` has the English keystone names, such as
`Vaal Pact`, as its matchers in all eight other languages, so its line in another language matches
no stat. This copy of the data tool does not write that stat
([052](052-dataparser-older-than-committed-data.md)).

Done looks like: a data update that gives Traditional Chinese the refs of the English file, with
the two lists removed from `stat-refs.test.ts`, and translated matchers for the random keystone
stat with a test that reads one in another language. Both wait for
[052](052-dataparser-older-than-committed-data.md) or for the maintainer's go-ahead to replace
these records alone.

## History

- 2026-10-26: Left by [065](065-stat-refs-differ-between-languages.md), whose data update changed
  only the records that the English stat list changes.
