# renderer/src/parser: item text to `ParsedItem`

**Purpose.** The parser turns the item text that the game puts on the clipboard into a `ParsedItem`, the typed
record that the price check, item check and library widgets read and that the item search widget builds. Item text
is the block of lines the game copies for an item, split into sections by lines of `--------`. The main process
makes the game copy it by pressing Ctrl + C together with the game's key for advanced item descriptions
(`show_advanced_item_descriptions` in the game config, `Alt` when unset), so each modifier comes with a `{ ... }`
line that names its type, tier and tags ([main.md](main.md)). The parser sends no request. It reads the game
data that [renderer/src/assets/data/](../../../renderer/src/assets/data/index.ts) loads, which the second half of
this doc describes.

## Public contract

[renderer/src/parser/index.ts](../../../renderer/src/parser/index.ts) exports `parseClipboard`, the `ParsedItem`
type, `ItemRarity`, `ItemInfluence`, `itemIsModifiable` and `ItemCategory`. Code outside the parser, mostly the
price check, also imports `@/parser/<file>` directly for `ParsedItem`, `Parser`, `meta`, `modifiers`,
`advanced-mod-desc`, `stat-translations`, `calc-base`, `calc-q20` and `augment-builder`. `Parser.ts` exports
`parseAffixStrings`, `getMaxSockets` and `replaceHashWithValues` for that use.

- `parseClipboard(clipboard)` returns a neverthrow `Result<ParsedItem, string>`. It splits the text into sections,
  checks that the first one starts with the item class line, reads rarity, name and base type from it
  (`parseNamePlate`), then runs the `parsers` list in [Parser.ts](../../../renderer/src/parser/Parser.ts) in
  order. A section parser returns `SECTION_PARSED` (the section is removed from the list), `SECTION_SKIPPED` (try
  the next section) or `PARSER_SKIPPED` (stop this parser). Each section is parsed by at most one parser and each
  parser parses at most one section. An entry `{ virtual: fn }` runs once on the item without a section and can
  end the parse with an error.
