# The XP tracker follows the game's Client.txt

**Status:** never attempted
**Needs:** Path of Exile 2 on Windows
**Origin:** [docs/xp-tracker.md](../../../xp-tracker.md)
**Verified:** 2026-10-18

**Claims.** `Client.txt` is the log file the game writes. The XP tracker reads two lines from it:
`Generating level <n> area "<id>" with seed <n>` for a new area and
`<name> (<class>) is now level <n>` for a level up (`LOG_ZONE_GEN` and `LOG_LEVEL_UP` in
`renderer/public/data/en/client_strings.js`). The real logs in
`renderer/specs/web/client-log.test.ts` and `FullCampaign.txt` match both patterns. The newest is
from April 2026, game version `4.4.0j`. [docs/xp-tracker.md](../../../xp-tracker.md) and
[docs/settings.md](../../../settings.md) say:

- With PoE log file empty, Kalandra finds the log at
  `C:\Program Files (x86)\Grinding Gear Games\Path of Exile 2\logs\Client.txt` for the standalone
  client or at `C:\Program Files (x86)\Steam\steamapps\common\Path of Exile 2\logs\Client.txt` for
  Steam (`main/src/host-files/GameLogWatcher.ts`).
- While the game runs, the widget changes the level on each level up and the area level on each new
  area. Towns and hideouts leave the area level as it was: `client-log.ts` skips an area id that
  contains `town` or `hideout` in lower case.
- After `Client.txt` is emptied while the game runs, the widget follows the next area:
  `GameLogWatcher` reads the file from its start when it gets shorter. This needs the game to write
  its next line at the new end of the file.
- `G1_1`, The Riverbank, is the first campaign area. `client-log.ts` sets the level to 1 when a
  character enters it, because only a new character goes there. If a character above level 1 can
  enter it again, the widget shows level 1 there.
- With the game in Korean, a level up line has `이(가)` as the game's text writes it, which the
  Korean `LOG_LEVEL_UP` in `renderer/public/data/ko/client_strings.js` matches literally. No test
  log is Korean.

**Do.** [Section 8 of the runbook](../../runbooks/in-game-check.md#8-clienttxt-for-the-xp-tracker),
with a character that can gain a level. Enter a town, the hideout and another area, gain a level,
and try to return to The Riverbank with that character. Open `Client.txt` and find the line for
each.

**Pass.** The lines of the current patch match the two patterns, the log is at one of the two paths,
the widget follows each new area and level up, also after `Client.txt` was emptied, and a character
above level 1 cannot enter `G1_1`.

**Record.** The game patch, and real lines if they differ from the test logs. A difference goes into
docs/xp-tracker.md or a refinement, in the same commit as this file's History line. The macOS path
in the page needs a Mac, which this list does not cover
([refinement 009](../../refinements/tasks/009-macos-updater-auto-download.md)).

## History

- 2026-10-18: Filed from the log claims the writer of docs/xp-tracker.md took from
  `client_strings.js` and `client-log.ts` and could not compare with a running game.
- 2026-10-18: Checked against the code. Removed two claims that need no game: the experience
  formula, which is code and which the game shows no number to compare with, and the widget's first
  position, which `initInstance()` in `WidgetXpTracker.vue` sets. Added the return to `G1_1`.
- 2026-10-25: Added the Korean level up line, after the data stopped reading `(가)` as a regex group
  ([refinement 085](../../refinements/tasks/085-unescaped-client-string-regexes.md)).
