# Existing code breaks the any, cast and empty catch checks of rule 7

**Status:** open
**Area:** rules
**Origin:** [main/.eslintrc.cjs](../../../../main/.eslintrc.cjs)
**Verified:** 2026-10-21

Rule 7 of [AGENTS.md](../../../../AGENTS.md#what-every-change-must-pass) bans `any`, a cast through
`unknown` and an error dropped by an empty `catch`. ESLint checks these in both processes with
`@typescript-eslint/no-explicit-any`, `no-empty` and two `no-restricted-syntax` patterns, one for a
cast through `unknown` and one for an empty `.catch()` handler. The code that broke them when they
were turned on is exempt:

- main, in `existingOffenders` and the two `no-restricted-syntax` overrides of `main/.eslintrc.cjs`:
  7 `any` in `vision/HeistGemFinder.ts`, `vision/utils.ts` and `vision/wasm-bindings.ts`; 4 empty
  `catch` blocks in `ConfigStore.load()` ([001](001-failed-config-read-saves-defaults.md)),
  `guessFileLocation()` and `OcrWorker` ([010](010-ocr-errors-dropped.md)); 2 casts in `proxy.ts`;
  and the empty `.catch()` handlers of the `copy-item` and `ocr-text` keys in
  `shortcuts/Shortcuts.ts`, the second also in [010](010-ocr-errors-dropped.md).
- the renderer, in `renderer/eslint-suppressions.json`: 35 casts through `unknown`, 3 in 3 files
  under `src/` and 32 in 11 files under `specs/`.

No installed ESLint plugin checks the reason on an `eslint-disable` line, so that ban is checked
only by reading the diff. 23 such comments under `src/` and `specs/` have no reason.

Done looks like: each place uses a real type, handles or passes on the error, or gives its reason
in a comment on the line. Then its file leaves the main lists, and
`npm run lint -- --prune-suppressions` in `renderer/` removes its count.

## History

- 2026-10-21: Filed when the rule 7 checks were turned on in both ESLint configs, with the files
  that broke them at that point.
- 2026-10-21: The 12 casts in `widget-registry.ts` were removed
  ([044](044-widget-registry-cast.md)).
