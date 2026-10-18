# macOS reports updates as not supported but still downloads them

**Status:** open
**Area:** main
**Origin:** [main/src/AppUpdater.ts](../../../../main/src/AppUpdater.ts)
**Verified:** 2026-10-18

The `AppUpdater` constructor sets `autoUpdater.autoDownload = !process.env.PORTABLE_EXECUTABLE_DIR`,
which is `true` on macOS. On `darwin` it then sets `noAutoUpdatesReason` to `"not-supported"` and
leaves `autoDownload` as it is. The `--no-updates` branch is an `else if` after that one, so the
flag changes nothing on macOS either.

With `autoDownload` on, `doCheckForUpdates()` in electron-updater emits `update-available` and then
starts a download. `main/electron-builder.yml` builds only the `dmg` target for macOS, so the
`latest-mac.yml` that electron-builder writes lists only the dmg. `MacUpdater` needs a zip file:
`doDownloadUpdate()` in `main/node_modules/electron-updater/out/MacUpdater.js` throws
`ZIP file not provided` with the code `ERR_UPDATER_ZIP_FILE_NOT_FOUND`.

The `error` handler in `AppUpdater` then sets the state to `error`. Settings, About replaces
`You can download it from GitHub` with `Error while checking for updates`, and the price check
window (`BackgroundInfo.vue`) stops showing the update. This sequence was read from the code and
not run: it needs a Mac and a published release.

Done looks like: `autoDownload` is `false` whenever `noAutoUpdatesReason` is set, checked on a Mac
with a release. The same Mac run can check the macOS claims of
[docs/download.md](../../../download.md), such as the Accessibility prompt at first start, and the
macOS `Client.txt` path in [docs/xp-tracker.md](../../../xp-tracker.md). No host task covers macOS,
because [host/](../../host/index.md) holds only checks on Windows.

## History

- 2026-10-18: Found while docs/download.md was rewritten, by reading `AppUpdater` and
  `MacUpdater.js`.
