# A ConfigStore test waits for real timers

**Status:** open
**Area:** main
**Origin:** [main/specs/ConfigStore.test.ts](../../../../main/specs/ConfigStore.test.ts)
**Verified:** 2026-10-22

In `ConfigStore.test.ts`, the test of a `config.json` that stays open in another program waits
through the 750 ms of `RENAME_RETRY_DELAYS_MS`. With two renderer suites running in parallel, it
took up to 1.3 seconds of its 5 second test timeout. A slower machine can pass that limit with
correct code.

Done looks like: `ConfigStore` takes the function that waits between rename retries, so that a test
passes one that returns at once, as `GameLogWatcher` takes the `FileWatch` its tests replace. The
test then waits for no timer.

## History

- 2026-10-22: Filed when the waits after a log re-parse and two config saves stopped polling.
- 2026-10-22: The `GameLogWatcher.test.ts` half is done by refactor(main): pass the file watch
  functions to GameLogWatcher.
