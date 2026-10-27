# The data loader imports the trade list loader from the web code

**Status:** done 2026-10-27
**Area:** renderer
**Origin:** [renderer/src/assets/data/index.ts](../../../../renderer/src/assets/data/index.ts)
**Verified:** 2026-10-27

`loadTradeData()` in `renderer/src/assets/data/index.ts` calls `useTradeData()` from
`renderer/src/web/background/TradeData.ts`, which reads the trade site's item and stat lists through
`Host.proxy` and `readTradeData` from `web/price-check/trade/trade-response.ts`. It is the only
import from the data loader into `src/web/`; the parser imports none
([renderer-parser.md](../../modules/renderer-parser.md)).

At runtime no import path leads from `TradeData.ts` back to the data loader. With type imports
counted, `trade-response.ts` imports `trade/common.ts`, which imports `filters/interfaces.ts`, which
imports `@/assets/data`, so the type graph has a cycle through the data loader.

Done looks like: the data loader takes the trade lists from a function that the app passes at start,
as the parser takes its settings through `setParserSettings` in `renderer/src/parser/settings.ts`,
or `TradeData.ts` and the code it needs move under `src/assets/data/`. The suites in
`renderer/specs/data/` still read the saved trade lists, and no import from `src/assets/data/` into
`src/web/` is left.

## History

- 2026-10-22: Left open when the parser stopped importing web modules. A script that follows the
  imports of `renderer/src` found it as the only import left from the data loader or the parser
  into `src/web/`.
- 2026-10-27: refactor(renderer): pass the trade lists to the data loader at start
