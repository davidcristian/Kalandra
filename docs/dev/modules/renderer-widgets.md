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
  ([interfaces.ts](../../../renderer/src/web/overlay/interfaces.ts)) as `wm`: `show`, `hide`, `remove`,
  `bringToTop`, `create(wmType)`, `setFlag`, `widgets`, `active`, `size` and `poePanelWidth`. Showing a widget
  hides the `exclusive` widget that is shown, if any. It sends `OVERLAY->MAIN::render-state` with `shouldShow`
  whenever the overlay starts or stops having something to draw, saves the config when the window loses focus,
  and starts the background state: `usePoeninja()`, `useLeagues().load()` and `useClientLog()`, the shared
  `createClientLog()` state, whose `handleLines()` reads the `MAIN->CLIENT::game-log` lines in order. A line that
  throws is logged with `console.error` and skipped, and the lines after it are still read.
- [Widget.vue](../../../renderer/src/web/overlay/Widget.vue) is the frame, with the "hide", "edit", "move" and
  "delete" buttons. Its props: `config` (a widget with an `anchor`: `pos` such as `tl` or `cc`, and `x` and `y` in
  percent of the screen), `moveHandles`, `readonly`, `removable`, `hideable` and `inlineEdit`. With `inlineEdit`
  false, "edit" opens the widget's page in the settings window.
- [WidgetMenu.vue](../../../renderer/src/web/overlay/WidgetMenu.vue) shows a button for each widget without
  `menu::skip`: only the hidden ones, unless "Show button for active widgets" (`alwaysShow`) is on. It offers the
  multi widgets under "add widget…". Its paste field ("Price check (Ctrl + V)") dispatches the pasted text to the
  price check as `MAIN->CLIENT::item-text` inside the renderer, with `Host.selfDispatch`.

## The registered widgets

In registry order. Paths are under `renderer/src/web/`, and the user pages are on
https://davidcristian.github.io/Kalandra/ (each link opens the page's source).

| `wmType` | Component | Config type | Instances | User page |
| --- | --- | --- | --- | --- |
| `menu` | `overlay/WidgetMenu.vue` | `WidgetMenu` (`overlay/widgets.ts`) | single | [`/widgets`](../../widgets.md) |
| `settings` | `settings/SettingsWindow.vue` | `Widget` | single | [`/settings`](../../settings.md) |
| `item-search` | `item-search/WidgetItemSearch.vue` | `ItemSearchWidget` (`item-search/widget.ts`) | single | [`/extra-widgets`](../../extra-widgets.md), [`/ocr-guide`](../../ocr-guide.md) |
| `experience-tracker` | `leveling/WidgetXpTracker.vue` | `XpWidget` (`leveling/widget.ts`) | single | [`/xp-tracker`](../../xp-tracker.md) |
| `timer` | `stopwatch/WidgetTimer.vue` | `StopwatchWidget` (`overlay/widgets.ts`) | multi | [`/extra-widgets`](../../extra-widgets.md) |
| `stash-search` | `stash-search/WidgetStashSearch.vue` | `StashSearchWidget` (`stash-search/widget.ts`) | multi | [`/stash-search`](../../stash-search.md) |
| `price-check` | `price-check/PriceCheckWindow.vue` | `PriceCheckWidget` (`overlay/widgets.ts`) | single | [`/price-check`](../../price-check.md) |
| `item-check` | `item-check/WidgetItemCheck.vue`, with `map-check/MapCheck.vue` | `ItemCheckWidget` (`item-check/widget.ts`) | single | [`/item-info`](../../item-info.md), [`/map-check`](../../map-check.md) |
| `image-strip` | `overlay/WidgetImageStrip.vue` | `ImageStripWidget` (`overlay/widgets.ts`) | multi | [`/extra-widgets`](../../extra-widgets.md) |
| `delve-grid` | `overlay/WidgetDelveGrid.vue` | `DelveGridWidget` (`overlay/widgets.ts`) | single | [`/extra-widgets`](../../extra-widgets.md) |
| `notepad` | `notepad/WidgetNotepad.vue` | `NotepadWidget` (`overlay/widgets.ts`) | multi | [`/extra-widgets`](../../extra-widgets.md) |
| `library` | `library/WidgetLibrary.vue` | `LibraryWidget` (`library/widget.ts`) | single | [`/item-data`](../../item-data.md) |

The menu, price check, item check, library and Delve grid start with `menu::skip`. The settings window removes
and adds `menu::skip` on the XP tracker when "Allow reading of Client.txt file" turns on or off, and on the library
when "Enable experimental features" together with "Item Data Collection" turns on or off (`enableWidget` and
`disableWidget` in `settings/utils.ts`). Adding the flag also hides the widget. The Delve grid is shown and
hidden by the "Grid for Delve Chart" hotkey. The price check is in [renderer-price-check.md](renderer-price-check.md).

## Adding a widget

