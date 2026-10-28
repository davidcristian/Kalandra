# Stash prices reads trade text in another language only in part

**Status:** open
**Area:** trade
**Origin:** [renderer/src/web/stash-prices/mod-text.ts](../../../../renderer/src/web/stash-prices/mod-text.ts)
**Verified:** 2026-10-28

`listingItemText()` writes the header of each explicit modifier with its tier and name only when the
app language's `MODIFIER_LINE` client string reads them back (`header()` in `mod-text.ts`). In
Russian, French and Traditional Chinese the header loses the tier, and in French also the name, so
the price check's default filters for a stash item can differ from those of the same item copied in
the game. No fetch result in a language other than English is saved under `renderer/specs/docs/`, so
`item-text.test.ts` checks the converter with English text only. With an app language other than
English and **Preferred trade site** set to `www.pathofexile.com`, the site sends English text that
the parser of the app language does not read, so every item counts as unreadable; the user page
tells the user to keep the site of the language.

Done looks like: saved fetch results in Russian, French and Traditional Chinese, cases for them in
`item-text.test.ts`, and a header that keeps the tier in each language whose copied text has one,
with the client string fixed through dataParser when its pattern is the cause. A decision for the
maintainer: with `www` and another app language, stash prices either reads from the site of the app
language, or the panel says why every item is unreadable.

## History

- 2026-10-28: Left for later by the stash prices pricer, which wrote the converter and tested it in
  English.
