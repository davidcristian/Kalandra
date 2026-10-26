# The client log parser matches most chat lines with English text

**Status:** open
**Area:** data
**Origin:** [renderer/src/web/client-log/client-log-parser.ts](../../../../renderer/src/web/client-log/client-log-parser.ts)
**Verified:** 2026-10-26

`parseClientLogText()` in `client-log-parser.ts` matches the level up line of `Client.txt` through
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

The game export of 2026-10-26 in `dataParser/data/vendor/tables/<Language>/` has these texts in
all nine languages, and each differs by language, so a client in another language writes these
lines in its own language:

| Entry type | Game text | English text |
| --- | --- | --- |
| `skill-point` | `ClientStrings` rows `ReceivedAtlasPassivePoint<T>1` and `ReceivedAtlasPassivePoint<T>N`, where `<T>` is empty or one of `Breach`, `Expedition`, `Delirium`, `Ritual`, `Boss`, `Abyss`, `Incursion` and `PinnacleBoss` | `You have received an Atlas Skill Point.`, `You have received {0} Breach Atlas Skill Points.` |
| `afk` | `ClientStrings` row `DefaultAFKMessage` | `This player is AFK.`, the autoreply inside the AFK on line |
| `npc` | `Name` of the `NPCs.json` rows `Metadata/NPC/Four_Act1/Renly`, `Metadata/Monsters/Four_Act1/RustKingObject`, `Metadata/Monsters/Four_Act1/RustKing`, `Metadata/Monsters/Hags/UrchinHagBoss`, `Metadata/Monsters/SwollenMiller/SwollenMillerBoss`, `Metadata/NPC/Four_Act1/DogTrader` and `Metadata/Terrain/Gallows/Act1/1_1/Objects/TutorialNPCZombie` | the seven speakers in the table above, in that order |

No table of the export has the rest of the AFK lines, the `has received` and `has been slain`
lines, or the `Passive` and `Weapon Set Passive` skill point lines. The `Incursion` rows write
`Temple Atlas`, a type that the `switch` on `point_type` does not list, so such a line is written
as a `passive` point; no real `Client.txt` line with it is in the repo for a test. `dataParser`
reads no `NPCs.json` today: `GAME_API_TABLES_TYPE` in `dataParser/src/constants/filenames.py` does
not list it. The debug lines (`Game Start`, `Gained focus`, `Lost focus`,
`User agent: PoE poe2_production/tags/`, the `LOG_ZONE_GEN` zone line,
`Successfully allocated passive skill id` and `Set Source`) are assumed to be English in every
client, and `LOG_ZONE_GEN` is a fixed English pattern in every language file.

What remains:

1. With the maintainer's go-ahead for a data update
   ([runbooks/game-data-update.md](../../runbooks/game-data-update.md)),
   `dataParser/src/constants/client_string_data.py` gets an entry for each text in the table
   above, `TranslationDict` in `renderer/src/assets/data/interfaces.ts` declares each key, and the
   update adds one line per key to every language's `client_strings.js`: a regular expression for
   each of the nine Atlas point types that matches both its rows, the autoreply text, and an array
   of the seven NPC names. The keys and the lines go in one commit, because the tool's tests require
   every key it writes to be a `TranslationDict` key. `parseClientLogText()` then matches through
   `CLIENT_STRINGS`, with a `temple` point type in `SkillPointEvent` in `ipc/types.ts`.
2. [Host task 015](../../host/tasks/015-other-game-languages.md) records real `Client.txt` lines of
   each type from a client in another language, and of a `Temple Atlas` point in English. They
   become cases in `specs/web/client-log.test.ts`, and they show the text of the lines that no
   table has. The sentence in [docs/client-log-parser.md](../../../client-log-parser.md) that says
   the other types match in English then changes.

[Refinement 024](024-player-death-char-name.md) fixes the text the slain match runs on, which is a
different defect.

## History

- 2026-10-21: Found by comparing each match in `client-log-parser.ts` with the keys of every
  language's `client_strings.js`. This clone has no game export to add the strings from.
- 2026-10-26: Found the game texts of the Atlas skill point, AFK and NPC lines in a fresh game
  export, each different in every language, and the `Temple Atlas` type the parser does not list.
