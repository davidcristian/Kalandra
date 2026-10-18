# Install, update and moving settings on Windows

**Status:** never attempted
**Needs:** Path of Exile 2 on Windows, and a published Kalandra release
([refinement 041](../../refinements/tasks/041-first-release-version.md))
**Origin:** [docs/download.md](../../../download.md)
**Verified:** 2026-10-18

**Claims.** [docs/download.md](../../../download.md) and
[ADR-0001](../../adr/ADR-0001-kalandra-continues-exiled-exchange-2.md) say:

- Kalandra is not code signed, so Windows SmartScreen warns before the first start, and More info
  then Run anyway starts it.
- The portable download starts slower than an installed copy because it unpacks itself on each
  start.
- An installed copy keeps its settings in `%APPDATA%\kalandra\apt-data` and takes updates from the
  GitHub releases of `davidcristian/Kalandra`. It downloads an update in the background, and
  Settings, About then shows "It will be installed automatically on exit" and an Install now button.
- Moving from Exiled Exchange 2: copy `apt-data` from `%APPDATA%\exiled-exchange-2` to
  `%APPDATA%\kalandra`, and the overlay keeps the old settings.
- Moving from Awakened PoE Trade: copy `apt-data` from `%APPDATA%\awakened-poe-trade`, change
  `"windowTitle": "Path of Exile"` to `"windowTitle": "Path of Exile 2"` in `config.json`, and the
  overlay attaches to Path of Exile 2. `upgradeConfig()` in `renderer/src/web/Config.ts` has no
  step for `windowTitle`, which is why the page has that step.

**Do.** Install the release with the Windows installer. Follow Moving from Exiled Exchange 2 with an
Exiled Exchange 2 `apt-data` folder, then Moving from Awakened PoE Trade with an Awakened PoE Trade
one, and start the game after each. Run the portable download once. When a second release exists,
let the installed copy update itself.

**Pass.** Each step works as written, and the overlay attaches with the old settings.

**Record.** The exact SmartScreen button names, and any difference, fixed on docs/download.md in the
same commit as this file's History line.

## History

- 2026-10-18: Filed from the install claims of docs/download.md, which no release yet exists to
  check.
- 2026-10-18: Checked against the code. Moved the release requirement into Needs, and the Do now
  covers both ways of moving settings.
