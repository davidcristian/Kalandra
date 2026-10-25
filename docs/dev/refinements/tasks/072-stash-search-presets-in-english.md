# The preset Stash search widgets search English text

**Status:** open
**Area:** renderer
**Origin:** [renderer/src/web/stash-search/WidgetStashSearch.vue](../../../../renderer/src/web/stash-search/WidgetStashSearch.vue)
**Verified:** 2026-10-21

`defaultInstances()` in `WidgetStashSearch.vue` gives `defaultConfig()` two Stash search widgets,
`Map rolling` and `Dump sorting`, with ten English search texts. The game is assumed to match a
search against the item text in the language it runs in, which
[host task 009](../../host/tasks/009-stash-search.md) checks, so these searches would find nothing
with the game in another language. [docs/stash-search.md](../../../stash-search.md) says the
presets are English. A widget added from the menu already starts with `RARITY_CURRENCY` from the client strings
(`newWidgetEntries()` in `stash-search/widget.ts`).

Presets in the game's language are not possible yet, for two reasons:

- `defaultConfig()` runs at the first start with `language: "en"`, before the user picks a language
  in Settings, General, and only one language's data is loaded at a time. So a preset in another
  language needs a step that runs when the language changes, and that step must not change a search
  the user saved ([ADR-0003](../../adr/ADR-0003-config-survives-updates.md)). Whether it replaces
  presets the user never edited is the maintainer's decision.
- Only some of the texts have a client string in `client_strings.js`:

| Widget | Search text | Game data |
| --- | --- | --- |
| Dump sorting | `Currency` | `RARITY_CURRENCY` |
| Dump sorting | `"Rarity: Normal"` | `RARITY` followed by `RARITY_NORMAL` |
| Dump sorting | `"Waystone Tier"` | the game's client string `ItemDisplayMapTier`, which the data tool no longer writes as `WAYSTONE_TIER` |
| Dump sorting | `Trials:` | the end of `TRIAL_COUNT` (`Number of Trials: `), a cut that does not work in another language's word order |
| Dump sorting | `"Martial Weapon"`, `Jewel` | none; the game file they would come from is not known |
| Map rolling | `"Increased Pack Size"`, `"Additional Packs"`, `"Less Recovery Rate"` | parts of Waystone modifier texts in `stats.ndjson`, such as `#% increased Pack Size`, `Area contains # additional packs of Beasts` and `Players have #% less Recovery Rate of Life and Energy Shield`; no client string, and a part of a stat text has no matching part in another language |
| Map rolling | `"Burning Ground"` | none; no stat text in the English `stats.ndjson` contains it, which has `Area has patches of Ignited Ground` |

Done looks like: the maintainer decides how the presets follow the language; each preset either has
a client string, added to `dataParser/src/constants/client_string_data.py` and written by a data
update with the maintainer's go-ahead ([runbooks/game-data-update.md](../../runbooks/game-data-update.md)),
or is replaced by a text that has one; a test reads the presets in English and in another language;
the note in docs/stash-search.md changes. A change to `defaultConfig()` follows the hard rule in
[AGENTS.md](../../../../AGENTS.md#the-one-hard-rule).

## History

- 2026-10-21: Found while the first search of a new Stash search widget was moved to the client
  strings. The client strings have no text for most presets, and this clone cannot run `dataParser`.
- 2026-10-25: The data tool stopped writing `WAYSTONE_TIER`, which nothing read. The table now names
  its game client string id instead.
