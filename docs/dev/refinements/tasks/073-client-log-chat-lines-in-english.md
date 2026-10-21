# The client log parser matches most chat lines with English text

**Status:** open
**Area:** data
**Origin:** [renderer/src/web/client-log/client-log-parser.ts](../../../../renderer/src/web/client-log/client-log-parser.ts)
**Verified:** 2026-10-21

`parseLogVersion0()` in `client-log-parser.ts` matches the level up line of `Client.txt` through
the client string `LOG_LEVEL_UP`, which `dataParser` builds from the game string
`HUDContactCharacterLevelChanged` and which differs in each language. Every other chat line, the
lines that start with `: ` and the NPC lines, matches an English literal, and no `client_strings.js`
of the nine languages has a text for any of them:

| Entry type | Code | English text |
| --- | --- | --- |
| `afk` | `AFK_MODE_ON`, `AFK_MODE_OFF` | `AFK mode is now ON. Autoreply "This player is AFK."` and `AFK mode is now OFF.` |
| `permanent-bonus` | `PERMANENT_BONUS_REGEX` | `<name> has received <bonus>` |
| `skill-point` | `SKILL_POINT_REGEX` | `You have received <count> <type> Skill Points.`, with `a` or `an` as the count of one |
| `skill-point` | the `switch` on `point_type` | the types `Passive`, `Weapon Set Passive`, `Atlas`, `Map Boss Atlas`, `Arbiter Boss Atlas`, `Abyss Atlas`, `Ritual Atlas`, `Delirium Atlas`, `Expedition Atlas` and `Breach Atlas` |
| `player-death` | `SLAIN_REGEX` | `<name> has been slain.` |
| `npc` | `KNOWN_NPC_NAMES` | the speakers `Renly`, `Ghostly Voice`, `The Rust King`, `Beira of the Rotten Pack`, `The Bloated Miller`, `Mortimer` and `Wounded Man` |

The chat texts would come from the same game table of client strings as
`HUDContactCharacterLevelChanged`; their ids are not known here. The NPC names would come from the
game's NPC table, which `dataParser` does not read today. The level up text differs in each
language file, so the other chat lines probably differ too, but nobody has checked:
[host task 015](../../host/tasks/015-other-game-languages.md) asks it. The debug lines
(`Game Start`, `Gained focus`, `Lost focus`, `User agent: PoE poe2_production/tags/`, the
`LOG_ZONE_GEN` zone line, `Successfully allocated passive skill id` and `Set Source`) are assumed to
be English in every client, and `LOG_ZONE_GEN` is a fixed English pattern in every language file.

Done looks like: `dataParser/src/constants/client_string_data.py` has an entry for each chat text
and point type, `TranslationDict` in `renderer/src/assets/data/interfaces.ts` declares them, and a
data update writes them into every language's `client_strings.js` with the maintainer's go-ahead
([runbooks/game-data-update.md](../../runbooks/game-data-update.md)). `parseLogVersion0()` then
matches through `CLIENT_STRINGS`, `specs/web/client-log.test.ts` reads each type from real
`Client.txt` lines in English and in another language, and the sentence in
[docs/client-log-parser.md](../../../client-log-parser.md) that says the other types match in
English changes. [Refinement 024](024-player-death-char-name.md) fixes the text the slain match
runs on, which is a different defect.

## History

- 2026-10-21: Found by comparing each match in `client-log-parser.ts` with the keys of every
  language's `client_strings.js`. This clone has no game export to add the strings from.