- The error is an i18n key: `item.parse_error`, `item.unknown` (no record in the item data or the trade data
  matches), or `item.wrong_language|<game language>|<app language>` with display names such as `English`. The
  price check shows the text of the key and of the key plus `_help` from
  `app_i18n.json` ("An error occurred while parsing the item", "Unknown Item", "POE2 language doesn't match
  Kalandra"). The callers are `PriceCheckWindow.vue`, `item-check/WidgetItemCheck.vue`,
  `item-check/hotkeyable-actions.ts` and `library/SingleItemSession.vue`.
- `ParsedItem` ([ParsedItem.ts](../../../renderer/src/parser/ParsedItem.ts)) holds the item's properties
  (`rarity`, `category`, `itemLevel`, armour and weapon values, `quality`, `augmentSockets`, `requires` and
  others), `info`, the matched `BaseType` record from `items.ndjson` (or one built from the trade site's item list
  when `items.ndjson` has none), and `rawText`, the copied text. A unique whose base type `items.ndjson` does not
  have gets the category `Unknown`, and the parser logs the base type. `newMods` is every modifier as a
  `ParsedModifier`: its `ModifierInfo` (type, generation such as prefix or suffix, name, tier, tags) and its
  `ParsedStat` list. `statsByType` is the same stats grouped by stat and modifier type, each with the modifiers
  it comes from (`sumStatsByModType`).
  `unknownModifiers` is every line that matched no stat; the filters block shows them as "Not recognized
  modifier". `createVirtualItem(props)` builds a `ParsedItem` whose `rawText` is `VIRTUAL_ITEM`, which the item
  search widget sends to the price check.

The other files, each called from `Parser.ts` or from the price check:

| File | What it does |
| --- | --- |
| `advanced-mod-desc.ts` | `parseModInfoLine` reads one `{ ... }` line, `groupLinesByMod` pairs it with its stat lines, `parseModType` reads a suffix such as ` (implicit)`, ` (enchant)` or ` (rune)` |
| `stat-translations.ts` | `linesToStatStrings` joins lines into candidate stat texts and skips reminder text in parentheses; `tryParseTranslation` replaces numbers with `#`, finds the stats with that text through `STAT_BY_MATCH_STR`, picks one with `statMatchForLine`, and falls back to the trade site's stat text, which for a rune line must have a `rune` id. That text is English in every app language, so the fallback matches only English item text ([refinement 063](../refinements/tasks/063-trade-lists-english-only.md)) |
| `modifiers.ts` | `ModifierType`, `StatCalculated`, `sumStatsByModType`, `translateStatWithRoll` |
| `magic-name.ts` | `magicBasetype` finds the base type in a magic item name by trying every run of words against the item data |
| `match-records.ts` | `recordsMatchingItem` keeps the records of an item lookup that match the copied item: a unique by its base type, and base types that share a translated name by the armour, evasion and energy shield lines the item shows. `findInDatabase` in `Parser.ts` takes the first record it keeps, or the first of all when none matches ([refinement 059](../refinements/tasks/059-shared-translated-item-names.md)) |
| `match-stats.ts` | `statMatchForLine` picks the stat of a line among the stats that share its text: one that `statFitsModifier` accepts for the modifier type (it has a trade id of the type, or grants a skill), then one with no other advanced text, because the app copies items with advanced descriptions, else the first in the data ([refinement 064](../refinements/tasks/064-shared-stat-texts.md)) |
| `meta.ts` | `ItemCategory` and the category sets `WEAPON`, `ARMOUR`, `GEM` and others. `ItemCategory` has a member for each `craftable.category` of the item data, and `specs/data/item-categories.test.ts` checks that, and that each other member is listed there with its reason |
| `jewellery-quality.ts` | `parseJewelleryQuality` reads the quality line of a ring, amulet, belt or jewel, such as `Quality (Attribute Modifiers): +20% (augmented)`, into `quality`, and sets `qualityType` to the catalyst whose modifier tag in `CATALYST_TO_TAG` the line names. The item editor and the stat filters read `qualityType` |
| `calc-q20.ts`, `calc-base.ts` | armour and weapon values at 20% quality, the base value without modifiers, and the base percentile; `recalculateItemProperties` is called by the item editor in the price check |
| `augment-builder.ts` | `buildEditorItems` turns rune and soul core records into item editor entries with the effect for the item's category. Each effect line takes its numbers from its own `values` array, because the data scales a number, such as Life regeneration per minute to per second, only for the line that shows it; `getSavedAugments` reads the augments saved per item category in the price check's `savedAugments` setting; `useAugment` puts an entry in a socket and recomputes the item's stats and properties, for the item editor and for the saved augments |
| `utils.ts` | `combinations` and `avg`, used by `Parser.ts` |
| `settings.ts` | `parserSettings` returns the user settings the parser reads, the language and the saved augments, from the object the app passes to `setParserSettings` |

A module exports the internal functions its tests call as `__testExports` (`Parser.ts` and
`stat-translations.ts`).

## The game data

[renderer/src/assets/data/index.ts](../../../renderer/src/assets/data/index.ts) loads the files under
`renderer/public/data/` over HTTP from the page's own server and exposes them as module variables. It and
`web/i18n.ts` fetch each file with `fetchData(file)` from `fetch-data.ts`, which throws a `DataLoadError` with the
file and the status when the server does not return it, so a missing index file fails the load.
`loadLang(lang)` in `web/i18n.ts` also sets luxon's `Settings.defaultLocale` to the BCP 47 tag of the language, so
relative times such as the listing ages are written in it. It empties the messages of the language it leaves, and a
file that does not load leaves the language as it was. `specs/web/i18n-loader.test.ts` checks this, the English text
for a key a language lacks, and the `:` keys of `useI18nNs(name)`, which read `name.key`.

- `init(lang)` runs once from `renderer/src/main.ts`. It loads `CLIENT_STRINGS_REF` (the English client strings),
  `item-drop.json` and `patrons.json`, then calls `loadForLang(lang)`. A change to the language setting calls
  `loadForLang` again. `specs/data/patrons.test.ts` checks that each `patrons.json` row has a name used once, a
  whole number of months and a `style` from 1 to 5, the tiers the Settings window shows.
- `loadForLang(lang)` loads `CLIENT_STRINGS` from `data/<lang>/client_strings.js` (through
  `client-string-loader.ts`), the items and the stats, builds the rune, soul core and catalyst lookups
  (`loadUltraLateItems`), and loads the trade site's item and stat lists through `useTradeData()` in
  `web/background/TradeData.ts`. After the lookups it calls `markItemDataLoaded()` from `loads.ts`. The module
  variables are not reactive, so code that builds lists from them uses `cachePerDataLoad(build)` from `loads.ts`:
  it builds each key's value once per load, and a computed that calls it runs again after the next load.
- Lookups: `ITEM_BY_REF(namespace, refName)` and `ITEM_BY_TRANSLATED(namespace, name)` return `BaseType[]`, where
  the namespace is `ITEM`, `GEM`, `UNIQUE`, `DIVINATION_CARD` or `CAPTURED_BEAST`; `STAT_BY_REF(ref)` returns the
  `Stat` with that ref or `undefined`; `STAT_BY_MATCH_STR(text)` returns every `Stat` with a `StatMatcher` whose
  text or advanced text is exactly `text`, each with that matcher, in file order;
  `ITEMS_ITERATOR` and `STATS_ITERATOR` scan the raw text for a substring. `TRADE_ITEM_BY_REF`,
  `TRADE_STAT_BY_MATCH_STR` and `TRADE_STAT_BY_STAT_ID` read the trade site lists, for items and stats that the
  game data does not have yet. Both lists come from `www.pathofexile.com` in every app language, so their texts
  are English, and `TRADE_ITEM_BY_REF` and `TRADE_STAT_BY_MATCH_STR` find only the names and stats of an English
  item.
- `stat(text)` records a stat ref that code depends on. After loading, `init` passes `Cannot find stats: ` and then
  the recorded refs that `stats.ndjson` does not contain, one per line, to `console.warn` (`stat:` for one).

The files, per language under `renderer/public/data/<lang>/`:

| File | Content | Written by |
| --- | --- | --- |
| `client_strings.js` | the `TranslationDict` (type in `interfaces.ts`): every game string and regular expression the parser matches | `dataParser` |
| `items.ndjson` | one `BaseType` JSON object per line | `dataParser` |
| `stats.ndjson` | one `Stat` per line: its `ref`, its matchers (the stat texts with `#` for each number) and its trade ids by modifier type, or `null` for a stat without any | `dataParser` |
| `*.index.bin` | sorted pairs of a 32-bit FNV-1a hash and the start of a line in the `.ndjson` file, as a JavaScript string index | `npm run make-index-files` |
| `app_i18n.json` | the UI text, not game text; `en` is the source and a missing key falls back to English ([AGENTS.md](../../../AGENTS.md)). A translation has the placeholders, such as `{0}`, of the English text, which `specs/web/i18n-placeholders.test.ts` checks. `specs/web/i18n-keys.test.ts` checks that the English file defines each literal key that `src/` passes to `t()` and each key of a translation, apart from those [task 019](../refinements/tasks/019-ui-text-not-in-app-i18n.md) lists. It also checks that `src/` names each English key in a quoted string or builds it from a key prefix the test lists, apart from two keys kept for tasks 016 and 019. `specs/web/i18n-syntax.test.ts` checks that each file holds only texts and groups of texts, and that vue-i18n compiles each text, since `t()` throws on a syntax error such as an unclosed `{` | by hand |

A lookup hashes its key with `@sindresorhus/fnv1a`, binary searches the index file, and parses the line that
starts there. The item index files have one row per namespace and `refName`, so items that share a translated name
have rows with the same hash. An item lookup reads the line of each such row (`lineStartsByHash` in `hash-index.ts`)
in file order, and after each line the following lines with the same namespace and name while each record has a
`unique` or `disc` (variant) field. It returns every item with the name and every variant of each, and `undefined`
when no line it reads has the name, as for a key whose hash only another item's key has.
The stats matcher index has one row per matcher text, so stats that share a text have rows with the same hash.
`STAT_BY_MATCH_STR` (`statsByMatcherText` in `stats-by-matcher.ts`) reads the line of each such row once, in file
order, and keeps each stat with a matcher whose text is exactly the key, which skips a row for another text with the
same hash.
The stats ref index has one row per stat. `STAT_BY_REF` (`statByRef` in `stat-by-ref.ts`) reads the line of each
row with the key's hash in file order and returns the first stat whose `ref` is the key, or `undefined`.
[make-index-files.mjs](../../../renderer/src/assets/make-index-files.mjs) writes `stats-ref`,
`stats-matcher`, `items-name` and `items-ref` for each language in its `LANGUAGES` list: `en`, `ru`, `cmn-Hant`,
`ko`, `ja`, `de`, `es`, `pt` and `fr`, the same nine as the `language` setting in `Config.ts`.
It exits with code 1 and names the file and line of an `items.ndjson` record without `refName`, which the item
indexes need; `specs/data/make-index-files.test.ts` runs it on temporary files.
`renderer/public/data/th/` has only `app_i18n.json`.

## Invariants

- **Game text is matched through the game data**, never through an English literal (AGENTS.md, and the reasons
  in [ADR-0007](../adr/ADR-0007-game-text-from-game-data.md)). A new stat comes from `stats.ndjson`. Matching a
  new item text line that is not a stat needs a new key in `TranslationDict` in `assets/data/interfaces.ts` and a
  new entry in `dataParser/src/constants/client_string_data.py`, then a `dataParser` run that writes it into
  every language's `client_strings.js` ([dataparser.md](dataparser.md),
  [runbooks/game-data-update.md](../runbooks/game-data-update.md)). The literals that match item text directly
  include the modifier suffix constants and separators in `advanced-mod-desc.ts`, the damage separator and the
  socket letter in `Parser.ts` ([refinement 074](../refinements/tasks/074-parser-separators-and-suffixes.md)), and
  the `LANGUAGE_DETECTOR` table in `Parser.ts`. That table lists each language's item class and rarity prefix.
  When the first line is not the app language's item class line and the next line starts with a rarity prefix
  from the table, the parse returns `item.wrong_language` with the display name of that prefix's language.
  Otherwise it passes the lines to `console.warn` and returns `item.parse_error`.
