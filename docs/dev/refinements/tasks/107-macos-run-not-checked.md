# No run on a Mac has checked updates, the Accessibility prompt or the game's file paths

**Status:** open
**Area:** main
**Origin:** [docs/download.md](../../../download.md)
**Verified:** 2026-10-27

Kalandra builds a macOS dmg, but no agent can run it, and [host/](../../host/index.md) holds only
checks on Windows. These macOS behaviors come from reading the code and have never run on a Mac:

- **Update state.** On macOS, `AppUpdater` in `main/src/AppUpdater.ts` sets `noAutoUpdatesReason`
  to `not-supported` and turns off `autoUpdater.autoDownload`, because the dmg build has no zip
  file for `MacUpdater`. `main/specs/AppUpdater.test.ts` checks this through a fake
  electron-updater. With a published release newer than the installed one, Settings, About and the
  price check window should show "Update available" and "You can download it from GitHub", and the
  log should have no `error [AppUpdater]` line.
- **Accessibility prompt.** [docs/download.md](../../../download.md) says that macOS asks for the
  Accessibility permission at the first start, that Kalandra waits 15 seconds and starts once it is
  granted, and that it quits otherwise. `ensureAccessibilityPermission()` in `main/src/main.ts`
  and `startWhenReady()` in `main/src/startup.ts` do this.
- **Game file paths.** `defaultLogFiles()` and `defaultConfigFiles()` return no path on macOS since
  [092](092-macos-client-log-path.md) closed. Nobody has found where Path of Exile 2 writes
  `Client.txt` and `poe2_production_Config.ini` on a Mac.

Done looks like: someone on a Mac with Path of Exile 2 and a published release checks each claim
above, fixes each page the run proves wrong and files a task for each bug. The paths the run finds,
for each way the game runs on a Mac, go into `GameLogWatcher.ts`, `GameConfig.ts` and
docs/settings.md, as [092](092-macos-client-log-path.md) describes.

## History

- 2026-10-27: Filed when [009](009-macos-updater-auto-download.md) closed, for the part of it that
  needs a Mac.
