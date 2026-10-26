# The preset Stash search widgets search English text

**Status:** done 2026-10-26
**Area:** renderer
**Origin:** [renderer/src/web/stash-search/WidgetStashSearch.vue](../../../../renderer/src/web/stash-search/WidgetStashSearch.vue)
**Verified:** 2026-10-26

`defaultInstances()` in `WidgetStashSearch.vue` gives `defaultConfig()` two Stash search widgets,
`Map rolling` and `Dump sorting`, with ten searches. An entry with a `preset` searches that
preset's game text in the loaded language (`entrySearchText()` in `stash-search/presets.ts`), and
the `< 39` config step names the English defaults of earlier versions by preset
([renderer-widgets.md](../../modules/renderer-widgets.md#stash-search-presets)). So `Currency`,
`"Rarity: Normal"` and `Trials:`, which became `"Number of Trials:"`, follow the language, as
does the first search of a widget added from the menu. The other seven are English text, which
[docs/stash-search.md](../../../stash-search.md) says. The game is assumed to match a search
against the item text in the language it runs in, which
[host task 009](../../host/tasks/009-stash-search.md) checks.

The game export of 25 Oct 2026 in `dataParser/data/vendor/` has this for the other seven:

| Widget | Search text | Game data |
| --- | --- | --- |
| Dump sorting | `"Waystone Tier"` | the client string `ItemDisplayMapTier` |
| Dump sorting | `"Martial Weapon"` | the client string `SoulCoreCategoryWeapons`, `[MartialWeapon\|Martial Weapon]` |
| Dump sorting | `Jewel` | no client string with that text alone; the `ItemClasses` row `Jewel` is named `Jewels`, `Juwelen` in German, and the app's data does not hold item classes |
| Map rolling | `"Increased Pack Size"`, `"Additional Packs"`, `"Less Recovery Rate"` | parts of the Waystone stats `#% increased Pack Size in Map`, the nine `Area contains # additional packs of ...` stats and `Players have #% less Recovery Rate of Life and Energy Shield` in `stats.ndjson`; no client string, and a part of a stat text has no matching part in another language |
| Map rolling | `"Burning Ground"` | none: no stat text in the English `stats.ndjson` contains it, and the Waystone stat is `Area has patches of Ignited Ground` |

The first two need two client strings, which no committed `client_strings.js` has. These are the
lines that `ClientString("WAYSTONE_TIER", ["ItemDisplayMapTier"])` and
`ClientString("MARTIAL_WEAPON", ["SoulCoreCategoryWeapons"])` in
`dataParser/src/constants/client_string_data.py` write into each language's file, as the tool
built them from that export:

| Language | `WAYSTONE_TIER` | `MARTIAL_WEAPON` |
| --- | --- | --- |
| en | `'Waystone Tier'` | `'Martial Weapon'` |
| ru | `'Уровень путевого камня'` | `'Боевое оружие'` |
| cmn-Hant | `'換界石階級'` | `'軍用武器'` |
| ko | `'경로석 등급'` | `'무도 무기'` |
| ja | `'ウェイストーンティア'` | `'マーシャル武器'` |
| de | `'Wegsteinlevel'` | `'Kampfwaffe'` |
| es | `'Grado de la piedra guía'` | `'Arma marcial'` |
| fr | `'Palier de Pierre de téléportation'` | `'Arme martiale'` |
| pt | `'Nível da Pedra-guia'` | `'Arma Marcial'` |

Each line has the form `  WAYSTONE_TIER: 'Waystone Tier',`. As in
[068](068-unidentified-tier-tag.md), the two entries, the two `TranslationDict` keys, the lines in
every committed `client_strings.js` and the presets that read them (two `PRESET_TEXT` rows, two
`ENGLISH_DEFAULTS` rows, a config step that names the saved entries, and test cases) are one
change. `client_string_data.py` is at its count in `scripts/long-files.txt`, so the entries also
raise that count or move to a module of their own.

Done looks like: the maintainer's go-ahead for that data change; a decision on `Jewel` and the four
Map rolling searches, which either get a search with game text, such as one built from a stat's
matcher by a rule, or stay English; and docs/stash-search.md listing the searches that follow the
language.

## History

- 2026-10-21: Found while the first search of a new Stash search widget was moved to the client
  strings. The client strings have no text for most presets, and this clone cannot run `dataParser`.
- 2026-10-25: The data tool stopped writing `WAYSTONE_TIER`, which nothing read. The table now names
  its game client string id instead.
- 2026-10-26: Presets that follow the game language added for the three searches whose game text
  the committed client strings have; an entry the user edits keeps its text. The two client strings
  and their lines were read from the game export, and wait for the maintainer's go-ahead.
- 2026-10-26: Done by fix(data): take two more stash search presets from the game data.
  The two entries wrote the lines in the table above, and the `< 40` step names the saved defaults.
  `Jewel` and the four Map rolling searches stay English, since the game data has no text for
  them, and docs/stash-search.md says so. `"Burning Ground"` matches no stat text:
  [103](103-burning-ground-search.md).
