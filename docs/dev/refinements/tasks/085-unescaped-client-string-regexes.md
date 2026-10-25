# Four committed client string regexes read game text characters as regex syntax

**Status:** done 2026-10-25
**Area:** data
**Origin:** [renderer/public/data/ko/client_strings.js](../../../../renderer/public/data/ko/client_strings.js)
**Verified:** 2026-10-25

The data tool now escapes every character of game text that a JavaScript regex reads as syntax
(`CapturePlaceholderClientString` in `dataParser/src/models/capture_placeholder_client_string.py`).
The committed `client_strings.js` files were written before that and still have the game text
unescaped in four lines:

- `ko`, `LOG_LEVEL_UP`: `이(가)` is a group that matches `이가`, so a log line with the game text
  `이(가)` does not match and the XP tracker misses a Korean level up.
- `fr`, `LOG_LEVEL_UP`: the final `.` matches any character.
- `es`, `EATER_IMPLICIT` and `EXARCH_IMPLICIT`: the `.` of `Mod.` matches any character.

The French and Spanish lines give the same result for the text the game writes. The Korean line
changes what matches. Whether the Korean `Client.txt` writes `이(가)` as the game text has it is
not checked in game.

This copy of the tool cannot regenerate the committed data without dropping other lines
([052](052-dataparser-older-than-committed-data.md)). Done looks like: the four lines
regenerated with the escapes, and a Korean level up checked in game with
[host task 011](../../host/tasks/011-xp-tracker.md).

## History

- 2026-10-25: Found while checking the generated regexes for regex syntax characters.
- 2026-10-25: Done by fix(data): match regex characters of game text literally, which replaces the
  four lines with the data tool's output. The Korean level up in game is a claim of
  [host task 011](../../host/tasks/011-xp-tracker.md), not yet checked.
