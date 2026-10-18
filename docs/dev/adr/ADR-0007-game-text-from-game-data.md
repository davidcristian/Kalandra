# ADR-0007: Game text comes from generated game data

**Status:** Accepted (2026-10-18)

## Context

A price check starts from the text the game puts on the clipboard for an item. The main process presses the copy
keys (`Ctrl + C` plus the game's key for advanced item descriptions, `Alt` unless the game config sets another) and
sends the text to the renderer, whose parser in `renderer/src/parser/` turns it into a `ParsedItem`. The text is in
the language the game client runs in, and a game patch can change its lines. The app supports the nine game
languages in `LANGUAGES` in `renderer/src/assets/make-index-files.mjs`: `en`, `ru`, `cmn-Hant`, `ko`, `ja`, `de`,
`es`, `pt` and `fr`.

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

**3. This copy of `dataParser/` is the only source of the data, and it can be older than the data.** On 18 Oct 2026
the last change to the tool before the rename commit is dated 8 May 2026, and the last data update is dated
5 Sep 2026. `git log -2 --format="%ad %an %s" --date=short -- dataParser`, and the same command for
`renderer/public/data/en/stats.ndjson`, show both again. When the copy here cannot produce a fix, the contributor
stops and asks the maintainer. Reason: Exiled Exchange 2 developed the tool in a private repo, so the committed data
can come from a newer version of the tool than this copy, and a hand edit is lost at the next run (decision 2).

**4. The `*.index.bin` files are built, not stored.** `npm run make-index-files` in `renderer/` writes
`items-name.index.bin`, `items-ref.index.bin`, `stats-matcher.index.bin` and `stats-ref.index.bin` for each
language, and `.gitignore` ignores `*.bin`. Each file holds the start position of each line in an `.ndjson` file,
keyed by an FNV-1a hash. They must exist before the tests, `npm run dev` or a build, and are written again after a
data change. Reason: they are computed from the `.ndjson` files, so a stored copy would be a second version of the
same data.

## Consequences

- A game patch that changes item text needs a new `dataParser` run and then `npm run make-index-files`
  ([game data update runbook](../runbooks/game-data-update.md)).
- A parser fix adds the real copied item text as a test case under `renderer/specs/Parser/`
  ([AGENTS.md](../../../AGENTS.md), What every change must pass). Item text in tests and fixtures keeps its
  characters exactly as the game writes them.
- Item text from a patch the data does not know yet can fail to match, and the parser must handle that without
  throwing ([AGENTS.md](../../../AGENTS.md), Safety).
- Text the app writes itself is not game data. The UI text is in `renderer/public/data/<lang>/app_i18n.json`, a new
  string goes into the English file first, and `renderer/src/web/i18n.ts` falls back to English for a key a language
  lacks. One setting, `language`, selects both the game data and the UI text (`renderer/src/main.ts`).
  `renderer/public/data/th/` has only an `app_i18n.json`, and the **Language** list in Settings, General does not
  offer Thai.

## Alternatives rejected

- **English regular expressions in the parser.** They match only an English client, and each one is a second place
  to update when a patch changes the text.
- **Committing the index files.** They hold nothing that the `.ndjson` files do not, and a stored copy goes out of
  date at the next data change.

## Related

- [Parser module](../modules/renderer-parser.md): how the parser reads the data.
- [dataParser module](../modules/dataparser.md): the generator, its inputs and `--push`.
- [Game data update runbook](../runbooks/game-data-update.md).
