# The bulk search Browser button does not always open the built-in browser

**Status:** done 2026-10-27
**Area:** trade
**Origin:** [renderer/src/web/price-check/trade/TradeBulk.vue](../../../../renderer/src/web/price-check/trade/TradeBulk.vue)
**Verified:** 2026-10-27

When a trade search fails, the price check window shows an error box with a `Browser` button. On an
item search, `openTradeLink()` in `TradeListing.vue` always calls `showBrowser()`, which opens the
search in the built-in browser, the browser view Kalandra shows in the overlay. On a bulk search,
`openTradeLink()` in `TradeBulk.vue` calls `showBrowser()` only when `builtinBrowser` (Settings,
Price check, Enable builtin browser) is on. Otherwise it calls `window.open()`, and the window open
handler in `main/src/windowing/OverlayWindow.ts` sends the address to the default browser.
`builtinBrowser` is off by default.

Main sends trade requests with the cookies of the built-in browser's session (`useSessionCookies` in
`main/src/proxy.ts`). A bot check passed in the default browser does not set those cookies, so it
does not help Kalandra's bulk searches. [docs/invalid-json.md](../../../invalid-json.md) tells users
to turn on Enable builtin browser before they click `Browser` on a bulk search. The `Browser` button
of the league error in `BackgroundInfo.vue` always calls `showBrowser()`, so
[docs/failed-load-leagues.md](../../../failed-load-leagues.md) is not affected.

Done looks like: `openTradeLink()` in `TradeBulk.vue` calls `showBrowser()` as the item search does,
and the same commit removes the bulk search paragraph from docs/invalid-json.md. Enable builtin
browser shows a warning about `POESESSID` when it is turned on. If the maintainer keeps the
difference for that reason, the reason goes into the History and the task is declined.

## History

- 2026-10-18: Found while docs/failed-load-leagues.md and docs/invalid-json.md were rewritten, by
  comparing the two `openTradeLink()` functions.
- 2026-10-18: Checked against the tree. The docs reference now points at docs/invalid-json.md, which
  describes the bulk search case, because the league error button always opens the built-in browser.
- 2026-10-27: fix(trade): open failed bulk searches in the built-in browser. The claim still matched
  the code, and only the error box button called `openTradeLink()`. The `POESESSID` warning gives no
  reason to keep the difference, because the item search opens the built-in browser whatever the
  setting. The same commit removes the bulk search sentence from docs/price-check.md.
