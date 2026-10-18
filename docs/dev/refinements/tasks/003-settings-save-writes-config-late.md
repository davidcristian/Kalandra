# Save in the Settings window does not write config.json at once

**Status:** open
**Area:** config
**Origin:** [renderer/src/web/settings/SettingsWindow.vue](../../../../renderer/src/web/settings/SettingsWindow.vue)
**Verified:** 2026-10-18

`save()` in `SettingsWindow.vue` calls `updateConfig()` with the edited copy, then `saveConfig()`,
`pushHostConfig()` and `wm.hide()`. `saveConfig()` in `renderer/src/web/Config.ts` returns without
sending while any widget has `wmZorder` `"exclusive"` and `wmWants` `"show"`. The Settings widget
is such a widget until `wm.hide()` runs, which is after the call. The watch on
`topmostOrExclusiveWidget` in `renderer/src/web/overlay/OverlayWindow.vue` saves when an exclusive
widget closes, but it skips a widget whose `wmType` is `"settings"`.

So main applies the new settings at once through `pushHostConfig()`, while `config.json` is written
only by the next `saveConfig()` that sends, usually when the overlay window loses focus. When
Kalandra exits or crashes before that, the change is lost.

One path in the code: click Save, open Settings again and click Quit. While Settings is open no
save sends, and Quit sends `CLIENT->MAIN::user-action` with `quit`, which calls `app.quit()` in
`main/src/AppTray.ts`.

Done looks like: Save sends `CLIENT->MAIN::save-config`, for example by hiding the widget before
`saveConfig()`, with a test that checks the event after a Save.

## History

- 2026-10-18: Found while the config module doc was written, by reading `save()`, `saveConfig()`
  and the `topmostOrExclusiveWidget` watch. Not reproduced in a running app.
