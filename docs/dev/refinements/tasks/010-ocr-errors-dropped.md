# OCR errors are dropped by empty catch blocks

**Status:** done 2026-10-26
**Area:** main
**Origin:** [main/src/shortcuts/Shortcuts.ts](../../../../main/src/shortcuts/Shortcuts.ts)
**Verified:** 2026-10-26

OCR (optical character recognition) reads text from a screenshot of the game window. In
`main/src/vision/link-main.ts`, `OcrWorker.create()` has an empty `catch {}` around `api.init()`,
and `updateOptions()` has an empty `catch` around `changeLanguage()`. The `ocr-text` branch in
`main/src/shortcuts/Shortcuts.ts` ends its `findHeistGems()` call with `.catch(() => {})`.

So when the `cv-ocr` files are missing, or the app language is not English or Russian (`langMap` in
`main/src/vision/wasm-bindings.ts`), the OCR key does nothing and Settings, Debug shows no line. A
failed language change stays in `_changeLangPromise` in `main/src/vision/link-worker.ts`, which
`changeLanguage()` and `findHeistGems()` await first. So OCR fails from then on, even after a change
back to English, until Kalandra restarts.

Rule 7 of [AGENTS.md](../../../../AGENTS.md#what-every-change-must-pass) says errors are never
dropped by an empty `catch`. The in-game check in
[runbooks/in-game-check.md](../../runbooks/in-game-check.md) had no log line to read for this
reason.

Done looks like: each of the three places writes one error line through `Logger`, so a missing
`cv-ocr` folder shows in Settings, Debug, and the runbook names that line. `OcrWorker` has no
`Logger` today, so `Shortcuts.create()` passes it one. `changeLanguage()` in `link-worker.ts` no
longer waits on a failed earlier change, so a change back to English makes OCR work again. If the
maintainer removes OCR ([031](031-path-of-exile-1-features.md)), this task closes with it.

## History

- 2026-10-18: Found while docs/ocr-guide.md was rewritten, by reading `OcrWorker` and the `ocr-text`
  branch.
- 2026-10-26: Done. The maintainer chose to remove the Heist gem OCR
  ([031](031-path-of-exile-1-features.md)), and `OcrWorker`, its worker thread and the `ocr-text`
  branch of `Shortcuts.ts` were removed with it. The Origin links `Shortcuts.ts`, since
  `link-main.ts` is gone.
