# renderer/src/web/overlay: widgets and the registry

**Purpose.** A widget is one panel of the overlay, the transparent window that main keeps over the game: the menu,
the price check, a stopwatch and the others. `renderer/src/web/overlay/` holds the widget types, the registry that
lists every widget component, the window manager in `OverlayWindow.vue` that shows and hides them, and the frame
`Widget.vue` that most widgets draw in. Every widget's config is an entry in the user's saved config, so the rule
that a saved config survives every update covers it ([config.md](config.md),
[ADR-0003](../adr/ADR-0003-config-survives-updates.md)).

## Public contract

- `Widget` ([widgets.ts](../../../renderer/src/web/overlay/widgets.ts)) is the part every widget config has:
  `wmId` (unique number in the config), `wmType` (the widget type, which the registry matches to a component),
  `wmTitle` (the name in the menu; a `{icon=fa-...}` prefix shows an icon), `wmWants` (`show` or `hide`),
  `wmZorder` (a number, `exclusive`, or `null`) and `wmFlags`.
- `WellKnownFlag` lists the named flags: `uninitialized` (a new instance whose component must fill its own
  fields), `menu::skip` (left out of the menu), `has-browser` (the price check shows the built-in browser),
  `invisible-on-blur` (not drawn while the overlay is inactive), `hide-on-blur` (hidden when the overlay loses
  focus), `hide-on-focus` (hidden when the overlay gets focus) and `ignore-ui-visibility` (drawn while main hides
  the UI with `MAIN->OVERLAY::visibility`, when the overlay is active). The flag `settings::widget=<wmId>` on the
  settings widget opens that widget's settings page.
