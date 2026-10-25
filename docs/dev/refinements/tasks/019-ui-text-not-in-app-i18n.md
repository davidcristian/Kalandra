# UI text that is not in the English app_i18n.json

**Status:** open
**Area:** renderer
**Origin:** [renderer/public/data/en/app_i18n.json](../../../../renderer/public/data/en/app_i18n.json)
**Verified:** 2026-10-25

[AGENTS.md](../../../../AGENTS.md#architecture-rules) says a new UI string goes into
`renderer/public/data/en/app_i18n.json`, and translators work from that file.
`renderer/src/web/settings/general.vue` passes `Hotcool` to `t()` as the label of the `pc-garena`
realm option, which shows only when the language is `cmn-Hant`, and no language file defines it.
`renderer/src/web/i18n.ts` sets `fallbackFormat: true`, so vue-i18n shows the key itself.

Done looks like: the maintainer gives the realm's name in English and in `cmn-Hant`, both files
define it, and `Hotcool` leaves `LISTED_MISSING` in `renderer/specs/web/i18n-keys.test.ts`, which
fails when the English file defines a key that the list still names.

## History

- 2026-10-18: Found while docs/settings.md and docs/item-data.md were written, by checking each
  label the settings pages show against the English `app_i18n.json`. The same day the list was
  extended to every literal `t()` key in `renderer/src/` that the English file does not define.
- 2026-10-20: A test now checks every literal `t()` key in `renderer/src/` against the English file
  and lists these 42 as missing. The list above still matches the code.
- 2026-10-21: Added `Offline`, which `OnlineFilter.vue` passes to `t()` through a conditional that the
  literal scan does not read. The same test now checks that each key of a translation is an English key
  or one of these 43.
- 2026-10-22: Removed the six `ProfileSettings.vue` keys that only commented-out checkboxes passed
  to `t()`, since the checkboxes were deleted. 37 keys remain.
- 2026-10-22: `PLANNED` in `renderer/specs/web/i18n-keys.test.ts` keeps `item.open_on_craftofexile`
  for the label in `settings-item-check.vue`. The test fails when code reads the key, so the commit
  that adds it to the label removes it from that list.
- 2026-10-25: The English file now defines 36 of the 37 texts as top-level keys that map to
  themselves, which keeps the Russian entries working. The Craft of Exile label reads
  `item.open_on_craftofexile`, and `None added` reads `library.none_added`. Only `Hotcool` remains,
  since it needs the realm's name from the maintainer.
