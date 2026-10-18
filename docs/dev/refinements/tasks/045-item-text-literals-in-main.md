# main recognizes copied item text with string literals

**Status:** open
**Area:** rules
**Origin:** [main/src/shortcuts/HostClipboard.ts](../../../../main/src/shortcuts/HostClipboard.ts)
**Verified:** 2026-10-18

The game text rule in [AGENTS.md](../../../../AGENTS.md#architecture-rules) says game text comes
from the game data, never from string literals. `isPoeItem()` in `HostClipboard.ts` checks whether
the clipboard text starts with a line from `LANGUAGE_DETECTOR`, a list of literals. Each entry holds
the first line of copied item text (`Item Class: ` and its translations) and the rarity line of an
uncut gem, for one game language. Main loads no game data: no file in `main/src/` reads
`client_strings.js`, `stats.ndjson` or `items.ndjson`.

The list has entries for `th` and `cmn-Hans`, two languages that `LANGUAGES` in
`renderer/src/assets/make-index-files.mjs` does not include and that have no `client_strings.js`.
The parser has a second `LANGUAGE_DETECTOR` with the same kind of literals
([026](026-wrong-language-message.md)).

Done looks like: a decision for the maintainer. Either the exception for language detection is
written into AGENTS.md and [ADR-0007](../../adr/ADR-0007-game-text-from-game-data.md), or the
renderer sends these lines to main through `HostConfig`, built from `ITEM_CLASS` and `RARITY` in
`client_strings.js`. In the second case the renderer sends the lines of all nine languages, so
that main still passes text from a client in another language to the parser's wrong language
message. Main then no longer passes on item text that starts with the Thai or Simplified Chinese
item class line, since neither language has a `client_strings.js`.

## History

- 2026-10-18: Found while the main module doc and ADR-0007 were written.
