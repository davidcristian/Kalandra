# ADR-0007: Game text comes from generated game data

**Status:** Accepted (2026-10-27)

## Context

A price check starts from the text the game puts on the clipboard for an item. The main process presses the copy
keys (`Ctrl + C` plus the game's key for advanced item descriptions, `Alt` unless the game config sets another) and
sends the text to the renderer, whose parser in `renderer/src/parser/` turns it into a `ParsedItem`. The text is in
the language the game client runs in, and a game patch can change its lines. The app supports the nine game
languages in `LANGUAGES` in `renderer/src/assets/make-index-files.mjs`: `en`, `ru`, `cmn-Hant`, `ko`, `ja`, `de`,
`es`, `pt` and `fr`. Item text can also come from a client in a language without game data here, such as Thai
(`th`) or Simplified Chinese (`cmn-Hans`).

## Decision

**1. The parser matches item text through the game data, never through English string literals.** It reads fixed
text through `CLIENT_STRINGS` (imported as `_$` in `renderer/src/parser/Parser.ts`), and stat lines through the
matchers in `stats.ndjson` (`STAT_BY_MATCH_STR`). `renderer/src/assets/data/index.ts` sets `CLIENT_STRINGS` from
`client_strings.js` for the selected language, through `loadClientStrings` in
`renderer/src/assets/client-string-loader.ts`. Matching new item text means adding a client string. Reason: the same
parser code then reads all nine languages.

**2. `stats.ndjson`, `items.ndjson` and `client_strings.js` are generated and never edited by hand.** They live in
`renderer/public/data/<lang>/` and are the output of `dataParser/`: `python ./src/main.py --push`, run in
`dataParser/`, copies them into place ([dataParser/README.md](../../../dataParser/README.md)). A fix goes into the
generator or its inputs, followed by a new run. Reason: the next run overwrites a hand edit, and a hand edit in one
language does not reach the other eight.

**3. This copy of `dataParser/` is the only source of the data, and it can be older than the data.** On 22 Oct 2026
the last change to the tool by Kvan7, the author of Exiled Exchange 2, is dated 8 May 2026, and the last data update
is dated 5 Sep 2026. `git log -1 -i --author=kvan7 --format="%ad %an %s" --date=short -- dataParser` shows the first,
and `git log -1 --format="%ad %an %s" --date=short -- renderer/public/data/en/stats.ndjson` the second. When the copy
here cannot produce a fix, the contributor stops and asks the maintainer. Reason: Exiled Exchange 2 developed the tool in a private repo, so the committed data
can come from a newer version of the tool than this copy, and a hand edit is lost at the next run (decision 2).

**4. The `*.index.bin` files are built, not stored.** `npm run make-index-files` in `renderer/` writes
`items-name.index.bin`, `items-ref.index.bin`, `stats-matcher.index.bin` and `stats-ref.index.bin` for each
language, and `.gitignore` ignores `*.bin`. Each file holds the start position of each line in an `.ndjson` file,
keyed by an FNV-1a hash. They must exist before the tests, `npm run dev` or a build, and are written again after a
data change. Reason: they are computed from the `.ndjson` files, so a stored copy would be a second version of the
same data.

**5. Language detection lists the first lines of item text as literals.** `LANGUAGE_DETECTOR` in
`main/src/shortcuts/HostClipboard.ts` holds the first line of copied item text and an uncut gem's rarity line for each
game language, and `isPoeItem()` accepts clipboard text that starts with one of them. `LANGUAGE_DETECTOR` in
`renderer/src/parser/Parser.ts` holds each language's item class line, rarity line and display name, and
`parseNamePlate()` reads it for the wrong language message when the item class line is not the app language's. Both
lists include `th` and `cmn-Hans`. Reason: detection must match item text in a language the app has no game data
for, so that the parser can show its wrong language message, and so the lines cannot come from that data. Main
loads no game data either, and the renderer loads the client strings of English and the selected language only.

## Consequences

- A game patch that changes item text needs a new `dataParser` run and then `npm run make-index-files`
  ([game data update runbook](../runbooks/game-data-update.md)).
- A parser fix adds the real copied item text as a test case under `renderer/specs/Parser/`
  ([AGENTS.md](../../../AGENTS.md), What every change must pass). Item text in tests and fixtures keeps its
  characters exactly as the game writes them.
- Text that the game writes the same in all nine languages can stay a literal, and is listed here. The em dash
  (`"\u2014"`) before the tags of a `{ ... }` modifier line is the same: the game string `AdvancedModDisplayTags`
  is `" \u2014 {0}"` in every language of the export of 26 Oct 2026, so `parseModInfoLine()` splits on it.
- A patch that changes the item class or rarity line of a language, or a new game language, needs both
  `LANGUAGE_DETECTOR` lists edited by hand from that client's copied item text, since no data run updates them.
- Item text from a patch the data does not know yet can fail to match, and the parser must handle that without
  throwing ([AGENTS.md](../../../AGENTS.md), Safety).
- Text the app writes itself is not game data. The UI text is in `renderer/public/data/<lang>/app_i18n.json`, a new
  string goes into the English file first, and `renderer/src/web/i18n.ts` falls back to English for a key a language
  lacks. One setting, `language`, selects both the game data and the UI text (`renderer/src/main.ts`).
  So a language has an `app_i18n.json` only when it has game data and the **Language** list in Settings, General
  offers it.

## Alternatives rejected

- **English regular expressions in the parser.** They match only an English client, and each one is a second place
  to update when a patch changes the text.
- **Detection lines sent from the renderer through `HostConfig`, built from `ITEM_CLASS` and `RARITY`.** Main
  would then drop Thai and Simplified Chinese item text before the parser can show the wrong language message.
- **Committing the index files.** They hold nothing that the `.ndjson` files do not, and a stored copy goes out of
  date at the next data change.

## Related

- [Parser module](../modules/renderer-parser.md): how the parser reads the data.
- [Main module](../modules/main.md): `isPoeItem()` and its `LANGUAGE_DETECTOR` in `HostClipboard.ts`.
- [dataParser module](../modules/dataparser.md): the generator, its inputs and `--push`.
- [Game data update runbook](../runbooks/game-data-update.md).
