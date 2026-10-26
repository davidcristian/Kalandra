# What the client log events mean in the game

**Status:** never attempted
**Needs:** Path of Exile 2 on Windows
**Origin:** [docs/client-log-parser.md](../../../client-log-parser.md)
**Verified:** 2026-10-18

**Claims.** The client log parser turns lines of `Client.txt` into events
(`renderer/src/web/client-log/client-log.ts` and `client-log-parser.ts`). The parser only captures
text. [docs/client-log-parser.md](../../../client-log-parser.md) states what the game did when it
wrote each line, read from the real log `renderer/specs/web/FullCampaign.txt` without the game:

- `ms` is the millisecond counter the game writes after the date and time, and it counts from when
  the computer started.
- `load-zone`: the game writes `Generating level <n> area "<id>" with seed <n>` when it generates an
  area for the character to enter, and entering the same area instance again gives the same `seed`.
- `map-nav`, from `[SCENE] Set Source [<name>]`: the area name after an area loads; `(null)` while
  an area loads and when the full-screen map or the Atlas closes; `(unknown)` when no area is
  shown, such as at startup; the act name while that act's full-screen map is open; `Atlas` while
  the Atlas is open.
- `permanent-bonus`: campaign rewards, such as the ones from Beira and Candlemass, write the
  `<name> has received <bonus>` line.
- `afk`: the game writes the two AFK mode lines when AFK mode turns on and when it turns off.

**Do.** The claims are about the lines the game writes, so Kalandra does not need to run. Note the
time of each action: enter an area, leave it and enter the same instance again, open and close the
full-screen map and the Atlas, take a campaign reward, type `/afk` in the chat, then move. Find the
lines with those times in `Client.txt`
([section 7 of the runbook](../../runbooks/in-game-check.md#7-clienttxt-for-the-xp-tracker) gives
its path). Compare the `ms` number with the time since the computer started, shown as Up time in
Task Manager, Performance.

**Pass.** Each meaning on the page matches what the game did when it wrote the line.

**Record.** The game patch, real lines for the fixture, and any difference, fixed on the page in the
same commit as this file's History line.

## History

- 2026-10-18: Filed from the meanings the writer of docs/client-log-parser.md read from the fixture
  and could not compare with the game.
- 2026-10-18: Checked against the code. The check reads `Client.txt` directly, because
  `client-log.ndjson` also needs Enable experimental features and an existing output folder, and
  drops its first entry ([refinement 011](../../refinements/tasks/011-client-log-file-writer.md)).
  Removed the `Millis rolled over` claim: `client-log.ts` logs it when `ms` is below the last
  `game-start` entry's, which is code.
