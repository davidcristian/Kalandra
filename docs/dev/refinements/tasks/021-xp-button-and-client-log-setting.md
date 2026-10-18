# The XP button does not follow the Client.txt setting until a Save

**Status:** open
**Area:** renderer
**Origin:** [renderer/src/web/settings/SettingsWindow.vue](../../../../renderer/src/web/settings/SettingsWindow.vue)
**Verified:** 2026-10-18

The XP tracker reads the game's `Client.txt` log, and "Allow reading of Client.txt file"
(`readClientLog`) is off in `defaultConfig()`. `initInstance()` in
`renderer/src/web/leveling/WidgetXpTracker.vue` still gives the widget `wmFlags: []`, so a new
config shows the `XP` button in the widget menu. The `configVersion < 29` step of `upgradeConfig()`
adds the same widget to an older config and sets `readClientLog` to `false`, so an upgraded config
shows the button too. Opening the widget shows level 1 and area level 1, and nothing updates them.

`SettingsWindow.vue` watches `configClone.value?.readClientLog` and calls `disableWidget()` (which
adds the `menu::skip` flag) or `enableWidget()` on the XP widget. The watch also fires when the
Settings window opens, as `configClone` goes from `null` to a copy: the value goes from `undefined`
to `false`. So the first Save with the setting off removes the button, whatever the user changed.
[docs/xp-tracker.md](../../../xp-tracker.md) describes this as the current behavior.

Done looks like: the button state follows `readClientLog` from the start, either by giving the
default XP widget the `menu::skip` flag or by computing the flag from the setting. A change to the
default widget follows the hard rule in [AGENTS.md](../../../../AGENTS.md#the-one-hard-rule), and
its upgrade step sets the flag on a saved config that has the setting off. A test covers a new
config and a config with the setting on, and docs/xp-tracker.md changes in the same commit.

## History

- 2026-10-18: Found while docs/xp-tracker.md and docs/widgets.md were rewritten, by reading
  `initInstance()` and the watch. Not reproduced in a running app.
