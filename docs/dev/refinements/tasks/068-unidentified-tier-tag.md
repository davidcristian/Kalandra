# The listing tooltip names an unidentified item's tier in English

**Status:** open
**Area:** data
**Origin:** [renderer/src/web/price-check/trade/pathofexile-trade.ts](../../../../renderer/src/web/price-check/trade/pathofexile-trade.ts)
**Verified:** 2026-10-20

`parseFetchResult()` in `pathofexile-trade.ts` tags an unidentified listing that has a tier with
`Unidentified (Tier N)`, an English template literal, and one without a tier with the UI text key
`item.unidentified`. `tooltipLineText()` in `trade/tooltip-text.ts` shows the literal unchanged, so
the tier tag is English in every language. Both tags are game text: the game shows them, and the
`UNIDENTIFIED` client string matches them. `dataParser` builds that client string from the game
strings `ItemPopupUnidentified` and `Tier` (`client_string_data.py`), but writes them only inside
the regular expression, so the app has no plain text of either to show.

Done looks like: `client_string_data.py` writes both game strings as plain client strings,
`TranslationDict` in `renderer/src/assets/data/interfaces.ts` declares them, a data update
regenerates `client_strings.js` in every language
([runbooks/game-data-update.md](../../runbooks/game-data-update.md)), and `parseFetchResult()`
builds both tags from them. A test in `renderer/specs/web/price-check/trade/tooltip-text.test.ts`
reads both tags of a saved listing in English and in German. The data update pulls the game export,
so it needs the maintainer's go-ahead.

## History

- 2026-10-20: Found while the tooltip's unrevealed modifier lines were moved to the client strings.
  This clone has no game export to regenerate the data from.
