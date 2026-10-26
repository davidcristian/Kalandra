# The listing tooltip names an unidentified item's tier in English

**Status:** open
**Area:** data
**Origin:** [renderer/src/web/price-check/trade/pathofexile-trade.ts](../../../../renderer/src/web/price-check/trade/pathofexile-trade.ts)
**Verified:** 2026-10-26

`parseFetchResult()` in `pathofexile-trade.ts` tags an unidentified listing that has a tier with
`Unidentified (Tier N)`, an English template literal, and one without a tier with the UI text key
`item.unidentified`. `tooltipLineText()` in `trade/tooltip-text.ts` shows the literal unchanged, so
the tier tag is English in every language. Both tags are game text: the game shows them, and the
`UNIDENTIFIED` client string matches them. `dataParser` builds that client string from the game
strings `ItemPopupUnidentified` and `Tier` (`client_string_data.py`), but writes them only inside
the regular expression, so the app has no plain text of either to show.

Done looks like: `client_string_data.py` writes both game strings as plain client strings,
`TranslationDict` in `renderer/src/assets/data/interfaces.ts` declares them, `client_strings.js`
in every language gets the two lines the tool writes, and `parseFetchResult()` builds both tags
from them. A test in `renderer/specs/web/price-check/trade/tooltip-text.test.ts` reads both tags of
a saved listing in English and in German. These four parts are one change: a key that the data
lacks, or one that nothing reads, is not added on its own. This copy of the tool cannot regenerate
the committed data as a whole ([dataparser.md](../../modules/dataparser.md#outputs)), so the two
lines go into each committed `client_strings.js` alone, which needs the maintainer's go-ahead.

## History

- 2026-10-20: Found while the tooltip's unrevealed modifier lines were moved to the client strings.
  This clone has no game export to regenerate the data from.
- 2026-10-26: Checked against the game export now in `dataParser/data/vendor/`, which git does
  not track. `ItemPopupUnidentified` and `Tier` exist in all nine languages, such as
  `Unidentified` and `Tier` in English and `Nicht identifiziert` and `Level` in German, and match
  the committed `UNIDENTIFIED` expressions. The `item.unidentified` UI text differs from the game
  text in Spanish, Portuguese and Russian. Left open for the go-ahead above.