- **The generated files are regenerated, never edited**: `client_strings.js`, `items.ndjson` and `stats.ndjson`
  come from `dataParser`, and the `*.index.bin` files from `npm run make-index-files`. Git ignores `*.bin`, so the
  index files must be written before the tests, `npm run dev` or a build, and again after any data change.
- **Item text is untrusted.** `parseClipboard` runs inside a `try`, passes what it caught to `console.error` and
  returns `item.parse_error`, so an error thrown by a parser function never leaves it. A line that matches no stat
  goes to `unknownModifiers` and the parse continues. A new parser returns `SECTION_SKIPPED` for a section that is
  not its own instead of throwing. A requirements line that `REQUIRES_LINE` does not match is logged with
  `console.warn` and leaves `requires` unset. A `{ ... }` line that `MODIFIER_LINE` or `MODIFIER_INCREASED` does not
  match is logged the same way, and the modifier keeps its type and tags without the parts that did not match.
- **The order of `parsers` sets the result.** A section goes to the first parser in the list that accepts it.
  `parseModifiers` is listed five times, one per modifier section as its comments name them (enchant, augment,
  implicit, granted skill, explicit), and `parseLogbookArea` three times. Adding or moving an entry changes which
  parser reads which section, so the change comes with parser cases for the item kinds it affects.
