# Two main test files wait for real timers

**Status:** open
**Area:** main
**Origin:** [main/specs/GameLogWatcher.test.ts](../../../../main/specs/GameLogWatcher.test.ts)
**Verified:** 2026-10-22

`untilSent()` and the first test in `GameLogWatcher.test.ts` wait up to 4 seconds for the 450 ms
`fs.watchFile` poll of `GameLogWatcher` to see a change on disk. With two renderer suites running
in parallel, those tests took up to 1.1 seconds of their 5 second test timeout. In
`ConfigStore.test.ts`, the test of a `config.json` that stays open in another program waits through
the 750 ms of `RENAME_RETRY_DELAYS_MS`, and took up to 1.3 seconds under the same load. A slower
machine can pass either limit with correct code.

Done looks like: `GameLogWatcher` takes its watch and unwatch functions as a constructor argument,
as it takes `possiblePaths`, so that a test calls the change listener itself, and `ConfigStore`
takes the function that waits between rename retries, so that a test passes one that returns at
once. The tests then wait for no timer.

## History

- 2026-10-22: Filed when the waits after a log re-parse and two config saves stopped polling.
