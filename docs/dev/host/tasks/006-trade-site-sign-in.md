# Trade site sign-in, bot check and listing marks through Kalandra

**Status:** never attempted
**Needs:** Path of Exile 2 on Windows, a pathofexile.com account and a private league
**Origin:** [docs/private-leagues.md](../../../private-leagues.md)
**Verified:** 2026-10-18

Agents send no requests to the trade site ([AGENTS.md](../../../../AGENTS.md#safety)), so only the
maintainer can run this check.

**Claims.**

- Signing in to the trade site in the built-in browser also signs in Kalandra's own trade requests:
  main sends them with the cookies of the default session (`useSessionCookies` in
  `main/src/proxy.ts`), which the built-in browser uses. The cookie that keeps the sign-in is
  `POESESSID` ([quick-start.md](../../../quick-start.md), [price-check.md](../../../price-check.md)).
- The trade site shows private league listings only to a signed-in account, and a private league
  name ends with `(PL<number>)`, which `isPrivateLeague` in `Leagues.ts` matches
  ([private-leagues.md](../../../private-leagues.md)).
- A signed-in account has a higher limit for complex queries ([complex-query.md](../../../complex-query.md)).
- The bot check can show a CAPTCHA or finish by itself after a few seconds, and passing it in the
  built-in browser lets Kalandra load the leagues ([failed-load-leagues.md](../../../failed-load-leagues.md)).
  The site sends an HTML page when it is down, under maintenance or checking for bots
  ([invalid-json.md](../../../invalid-json.md)).
- In the results ([price-check.md](../../../price-check.md), [faq.md](../../../faq.md)): the dot
  shows the seller's status (online, away, offline). A listing you can buy at once has no dot, and
  the code treats a listing with a `fee` as one (`isInstantBuyout` in `pathofexile-trade.ts`). A
  question mark shows when the listed item has no note of its own (`hasNote`), and the pages say
  the price then comes from the stash tab's name. With Show indication on collapsed listings off,
  `× N` does not show.
- A search response has the `x-rate-limit-*` headers that `adjustRateLimits` reads
  ([ADR-0005](../../adr/ADR-0005-proxy-hosts-and-trade-rate-limits.md)).

**Do.** Tick Enable builtin browser in Settings, Price check, so that Trade opens the built-in
browser, and sign in there. Price check items in a public league, then in the private league,
which goes in the "or Private League" field of Settings, Price check. Read one search response's
headers in the developer tools, Network tab: a dev run opens them at start, and
[003](003-overlay-key-and-focus.md) checks Ctrl + Shift + I in a packaged build. Never send
requests on purpose to exceed the limits ([AGENTS.md](../../../../AGENTS.md#safety)).

**Pass.** Each claim holds.

**Record.** Any difference goes into the page that states it, in the same commit as this file's
History line.

## History

- 2026-10-18: Filed from the trade site claims the writers of the price check and troubleshooting
  pages could not check without requests to the site.
