# The player-death charName starts with a colon and a space

**Status:** done 2026-10-27
**Area:** renderer
**Origin:** [renderer/src/web/client-log/client-log-parser.ts](../../../../renderer/src/web/client-log/client-log-parser.ts)
**Verified:** 2026-10-27

The client log parser reads chat lines from `Client.txt`, which start with `: `. It removes those
characters into `colonLess` and matches every chat type against `colonLess`, except one:
`text.match(SLAIN_REGEX)` runs on `text`. So a `player-death` event has `charName` set to
`": <name>"`. The `Should have deaths` test in `renderer/specs/web/client-log.test.ts` reads the
inline logs `log1` and `logStartThroughRedVale` and checks only `toContain("kvan")`, so it passes.

[docs/client-log-parser.md](../../../client-log-parser.md) documents the current value in the
`player-death` table and in its sample line, which comes from the line
`: HolyMolyThisIsCharName has been slain.` in the fixture `renderer/specs/web/FullCampaign.txt`.

Done looks like, in one commit: the match runs on `colonLess`; the test asserts the exact name and
fails before the fix; the table row and the sample line in docs/client-log-parser.md change.

## History

- 2026-10-18: Found while docs/client-log-parser.md was rewritten, by comparing the `player-death`
  branch with the other chat branches.
- 2026-10-27: fix(renderer): remove the leading colon from the player-death charName