- **`Parser.ts` is 2101 lines** (2026-10-22, `wc -l renderer/src/parser/Parser.ts`). New, separable code goes in
  a new file under `renderer/src/parser/` and is called from it (AGENTS.md, rule 6).

**Dependencies.** neverthrow for `Result`, `@sindresorhus/fnv1a` for the index hash, and the game data from
[dataparser.md](dataparser.md). The parser imports no module under `src/web/`. It reads two settings of the config
([config.md](config.md)) through `parserSettings()` in `settings.ts`: the language in `Parser.ts` and `magic-name.ts`,
and the price check's `savedAugments` in `augment-builder.ts`. At start, `connectParserSettings()` in
`web/parser-settings.ts` makes both read the current config at each use, and `parserSettings()` throws before that.
The data loader imports from the parser only `meta.ts` and `ParsedItem.ts`, which import no other parser file at
runtime. It reads the trade site lists through the proxy with `useTradeData()` from `web/background/TradeData.ts`
([renderer-price-check.md](renderer-price-check.md), [080](../refinements/tasks/080-data-loader-imports-trade-data.md)).

**Tests.** `npx vitest run` in `renderer/`, after `npm run make-index-files`. CI adds `--coverage`, which fails below
the floor in `renderer/vitest.config.ts` (71.9% of the lines of the `.ts` files in `src/` on 25 Oct 2026). The parser
suites are `renderer/specs/Parser/*.test.ts`, with real copied item text in `specs/Parser/items.ts` (each `TestItem`
has the text and the expected fields) and `specs/Parser/mods.ts`. `specs/Parser/whole-item.test.ts` parses whole
items, such as fractured, unidentified and corrupted ones, and compares their properties, modifier counts and runes
with their `TestItem`. The suites in `specs/data/` cover the loader and its lookups, and
`specs/data/fetchData.test.ts` a data file that the server does not return.
[specs/vitest.setup.ts](../../../renderer/specs/vitest.setup.ts) is the Vitest setup file. It replaces `@/web/Config`
with a mock config, connects the parser settings to it, and replaces `Host` with a mock whose `proxy` returns the
trade site's `data/stats` and `data/items` responses from `specs/data/stats.json` and `specs/data/items.json`, so no
test reaches the trade site. A suite calls its `setupTests()`, which fills the mock config from `defaultConfigMock`
and makes `fetch` read files from `renderer/public/`. `vitest.config.ts` adds the Vue plugin, so a test can import
a `.vue` component, and keeps a template URL such as `/images/divine.png` a string. A parser fix adds the copied
item text as a case (AGENTS.md, rule 5).
