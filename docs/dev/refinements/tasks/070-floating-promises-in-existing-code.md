# Existing code in main and the renderer leaves promises floating

**Status:** open
**Area:** rules
**Origin:** [main/eslint.config.mjs](../../../../main/eslint.config.mjs)
**Verified:** 2026-10-25

ESLint checks `@typescript-eslint/no-floating-promises` and `@typescript-eslint/no-misused-promises`
in both processes, except for the code that broke them when they were turned on. In main,
`existingOffenders` in `main/eslint.config.mjs` turns each rule off for the files listed: 15
floating promises in 6 files, such as `shell.openExternal()` in `windowing/OverlayWindow.ts` and
`gameLogWatcher.restart()` in `main.ts`, and 4 async callbacks passed where a callback returns
nothing, such as `setInterval(this.check)` in `AppUpdater.ts`. In the renderer,
`renderer/eslint-suppressions.json` holds 22 floating promises in 14 files.

A rejection of one of these promises is not handled where it starts. Main writes it to the log
with the generic `error [unhandledRejection]` line from `main.ts`. The renderer writes it only to
the browser console, which Settings, Debug does not show
([013](013-renderer-errors-not-in-debug.md)).

Done looks like: each place awaits the promise, catches and logs the error, or marks the promise
with `void` and its reason on the line. Then its file leaves `existingOffenders`, and
`npm run lint -- --prune-suppressions` in `renderer/` removes its count. Rule 7 of
[AGENTS.md](../../../../AGENTS.md#what-every-change-must-pass) asks for this.

## History

- 2026-10-21: Filed when the two promise rules were turned on in both ESLint configs, with the
  files that broke them at that point.
- 2026-10-22: `host-files/GameLogWatcher.ts` left both lists when the log re-parse handler was
  removed.
- 2026-10-25: main moved to ESLint 9, and the main lists moved to `main/eslint.config.mjs` with the
  same files.
