# Existing code breaks the any, cast and empty catch checks of rule 7

**Status:** open
**Area:** rules
**Origin:** [main/.eslintrc.cjs](../../../../main/.eslintrc.cjs)
**Verified:** 2026-10-22

Rule 7 of [AGENTS.md](../../../../AGENTS.md#what-every-change-must-pass) bans `any`, a cast through
`unknown` and an error dropped by an empty `catch`. ESLint checks these in both processes with
`@typescript-eslint/no-explicit-any`, `no-empty` and two `no-restricted-syntax` patterns, one for a
cast through `unknown` and one for an empty `.catch()` handler. The code that broke them when they
were turned on is exempt:

- main, in `existingOffenders` and the `no-restricted-syntax` override of `main/.eslintrc.cjs`:
  4 empty `catch` blocks in `ConfigStore.load()` ([001](001-failed-config-read-saves-defaults.md)),
  `guessFileLocation()` and `OcrWorker` ([010](010-ocr-errors-dropped.md)); and the empty
  `.catch()` handlers of the `copy-item` and `ocr-text` keys in `shortcuts/Shortcuts.ts`, the
  second also in [010](010-ocr-errors-dropped.md).
- the renderer, in `renderer/eslint-suppressions.json`: 11 casts through `unknown` in
  `specs/web/client-log.test.ts`.

No installed ESLint plugin checks the reason on an `eslint-disable` line, so that ban is checked
only by reading the diff.

Done looks like: each place uses a real type, handles or passes on the error, or gives its reason
in a comment on the line. Then its file leaves the main lists, and
`npm run lint -- --prune-suppressions` in `renderer/` removes its count.

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
