# The clipboard restore after a chat command can come before the game pastes

**Status:** done 2026-10-26
**Area:** main
**Origin:** [main/src/shortcuts/HostClipboard.ts](../../../../main/src/shortcuts/HostClipboard.ts)
**Verified:** 2026-10-26

`typeInChat()` and `stashSearch()` in `main/src/shortcuts/text-box.ts` put their text on the
clipboard and press the keys inside `restoreShortly()` in `HostClipboard.ts`. With Restore clipboard
on, `restoreShortly()` writes the previous clipboard text back after a fixed 120 ms
(`RESTORE_AFTER`), whether or not the game has read the clipboard. A game that handles the
`Ctrl + V` later, for example during a stall, pastes the previous text. A chat command with `send`
then presses Enter and posts that text to the chat channel. The previous text can be anything the
user copied, such as a password. A stash search pastes it into the stash search box instead.

Main has no way to see when the game reads the clipboard. Electron's `clipboard` has no read event,
and `uiohook-napi` reports each key it sends before the game handles it. A longer delay makes the
case rarer but does not rule it out. The Restore clipboard row of
[settings.md](../../../settings.md) states the risk until this task closes.

Done looks like: a decision for the maintainer, then the change with a test through the fakes of
`main/specs/fake-chat.ts`, and the user pages updated. The options:

- Restore when the game window loses focus, so the command text stays on the clipboard while the
  user plays. A paste in the game after a command then pastes the command text, and a game that
  stalls until the user switches away still reads the restored text.
- Put the text on the clipboard with delayed rendering through a native module (on Windows the
  owner gets `WM_RENDERFORMAT` when another program reads it), and restore after that read. This
  adds a native dependency for each platform.
- Keep the timer and the warning on the settings page.

## History

- 2026-10-19: Filed when the Restore clipboard row got its warning, since main cannot tell when the
  game has read the clipboard.
- 2026-10-26: Done for chat commands in
  `fix(main): keep the command text on the clipboard after a chat command`. `typeInChat()` runs in
  `throttle()`, which restores nothing, so a game that stalls pastes and sends the command. No
  restore time is safe, and a restore at focus loss still fails when the user leaves a stalled
  game, such as during a loading screen. The stash search keeps the timed restore:
  [101](101-clipboard-restore-before-stash-search.md).
