# Item data collection writes rows, and new CSV samples for its page

**Status:** never attempted
**Needs:** Path of Exile 2 on Windows
**Origin:** [docs/item-data.md](../../../item-data.md)
**Verified:** 2026-10-18

**Claims.** [docs/item-data.md](../../../item-data.md) says:

- Each press of the Library widget's Log item to csv key copies the item under the cursor and
  writes one row to the session's CSV file in the output folder.
- A log key that includes Shift lets the player keep holding Shift and apply the same currency
  again. The app part is in the code: the log action has `keepModKeys: true`, so main releases only
  the key that is not a modifier and presses the copy keys while Shift stays down. Two parts are
  game behavior: the game copies the item while Shift is also held, and holding Shift keeps the
  currency on the cursor.

The page also has two CSV samples, and `docs/public/LargeDemo.csv` holds a larger one. None has the
`generation` key that the current build writes for each modifier that has one (`modToShortMod` in
`renderer/src/web/library/widget.ts`). `grep -c generation docs/public/LargeDemo.csv` prints `0`,
and the page says so in a note.

**Do.** In Settings, General, check Enable experimental features and then Item Data Collection, and
click Save. Show the Library widget, click edit on it, set Log item to csv to a key with Shift and
click Save. Start a session with the play button. Hold Shift with a currency on the cursor, apply
it to an item and press the log key, several times. Then open the session's CSV file in the output
folder, `%APPDATA%\kalandra\apt-data\csv-data` unless Output Folder sets another.

**Pass.** One row per press, and the currency stays on the cursor while Shift is held.

**Record.** Replace the two samples on the page and `docs/public/LargeDemo.csv` with rows from
sessions like this one, which have the `generation` key. Correct the row count the page gives for
LargeDemo.csv and remove the note, in the same commit as this file's History line. The samples hold
item text only, no account or character name.

## History

- 2026-10-18: Filed from the docs/item-data.md rewrite, which found the samples older than the
  format the build writes.
- 2026-10-18: Checked against the code. The Do now sets the log key before the session starts and
  names the settings as the app labels them.
