# A TradeData.ts comment gives the wrong interest window

**Status:** done 2026-10-26
**Area:** renderer
**Origin:** [renderer/src/web/background/TradeData.ts](../../../../renderer/src/web/background/TradeData.ts)
**Verified:** 2026-10-26

`TradeData.ts` sets `INTEREST_SPAN_MS = 60 * 60 * 1000`, one hour, and the comment on the same line
says `20 min`. `Prices.ts` has its own `INTEREST_SPAN_MS`, and that one is 20 minutes.

Done looks like: the comment states the real value, or is removed if the name already says enough
([AGENTS.md](../../../../AGENTS.md#prose), Comments).

## History

- 2026-10-18: Found while the renderer price check module doc was written.
- 2026-10-26: The comments on the three interval constants of `TradeData.ts` were removed, since
  the names and the checks in `load()` say what each one does.