- `WidgetSpec` is the static `widget` option of a widget component: `type` (its `wmType`), `instances`
  (`single` or `multi`), `trNameKey` (the i18n key of its name in the menu's "add widget…" list), `initInstance()`
  (the config of a single widget, which a single widget must have) and `defaultInstances()` (the instances of a
  multi widget in a new config, which a multi widget can leave out).
  [widget-component.ts](../../../renderer/src/web/overlay/widget-component.ts) adds `widget` to Vue's component
  options with this type, so the type check covers the option in every component.
- `registry` ([widget-registry.ts](../../../renderer/src/web/overlay/widget-registry.ts)) holds the array
  `widgets`, filled by one `registerWidget` line per component, and `getWidgetComponent(wmType)`, which
  returns the component whose `widget.type` is `wmType`. `registerWidget` throws when the component has no
  `widget` option. `defaultConfig()` in `Config.ts` builds a new config's
  `widgets` in registry order: `initInstance()` of each single widget, `defaultInstances()` of each multi widget,
  `wmId` counting from 1.
- [OverlayWindow.vue](../../../renderer/src/web/overlay/OverlayWindow.vue) renders the component of each entry in
  `AppConfig().widgets` with the entry as its `config` prop, and provides the `WidgetManager`
  ([interfaces.ts](../../../renderer/src/web/overlay/interfaces.ts)) as `wm`: `show`, `hide`, `remove`, `bringToTop`,
  `create(wmType)`, `setFlag`, `widgets`, `active`, `size` and `poePanelWidth`. A widget reads it with
  `injectWidgetManager()` from `overlay/injections.ts`, which throws when nothing provides it. Showing a widget hides
  the `exclusive` widget that is shown, if any. Under the widgets it renders the stash prices layer, which is not a
  widget, while `useStashHighlights().shown` holds ([renderer-stash-prices.md](renderer-stash-prices.md)). It sends
  `OVERLAY->MAIN::render-state` with `shouldShow` whenever the overlay starts or stops having something to draw, the
  layer included, saves the config when the window loses focus, and starts the background state: `usePoeninja()`,
  `useLeagues().load()` and `useClientLog()`, the shared `createClientLog()` state, whose `handleLines()` reads the
  `MAIN->CLIENT::game-log` lines in order. A line that throws is logged with `console.error` and skipped, and the lines
  after it are still read. `logToMain()` sends the error of the first such line of a run, without the line, which can
  hold chat text.
- [Widget.vue](../../../renderer/src/web/overlay/Widget.vue) is the frame, with the "hide", "edit", "move" and
  "delete" buttons. Its props: `config` (a widget with an `anchor`: `pos` such as `tl` or `cc`, and `x` and `y` in
  percent of the screen), `moveHandles`, `readonly`, `removable`, `hideable` and `inlineEdit`. With `inlineEdit`
  false, "edit" opens the widget's page in the settings window.
- [WidgetMenu.vue](../../../renderer/src/web/overlay/WidgetMenu.vue) shows a button for each widget without
  `menu::skip`: only the hidden ones, unless "Show button for active widgets" (`alwaysShow`) is on. It shows no
  button for the XP tracker while "Allow reading of Client.txt file" (`readClientLog`) is off. It offers the
  multi widgets under "add widget…". Its paste field ("Price check (Ctrl + V)") dispatches the pasted text to the
  price check as `MAIN->CLIENT::item-text` inside the renderer, with `Host.selfDispatch`.

## The registered widgets

In registry order. Paths are under `renderer/src/web/`, and the user pages are on
https://davidcristian.github.io/Kalandra/ (each link opens the page's source).

| `wmType` | Component | Config type | Instances | User page |
| --- | --- | --- | --- | --- |
| `menu` | `overlay/WidgetMenu.vue` | `WidgetMenu` (`overlay/widgets.ts`) | single | [`/widgets`](../../widgets.md) |
| `settings` | `settings/SettingsWindow.vue` | `Widget` | single | [`/settings`](../../settings.md) |
| `item-search` | `item-search/WidgetItemSearch.vue` | `ItemSearchWidget` (`item-search/widget.ts`) | single | [`/extra-widgets`](../../extra-widgets.md) |
| `experience-tracker` | `leveling/WidgetXpTracker.vue` | `XpWidget` (`leveling/widget.ts`) | single | [`/xp-tracker`](../../xp-tracker.md) |
| `timer` | `stopwatch/WidgetTimer.vue` | `StopwatchWidget` (`overlay/widgets.ts`) | multi | [`/extra-widgets`](../../extra-widgets.md) |
| `stash-search` | `stash-search/WidgetStashSearch.vue` | `StashSearchWidget` (`stash-search/widget.ts`) | multi | [`/stash-search`](../../stash-search.md) |
| `price-check` | `price-check/PriceCheckWindow.vue` | `PriceCheckWidget` (`overlay/widgets.ts`) | single | [`/price-check`](../../price-check.md) |
| `item-check` | `item-check/WidgetItemCheck.vue`, with `map-check/MapCheck.vue` | `ItemCheckWidget` (`item-check/widget.ts`) | single | [`/item-info`](../../item-info.md), [`/map-check`](../../map-check.md) |
| `image-strip` | `overlay/WidgetImageStrip.vue` | `ImageStripWidget` (`overlay/widgets.ts`) | multi | [`/extra-widgets`](../../extra-widgets.md) |
| `notepad` | `notepad/WidgetNotepad.vue` | `NotepadWidget` (`overlay/widgets.ts`) | multi | [`/extra-widgets`](../../extra-widgets.md) |
| `library` | `library/WidgetLibrary.vue` | `LibraryWidget` (`library/widget.ts`) | single | [`/item-data`](../../item-data.md) |
| `stash-prices` | `stash-prices/WidgetStashPrices.vue` | `StashPricesWidget` (`stash-prices/widget.ts`) | single | [`/stash-prices`](../../stash-prices.md) |

The menu, price check, item check, library and stash prices start with `menu::skip`. In the copy that the settings
window edits, two widgets get the flag from a setting when the window opens and when the setting changes: the XP
tracker has it while "Allow reading of Client.txt file" is off, and the library unless both "Enable experimental
features" and "Item Data Collection" are on (`enableWidget` and `disableWidget` in `settings/utils.ts`). Adding the
flag also hides the widget. The Price check page removes the flag when "Price a stash tab in the background" is checked
and adds it when it or the suggested price is unchecked. The price check is in
[renderer-price-check.md](renderer-price-check.md), and the stash prices widget in
[renderer-stash-prices.md](renderer-stash-prices.md).

### Stash search presets

A stash search entry (`StashSearchEntry` in `stash-search/presets.ts`) with a `preset` searches that preset's game
text in the loaded game language, which `entrySearchText()` builds from the client strings: `currency` is
`RARITY_CURRENCY`, `normal-rarity` is `RARITY` and `RARITY_NORMAL`, `trial-count` is `TRIAL_COUNT`,
`waystone-tier` is `WAYSTONE_TIER` and `martial-weapon` is `MARTIAL_WEAPON`, put in quotes when the text has a
space. The widget's buttons, the Settings field and the hotkeys sent to main all read it. Typing in the field calls
`setEntryText()`, which removes the preset, so the user's text stays in every language. A widget added from the menu
and each `Dump sorting` search but `Jewel` start with presets. `Jewel` and the `Map rolling` searches are English
text, since the game data has no text for them
([refinement 072](../refinements/tasks/072-stash-search-presets-in-english.md)).

## Adding a widget

1. Write the component in its own folder under `renderer/src/web/`, with a static
   `widget: { ... } satisfies WidgetSpec` in its component options, as every registered widget has. Eight put it
   in `defineComponent`; four put it in a plain `export default` next to `<script setup>`, as
   `WidgetImageStrip.vue` does. The `type` becomes the `wmType` in every user's saved config, and only an upgrade
   step can change it later.
2. Write its config type as an interface that extends `Widget`. It goes in `overlay/widgets.ts` or, as for six
   widgets, in a `widget.ts` in the widget's own folder. A single widget sets every field in
   `initInstance()`. A multi widget sets its fields in `setup` when `wmFlags[0]` is `uninitialized`, as
   `WidgetTimer.vue` does, because `create()` adds a bare `Widget` with only that flag.
3. Add one `registerWidget` line with the component to `widget-registry.ts`. It needs no cast.
4. Follow [the one hard rule](../../../AGENTS.md#the-one-hard-rule) for the new config type. For a single widget,
   the new upgrade step inserts `defaultConfig()`'s entry with a new `wmId`, as the `< 29` step does for
   `experience-tracker`; without it an existing config has no entry for the type.
   Add the widget to `defaultConfigMock` in `renderer/specs/vitest.setup.ts` only when a test reads its config.
5. A hotkey goes into `shortcutActions()` in `shortcut-actions.ts` as a `ShortcutAction`, such as `trigger-event` with a
   target, as the stopwatch has. The component handles `MAIN->CLIENT::widget-action` with that
   target.
6. A settings page is a component in the widget's folder, a name in `SettingsPage` and a `case "<type>"` in
   `menuPages()` in `settings/menu.ts`, and an entry in `PAGES` in `settings/SettingsWindow.vue`. Its frame sets
   `inline-edit` to `false`, so "edit" opens that page.
7. Put its UI text in `renderer/public/data/en/app_i18n.json` under the widget's key. A multi widget names its
   menu entry with `trNameKey`. `specs/web/template-text.test.ts` fails on a template text node, or a static
   `title`, `placeholder`, `label`, `alt` or `aria-label`, that has a letter and is not in `ALLOWED`, its list of
   names, paths and symbols that are the same in every language.
8. Describe it on a user page in `docs/`, add the page to the sidebar in `docs/.vitepress/config.js`, and add a row
   to the table above.

## Invariants

- **`wmType` is a storage key.** It is renamed or removed only by an upgrade step: the `< 7` step renames
  `map-check` to `item-check`, the `< 26` step removes `filter-generator` entries, and the `< 41` step removes
  `delve-grid` entries. `OverlayWindow.vue` draws nothing for an entry whose `wmType` has no registered component,
  since `getWidgetComponent()` returns `undefined`, and the entry stays in the config and in every save.
- **Every single widget has an entry in every config.** Code reads it as `AppConfig("<type>")!`, and
  `shortcutActions()` reads the `price-check`, `item-check` and `library` entries without a check.
- **A widget changes its config in place**, through its `config` prop, which is the entry in `AppConfig()`.
  `saveConfig()` sends the whole config to main with `CLIENT->MAIN::save-config` when it differs from the last
  one saved, and does nothing while an `exclusive` widget is shown.
- **The manager needs one widget with a numeric `wmZorder`** to find the topmost widget; the menu has
  `wmZorder: 1`.
- **A Map check mark names its modifier in every language**: the stat `ref`, with the `negate` and `value` of the
  wording (`MapStatKey` in `map-check/mark-target.ts`). `findMark()` returns the first mark with the key of a row or
  of a modifier on the item. A mark saved before config version 37 has `matcher`, its text in the language of that
  time, and matches any wording of its modifier in that language. After each game data load, `renderer/src/main.ts`
  passes the marks to `convertTextMarks()` in `map-check/saved-marks.ts`, which names each one it finds by key, drops
  one whose key an earlier mark has and keeps one the loaded language does not have.

**Dependencies.** Vue 3 and vue-i18n; `Config.ts` (`AppConfig`, `saveConfig`, `pushHostConfig`, `defaultConfig`,
[config.md](config.md)); the `IpcEvent` messages in `ipc/types.ts` ([ipc.md](ipc.md)); the background state in
`web/background/` and `web/client-log/`.

**Tests.** `npx vitest run` in `renderer/`. `specs/web/overlay-window.client.test.ts` mounts `OverlayWindow.vue`
with Vue's client renderer on fake nodes, a stub registry that draws each widget as an empty element, and a fake
`Host`. It checks the `render-state` the page sends and the widgets it draws for a shown widget without a blur flag,
an `invisible-on-blur` widget and a `hide-on-blur` widget as the overlay gains and loses focus, the stash layer and
the widgets while Alt hides the overlay, and the `save-config` it sends when the window loses focus and when the
price check closes. No test covers `Widget.vue`, and coverage
counts only the `.ts` files of `src/` (`coverage.include` in `vitest.config.ts`). `specs/web/widget-registry.test.ts`
loads every widget component and checks the registered types and the invariants above on the widgets of
`defaultConfig()`: one entry per single widget, a registered component and valid `Widget` fields for each, the
menu's numeric `wmZorder`, the `menu::skip` flags and new objects at each call. Widget logic outside components is tested in
`specs/web/item-check.test.ts` (`hotkeyable-actions.ts`: the poe2db page of each item kind, in English and
Japanese, the Craft of Exile button, which `offersCraftOfExile()` in `item-check/craft-of-exile.ts` shows only in
English, as it does the button's hotkey, and the stash search for the same price note, which adds the name up to 50
characters),
`specs/web/item-check-hotkeys.test.ts` (the pages and the stash search that the item check hotkeys open for item
text from a fake host, and nothing for text that is not an item),
`specs/web/library/libraryChaos.test.ts` (`library/widget.ts`: the kept modifier kinds and the columns of a
profile), `specs/web/library/itemDiff.test.ts` (`diffItem()`, the prefixes and suffixes a logged Waystone gained
and lost, and the CSV row they make), `specs/web/library/session.test.ts` (`library/session.ts`, which keeps a
session inactive until main opens its file), `specs/web/client-log.test.ts` (the player and area levels the XP
tracker reads, with `FullCampaign.txt`, and a line that fails), `specs/web/xp-formula.test.ts`
(`leveling/xp-formula.ts`, the XP tracker's safe zone, multiplier, Over and star, with the examples of the user
page), `specs/web/map-check-marks.test.ts` (the Map check marks in English and German, before and after a
conversion), `specs/web/map-check-decisions.test.ts` (the mark each click sets in one profile, the marks that
have a color, and `removeMark()`, which the x button in Settings calls and which keeps the marks of the other
profiles), `specs/web/map-check-stats.test.ts` (the rows `prepareMapStats()` lists for a Waystone and a Tablet,
with their rolls and keys), `specs/web/host-uploads.test.ts` (`Host.importFile()`, which
the image strip uses to add an image), `specs/web/image-import.test.ts` (`overlay/image-import.ts`, which adds the stored image to the strip, or
shows the strip's red message when main does not store it), `specs/web/widget-component.test.ts`
(`overlay/widget-component.ts`, which throws for a component without a `widget` option),
`specs/web/overlay-injections.test.ts` (`injectWidgetManager()` and `injectShowBrowser()`, which return what
the app provides and throw when nothing does), `specs/web/widget-menu.test.ts` (the widget buttons that `WidgetMenu.vue` draws for a new config, for one with
`readClientLog` on and for configs upgraded from versions 28 and 36),
`specs/web/settings/menu.test.ts` (`settings/menu.ts`, the pages the Settings menu lists for each widget),
`specs/web/settings/utils.test.ts` (`settings/utils.ts`: the page props, the field models, `findWidget`, `requireWidget`, which throws for a type the config has no
widget of, and
`disableWidget` and `enableWidget`, which add `menu::skip` once and remove every copy),
`specs/web/settings/hotkey-conflicts.test.ts` (`settings/hotkey-conflicts.ts`, the hotkeys that two actions
share in the edited config, and the hint of a field for them and for each reason main gives),
`specs/web/settings/hotkeys-page.test.ts` (the Hotkeys page, whose one row for the item check key has the
translated names of Map check and Item info joined by " / ", in English and German), `specs/web/stash-search.test.ts` (`stash-search/widget.ts` and `presets.ts`: the search of a
new Stash search widget and of each preset in English, German and Korean, an edited entry, the hotkey of a preset,
and the `< 39` and `< 40` config steps) and
`specs/web/host-events.test.ts` (`Host.sendEvent()`, which sends no `OVERLAY->MAIN::` event from a
browser tab, `Host.logs`, which keeps the last 1000 lines of main's log for Settings, Debug and starts again
from the history main sends after a reconnect, `Host.onEvent()`, which passes each message from the fake socket to
the listeners of its name until their controller aborts and passes no `MAIN->OVERLAY::` event in a browser tab,
`Host.unregisteredHotkeys`, `Host.updateInfo`, `Host.focus` and `Host.getConfig()`) and `specs/web/host-send-queue.test.ts`
(`Host.sendEvent()` before `init()`, while the socket is closed and while it connects again, with a fake socket
that throws and drops text as the browser's does, and the limit of kept events). In `FullCampaign.txt`, other players' names and all whisper and guild chat text are placeholders.
Overlay focus, hiding on blur and the hotkeys need the game:
[runbooks/in-game-check.md](../runbooks/in-game-check.md).