1. Write the component in its own folder under `renderer/src/web/`, with a static
   `widget: { ... } satisfies WidgetSpec` in its component options, as every registered widget has. Seven put it
   in `defineComponent`; five put it in a plain `export default` next to `<script setup>`, as
   `WidgetDelveGrid.vue` does. The `type` becomes the `wmType` in every user's saved config, and only an upgrade
   step can change it later.
2. Write its config type as an interface that extends `Widget`. It goes in `overlay/widgets.ts` or, as for five
   widgets, in a `widget.ts` in the widget's own folder. A single widget sets every field in
   `initInstance()`. A multi widget sets its fields in `setup` when `wmFlags[0]` is `uninitialized`, as
   `WidgetTimer.vue` does, because `create()` adds a bare `Widget` with only that flag.
3. Add one `registerWidget` line with the component to `widget-registry.ts`. It needs no cast.
4. Follow [the one hard rule](../../../AGENTS.md#the-one-hard-rule) for the new config type. For a single widget,
   the new upgrade step inserts `defaultConfig()`'s entry with a new `wmId`, as the `< 29` step does for
   `experience-tracker` and the `< 30` step for `library`; without it an existing config has no entry for the type.
   Add the widget to `defaultConfigMock` in `renderer/specs/vitest.setup.ts` only when a test reads its config.
5. A hotkey goes into `shortcutActions()` in `shortcut-actions.ts` as a `ShortcutAction`, such as `trigger-event` with a
   target, as the stopwatch and the Delve grid have. The component handles `MAIN->CLIENT::widget-action` with that
   target.
6. A settings page is a component in the widget's folder, a name in `SettingsPage` and a `case "<type>"` in
   `menuPages()` in `settings/menu.ts`, and an entry in `PAGES` in `settings/SettingsWindow.vue`. Its frame sets
   `inline-edit` to `false`, so "edit" opens that page.
7. Put its UI text in `renderer/public/data/en/app_i18n.json` under the widget's key. A multi widget names its
   menu entry with `trNameKey`.
8. Describe it on a user page in `docs/`, add the page to the sidebar in `docs/.vitepress/config.js`, and add a row
   to the table above.

## Invariants

- **`wmType` is a storage key.** It is renamed or removed only by an upgrade step: the `< 7` step renames
  `map-check` to `item-check`, and the `< 26` step removes `filter-generator` entries.
- **Every single widget has an entry in every config.** Code reads it as `AppConfig("<type>")!`, and
  `shortcutActions()` reads the `price-check`, `item-check`, `library` and `delve-grid` entries without a check.
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

**Tests.** `npx vitest run` in `renderer/`. No test covers the registry, `OverlayWindow.vue` or `Widget.vue`, and
coverage counts only the `.ts` files of `src/` (`coverage.include` in `vitest.config.ts`). Widget logic outside components is tested in
`specs/web/item-check.test.ts` (`hotkeyable-actions.ts`), `specs/web/library/libraryChaos.test.ts`
(`library/widget.ts`), `specs/web/library/session.test.ts` (`library/session.ts`, which keeps a session inactive
until main opens its file), `specs/web/client-log.test.ts` (the player and area levels the XP tracker reads, with
`FullCampaign.txt`, and a line that fails), `specs/web/map-check-marks.test.ts` (the Map check marks in English and
German, before and after a conversion), `specs/web/host-uploads.test.ts` (`Host.importFile()`, which the image strip uses to add an
image), `specs/web/image-import.test.ts` (`overlay/image-import.ts`, which adds the stored image to the strip, or
shows the strip's red message when main does not store it), `specs/web/widget-component.test.ts`
(`overlay/widget-component.ts`, which throws for a component without a `widget` option),
`specs/web/settings/menu.test.ts` (`settings/menu.ts`, the pages the Settings menu lists for each widget),
`specs/web/settings/utils.test.ts` (`settings/utils.ts`: the page props, the field models, `findWidget`, and
`disableWidget` and `enableWidget`, which add `menu::skip` once and remove every copy),
`specs/web/settings/hotkey-conflicts.test.ts` (`settings/hotkey-conflicts.ts`, the hotkeys that two actions
share in the edited config), `specs/web/stash-search.test.ts` (`stash-search/widget.ts`, the search of a new
Stash search widget in three languages) and
`specs/web/host-events.test.ts` (`Host.sendEvent()`, which sends no `OVERLAY->MAIN::` event from a
browser tab, `Host.logs`, which keeps the last 1000 lines of main's log for Settings, Debug and starts again
from the history main sends after a reconnect, `Host.onEvent()`, which passes each message from the fake socket to
the listeners of its name until their controller aborts and passes no `MAIN->OVERLAY::` event in a browser tab,
`Host.updateInfo` and `Host.getConfig()`). In `FullCampaign.txt`, other players' names and all whisper and guild chat text are placeholders.
Overlay focus, hiding on blur and the hotkeys need the game:
[runbooks/in-game-check.md](../runbooks/in-game-check.md).
