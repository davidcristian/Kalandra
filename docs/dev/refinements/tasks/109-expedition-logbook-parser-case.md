# No copied Expedition Logbook text shows what the logbook parsers do

**Status:** open
**Area:** parser
**Origin:** [renderer/src/parser/Parser.ts](../../../../renderer/src/parser/Parser.ts)
**Verified:** 2026-10-27

`parseAreaLevel` in `Parser.ts` reads the area level of an Expedition Logbook. `parseLogbookArea`,
listed three times in `parsers`, takes each section of three or more lines whose second line
matches a stat, such as the faction `Druids of the Broken Circle`, and reads nothing from it.
`specs/Parser/sectionUnit.test.ts` checks these results on lines of the logbook listing in
`renderer/specs/docs/fetchResponses.json`. No logbook copied from the game is in
`renderer/specs/Parser/items.ts`, so the format of its area sections is not known.

On 2026-10-27 a logbook text built by hand parsed to the same modifiers with and without
`parseLogbookArea`, once with plain modifier lines and once with `{ Implicit Modifier }` lines
after the faction. `parseModifiers` skips these sections in either form, because their first line,
the area name, is not a `{ ... }` line. So `parseLogbookArea` may change nothing.

Done looks like: a logbook copied with the advanced descriptions key, which
[host task 013](../../host/tasks/013-map-check.md) also asks for, as a case in `items.ts` with a
test of its area level and modifiers. Then `parseLogbookArea` is removed if the case parses the same
without it, or keeps a comment with its reason.

## History

- 2026-10-27: Split from [082](082-checks-for-item-names-the-data-lacks.md) when the unread
  `logbookAreaMods` value was removed, because the repo has no copied logbook text.
