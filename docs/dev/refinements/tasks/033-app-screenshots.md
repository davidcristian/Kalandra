# Take current screenshots of the Settings window and the add widget menu

**Status:** open
**Area:** docs
**Origin:** [docs/settings.md](../../../settings.md)
**Verified:** 2026-10-26

The rewrite of the user pages removed their old Settings screenshots. Those show the window title
`Settings - Exiled Exchange 2` and a menu without the Leveling page. The current title is
`settings.title` in the English `app_i18n.json`, `Settings - Kalandra`, and `SettingsWindow.vue`
lists `SettingsLeveling`. Some screenshots that the pages still use are also out of date. These
need new ones:

| Page | Screenshot to take |
| --- | --- |
| [settings.md](../../../settings.md) | The window with its menu, and the Debug page, which [faq.md](../../../faq.md) links for the log |
| [item-info.md](../../../item-info.md) | Settings, Item info, with the Filter by row |
| [map-check.md](../../../map-check.md) | Settings, Map check |
| [private-leagues.md](../../../private-leagues.md) | Settings, Price check, with a private league in the `My League (PL12345)` form |
| [item-data.md](../../../item-data.md) | The Library settings page, with the Recording settings checkboxes and the `kalandra` output folder |
| [extra-widgets.md](../../../extra-widgets.md), [stash-search.md](../../../stash-search.md) | The add widget menu, which now lists Notepad (`WidgetNotepad.vue` has `instances: "multi"`), to replace `AddImageStrip.png`, `StopWatchAdd.png` and `StashSearchAdd.png` |
| [stash-search.md](../../../stash-search.md), [features.md](../../../features.md) | The `Dump sorting` widget, to replace `DumpSortWidget.png`, which shows the search `Trials:` where the widget now shows `"Number of Trials:"` |
| [widgets.md](../../../widgets.md) | The main button bar of a new install, which has no `Cheat sheets` button, to replace `mainWidget.png` |
| [chat-commands.md](../../../chat-commands.md) | The Chat page with the default commands of `defaultConfig()`, to replace `ChatCommandsList.png`, which shows `@last ty gl` and the keys End, PageUp, PageDown and Insert |

None of these needs the game. Kalandra started with `--no-overlay` opens its page in the default
browser, and the tray item Open in Browser opens it again ([docs/cmd-flags.md](../../../cmd-flags.md)).
A dev run ([DEVELOPING.md](../../../../DEVELOPING.md)) reads `config.json` but never writes it, so
a setting changed for a shot is not saved. It reads the same `%APPDATA%\kalandra\apt-data\config.json`
as an installed Kalandra, because `main/package.json` names the app `kalandra`. So it shows the
defaults, which the Chat shot needs, only when that file does not exist.

Done looks like: each image is in `docs/reference-images/`, under 2 MB (the
`check-added-large-files` hook), referenced from its page with an alt text that says what it shows,
and the docs build passes. Screenshots of the game itself are [host task 017](../../host/tasks/017-game-screenshots.md).

## History

- 2026-10-18: Collected from the writers of the user pages, who removed the outdated screenshots
  but could not run the app to take new ones.
- 2026-10-26: Added the `Dump sorting` widget, whose last search now comes from the game data.
- 2026-10-26: Removed the row for `ocr-guide.md`, which was deleted with the Heist gem OCR
  ([031](031-path-of-exile-1-features.md)).
- 2026-10-26: Added the main button bar, since a new install has no `Cheat sheets` image strip
  ([031](031-path-of-exile-1-features.md)).
