# Existing code in main breaks the empty catch checks of rule 7

**Status:** open
**Area:** rules
**Origin:** [main/eslint.config.mjs](../../../../main/eslint.config.mjs)
**Verified:** 2026-10-25

Rule 7 of [AGENTS.md](../../../../AGENTS.md#what-every-change-must-pass) bans `any`, a cast through
`unknown` and an error dropped by an empty `catch`. ESLint checks these in both processes with
`@typescript-eslint/no-explicit-any`, `no-empty` and two `no-restricted-syntax` patterns, one for a
cast through `unknown` and one for an empty `.catch()` handler. The code that broke them when they
were turned on is exempt:

- main, in `existingOffenders` and the `no-restricted-syntax` override of `main/eslint.config.mjs`:
  3 empty `catch` blocks in `ConfigStore.load()` ([001](001-failed-config-read-saves-defaults.md)) and
  `OcrWorker` ([010](010-ocr-errors-dropped.md)); and the empty
  `.catch()` handlers of the `copy-item` and `ocr-text` keys in `shortcuts/Shortcuts.ts`, the
  second also in [010](010-ocr-errors-dropped.md).

No installed ESLint plugin checks the reason on an `eslint-disable` line, so that ban is checked
only by reading the diff.

Done looks like: each place handles or passes on the error, or gives its reason in a comment on
the line. Then its file leaves the main lists.

## History

- 2026-10-21: Filed when the rule 7 checks were turned on in both ESLint configs, with the files
  that broke them at that point.
- 2026-10-21: The 12 casts in `widget-registry.ts` were removed
  ([044](044-widget-registry-cast.md)).
- 2026-10-21: The 2 casts in `proxy.ts` and the 3 `any` in `HeistGemFinder.ts` were removed, and
  each `eslint-disable` comment in `main/src/` got its reason.
- 2026-10-21: The 3 casts in `renderer/src/` were removed, and each `eslint-disable` comment there
  got its reason.
- 2026-10-22: The 4 `any` in `vision/utils.ts` and `vision/wasm-bindings.ts` were replaced by
  interfaces in `vision/wasm-types.ts` that list the OpenCV and Tesseract members the code calls.
- 2026-10-22: The 14 casts through `unknown` in `specs/helper.ts` and `specs/Parser/` were
  replaced by typed test items, parser states and stat fixtures.
- 2026-10-22: The 11 casts through `unknown` in `specs/web/client-log.test.ts` were replaced by a
  helper that returns the sent client log events of one type, so the renderer exempts none.
- 2026-10-25: main moved to ESLint 9, and the main lists moved to `main/eslint.config.mjs` with the
  same files.
- 2026-10-25: `guessFileLocation()` passes each error but a missing file to its caller, which logs it,
  and `utils.ts` left the `no-empty` list.
