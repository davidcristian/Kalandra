# Stash detection has no capture on Linux and macOS

**Status:** open
**Area:** main
**Origin:** [main/src/windowing/GameCapture.ts](../../../../main/src/windowing/GameCapture.ts)
**Verified:** 2026-10-28

`GameCapture` grants a capture only when `process.platform` is `win32`, and the detector's
`platform()` source returns `not-windows` elsewhere, so a user on Linux or macOS marks the tab open
and closed with the hotkey ([ADR-0013](../../adr/ADR-0013-game-capture.md), decision 6). Under
Wayland a window capture goes through the desktop portal, which shows its own picker, and macOS asks
for the screen recording permission. Nobody has run the game with a capture on either.

Done looks like: a decision for the maintainer whether to support either platform. For each one
supported, a run with the game shows that a window capture of the game starts without a picker each
time, and `GameCapture` and the detector allow that platform, with tests for it.

## History

- 2026-10-28: Left for later by the stash detection, which captures on Windows only.
