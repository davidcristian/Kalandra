# The overlay attaches to the game window in each display mode

**Status:** never attempted
**Needs:** Path of Exile 2 on Windows
**Origin:** [docs/download.md](../../../download.md)
**Verified:** 2026-10-18

**Claims.** [docs/download.md](../../../download.md) and [docs/issues.md](../../../issues.md) say:

- The overlay works when the game runs in Windowed or Windowed Fullscreen mode and not in
  Fullscreen mode, and these are the names of the modes in the game's options. On Windows no code
  checks the display mode: `electron-overlay-window` finds the game window by its title
  (`windowTitle`, `Path of Exile 2` by default), and it handles its `fullscreen` event only on
  macOS.
- When Kalandra finds the game window, a banner with `Kalandra` and
  `Is ready and running in background` shows for 2.5 seconds
  (`renderer/src/web/overlay/LoadingAnimation.vue`). It shows while "Show a notification when the
  Overlay detects a PoE window" in Settings, General is ticked, the default.
- When the game runs as administrator and Kalandra does not, main logs
  `error [Overlay] PoE2 is running with administrator rights` and shows the dialog
  `PoE2 window: no access` with `Path of Exile 2 is running with administrator rights.`
  (`main/src/windowing/OverlayWindow.ts`).
- On Windows the tray menu can open behind the game window. Opening another window first, such as
  File Explorer with Win + E, works around it.

**Do.** [Section 1 of the runbook](../../runbooks/in-game-check.md#1-the-overlay-attaches-to-the-game)
for the banner, the dialog and the log line. Then switch the game to each of its display modes and
press the overlay key, Shift + Space, in each. Right-click the tray icon while the game has focus.

**Pass.** The banner shows once each time the game starts. The overlay draws over the game in the
two windowed modes, and the mode names match the page. The dialog and the log line appear with an
elevated game. The tray menu behaves as docs/issues.md says.

**Record.** The mode names exactly as the game writes them, what the overlay does in Fullscreen and
what the tray menu does. A difference from the pages is fixed on those pages in the same commit as
this file's History line.

## History

- 2026-10-18: Filed from the claims the writers of docs/download.md and docs/issues.md could not
  settle from the code.
