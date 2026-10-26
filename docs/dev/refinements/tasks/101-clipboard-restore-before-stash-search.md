# The clipboard restore after a stash search can come before the game pastes

**Status:** done 2026-10-26
**Area:** main
**Origin:** [main/src/shortcuts/text-box.ts](../../../../main/src/shortcuts/text-box.ts)
**Verified:** 2026-10-26

`stashSearch()` in `main/src/shortcuts/text-box.ts` puts the search on the clipboard and presses
`Ctrl + F`, the paste keys and `Enter` inside `restoreShortly()` in `HostClipboard.ts`. With
Restore clipboard on, `restoreShortly()` writes the previous clipboard text back 120 ms later
(`RESTORE_AFTER`), whether or not the game has pasted. A game that stalls for longer pastes that
text, which can be a password, into the stash search box. When an open chat box keeps the focus
after `Ctrl + F`, which nobody has checked in the game, the paste goes to chat and `Enter` sends it.

Chat commands stopped restoring the clipboard for the same reason
([060](060-clipboard-restore-before-paste.md)): main cannot see when the game reads the clipboard,
so no restore time is safe.

Done looks like: a decision for the maintainer, then the change with a test in
`main/specs/stash-search.test.ts` and the user pages updated. The options:

- Leave the search on the clipboard, as a chat command does, so that Restore clipboard applies
  only to price checks.
- Keep the timed restore and the sentence about it in the Restore clipboard row of
  [settings.md](../../../settings.md).

## History

- 2026-10-26: Filed when chat commands stopped restoring the clipboard, which left the stash search
  with the timed restore.
- 2026-10-26: The maintainer chose to leave the search on the clipboard. Done in
  `fix(main): keep the search text on the clipboard after a stash search`. `stashSearch()` runs in
  `throttle()`, so Restore clipboard applies only to the keys that copy an item.
