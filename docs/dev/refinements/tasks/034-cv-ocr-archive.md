# Check the cv-ocr.zip file list and decide where the archive comes from

**Status:** declined 2026-10-26
**Area:** docs
**Origin:** [docs/extra-widgets.md](../../../extra-widgets.md)
**Verified:** 2026-10-26

The OCR guide links `cv-ocr.zip` from release v3.20.10007 of Awakened PoE Trade on GitHub. It tells
the user to extract a `cv-ocr` folder from the archive into `%APPDATA%\kalandra\apt-data`, and shows
the folder tree that should result. Nobody has compared that tree with a listing of the archive, so
the folder name and the file list on the page are unchecked.

The code reads four files from `apt-data/cv-ocr`: `tesseract-core-simd.js` and `opencv.js`
(`wasm-bindings.ts`), `heist-lock.bmp` (`HeistGemFinder.ts`) and `<lang>.traineddata` for the app
language, `eng` or `rus` (`changeLanguage` in `wasm-bindings.ts`). The tree on the page must
contain at least these.

The link also makes OCR depend on a release of another project that Kalandra does not control.

Done looks like: the maintainer downloads the archive, lists it, and corrects the steps and the
tree on the page. Then a decision: keep the link, or attach the archive to a Kalandra release, with
the license notices of the libraries in it, and link that. This task closes without work if OCR is
removed ([031](031-path-of-exile-1-features.md)).

## History

- 2026-10-18: Found while docs/ocr-guide.md was rewritten. The download needs the maintainer's
  go-ahead, so the writer sent one `HEAD` request, which reported 5,332,857 bytes, and downloaded
  nothing. A second `HEAD` request on the same day, during the task review, reported the same size.
- 2026-10-26: Declined without work, as this task said it would be. The maintainer chose to remove
  the Heist gem OCR ([031](031-path-of-exile-1-features.md)), so no page links `cv-ocr.zip` and no
  code reads `apt-data/cv-ocr`. The Origin links `docs/extra-widgets.md`, since `docs/ocr-guide.md`
  is gone.
