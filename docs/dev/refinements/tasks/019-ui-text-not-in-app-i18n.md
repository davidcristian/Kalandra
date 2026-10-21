# UI text that is not in the English app_i18n.json

**Status:** open
**Area:** renderer
**Origin:** [renderer/public/data/en/app_i18n.json](../../../../renderer/public/data/en/app_i18n.json)
**Verified:** 2026-10-21

[AGENTS.md](../../../../AGENTS.md#architecture-rules) says a new UI string goes into
`renderer/public/data/en/app_i18n.json`, and translators work from that file. 20 files in
`renderer/src/web/` pass 43 English texts to `t()` as keys that the English file does not define.
`renderer/src/web/i18n.ts` sets `fallbackFormat: true`, so vue-i18n shows the key itself, which
reads as English. The Russian file defines 18 of the 43 as top-level keys, and no other language
defines any of them. The keys, by folder:

- `settings/`: `Save` and `Cancel` (`SettingsWindow.vue`), `Disabled` (`hotkeys.vue`),
  `Restart required` and `Hotcool` (`general.vue`), `Remove` (`chat.vue`).
- `price-check/`: `Refresh`, `Retry`, `No`, `None`, `Currency / Hour`, `Items / Hour`, `Both` and
  `milliseconds` (`settings-price-check.vue`); `Retry` and `Browser` (`BackgroundInfo.vue`,
  `trade/TradeListing.vue`, `trade/TradeBulk.vue`); `Search` (`CheckedItem.vue`); `You`
  (`trade/TradeBulk.vue`, `trade/TradeItem.vue`); `in demand` and `Gone` (`trade/TradeItem.vue`);
  `Instant or Online`, `Instant`, `Online` and `Offline` (`trade/OnlineFilter.vue`); `Retry Item`,
  `Reload fallback data` and `Loading...` (`fallback/ReloadTradeData.vue`); `min` and `max`
  (`filters/FilterModifier.vue`); `Unable to determine fractured stat` (`filters/FiltersBlock.vue`);
  `Not recognized modifier` (`filters/UnknownModifier.vue`).
- `library/ProfileSettings.vue`: `Recording settings`, `added mods column`, `removed mods column`,
  `keep explicit mods`, `keep implicit mods`, `keep enchant mods`, `keep augment mods`, `show tier`,
  `show roll`, `show ref` and `show type`.
- Other folders: `Not recognized modifier` (`map-check/MapCheck.vue`), `Search`
  (`map-check/settings-maps.vue`), `Select` (`item-search/WidgetItemSearch.vue`), `Add`
  (`stash-search/stash-search-editor.vue`).

`Hotcool` labels the `pc-garena` realm option, which shows only when the language is `cmn-Hant`.
Two strings do not go through `t()` at all: the label `Open base item on Craft of Exile` in
`item-check/settings-item-check.vue`, although `item.open_on_craftofexile` holds the same text, and
`None added` in the `modsDiff` computed of `library/SingleItemSession.vue`.

Done looks like: each string has an entry in the English file, and the two literals use a key. The
English file already maps some texts to themselves, such as `seconds`, so adding each text as a
top-level key keeps the code and the Russian entries working. The `Hotcool` label needs the realm's
name from the maintainer, in English and in `cmn-Hant`. `renderer/specs/web/i18n-keys.test.ts` lists
the 43 keys and fails when one of them gets an English entry, so remove each one there as it does.

## History

- 2026-10-18: Found while docs/settings.md and docs/item-data.md were written, by checking each
  label the settings pages show against the English `app_i18n.json`. The same day the list was
  extended to every literal `t()` key in `renderer/src/` that the English file does not define.
- 2026-10-20: A test now checks every literal `t()` key in `renderer/src/` against the English file
  and lists these 42 as missing. The list above still matches the code.
- 2026-10-21: Added `Offline`, which `OnlineFilter.vue` passes to `t()` through a conditional that the
  literal scan does not read. The same test now checks that each key of a translation is an English key
  or one of these 43.
