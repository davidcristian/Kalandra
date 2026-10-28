# ADR-0012: Trade searches without a key press only for stash prices, within the user's budget

**Status:** Accepted (2026-10-28)

## Context

Every trade search, exchange and fetch that Kalandra sent before 2026-10-28 followed a key press or a click of the
user ([ADR-0005](ADR-0005-proxy-hosts-and-trade-rate-limits.md)). The stash prices feature reads a public stash tab
of the user's account from the official trade site every few minutes, without a key press, and prices the items the
user drops there with one search each, so that they can be marked while the user plays.

The trade site counts searches per IP address and shares that count between Kalandra's price checks, the trade site
in a browser and every other program on the same address. On 2026-10-28 a search response sent
`x-rate-limit-ip: 8:10:60,15:60:120,60:300:1800,600:10800:3600`: 600 searches in 3 hours, and a restriction of an
hour for a client above it. [AGENTS.md](../../../AGENTS.md) records that the site bans clients that keep exceeding
its limits. Searches sent in the background therefore take searches from the user's own price checks, and a client
that sends them on a timer can reach the limit without the user noticing.

## Decision

**1. Only the stash prices reader and pricer send trade requests without a key press.** They are
`createStashReader()` in `renderer/src/web/stash-prices/stash-reader.ts` and `createStashPricer()` in
`stash-pricer.ts` beside it. Another trade request without a key press needs a new decision. Reason: one module
keeps the rules below, and a review sees any new background request.

**2. It runs only while the user turned it on.** The stash prices widget's `enabled` setting is off by default, and
turning it off stops the timer and the running check. It also needs the account name and a league. Reason: the
searches use the user's IP and the user's share of the limit.

**3. It is paced.** The reader sends one search per check, one check per interval: 10 minutes by default and 5 at
least. It fetches every listing the search returns, 10 per request and one request at a time, so at most 10 requests
a check. The pricer sends at most one search every 15 seconds, never two at once, and fetches the 20 cheapest listings
of it in two requests; an item that the price file prices needs no request. Reason: the search order does not change
when an item moves within the tab or a whole tab moves, so only a fetch shows an item's place; 15 seconds keeps the
pricer at 20 of the 60 searches the site allows in 5 minutes.

**4. It stays within the user's search budget.** No search goes out while the 3 hour search count is at or above the
`searchBudget` setting: 400 by default, 0 to 600. The pricer stops earlier, at the budget less the searches the reader
needs in 3 hours (180 minutes divided by the interval, 18 at 10 minutes), so pricing never takes the reader's search.
The count is the stack of the SEARCH limiter with the longest window, which `adjustRateLimits` fills from the site's
state header, so it includes the searches of every program on the IP. Before the site has sent that window, the count
is 0. Reason: the user keeps at least 600 minus the budget searches in each 3 hours for price checks, and a budget of
0 turns the searches off.

**5. The user's own checks go first.** No background request goes out while the price check window is shown or a
request waits in the limiter set, and no pricing search while the reader checks the tab. A background request never
waits in a limiter's queue: the reader and the pricer check `RateLimiter.estimateTime` first and try again 30
seconds later. Reason: a price check sent after a queued background request would wait, or `preventQueueCreation`
would fail it with `Retry after N seconds`.

**6. It goes through the same proxy and limiter sets as a price check.** Each search and fetch waits on
`RATE_LIMIT_RULES.SEARCH` or `.FETCH` and calls `adjustRateLimits` with the response headers. A trade error, a 429
included, ends the check, or stops pricing for the interval, and the limiters then hold every later request for the
time the site gave. Reason: [ADR-0005](ADR-0005-proxy-hosts-and-trade-rate-limits.md), decision 4; the site counts per
IP, so a separate limiter set would not count the price checks.

## Consequences

- A price check can find one more search and up to ten more fetches in the limiters from the last background check.
- Pricing 60 items that need a search takes at least 15 minutes and 60 searches of the budget.
- A check reads at most the newest 100 listings of the account, since a search returns 100 ids and a split search
  would cost more of the budget ([refinement 115](../refinements/tasks/115-stash-prices-reads-the-newest-100.md)).
- `specs/web/stash-prices/stash-reader.test.ts` and `stash-pricer.test.ts` check each decision against a fake trade
  site with fake timers.

## Alternatives rejected

- **A limiter set of its own for background requests.** The site counts per IP, so the two sets would not see each
  other's requests.
- **Queueing background requests behind the limiters.** A price check after them would wait for them.
- **A fixed budget.** How many searches a user needs for price checks differs between users, so it is a setting.

## Related

- [Stash prices module](../modules/renderer-stash-prices.md): the reader, the order of a check and its tests.
- [Price check module](../modules/renderer-price-check.md): the limiter sets and `adjustRateLimits`.
- [ADR-0005](ADR-0005-proxy-hosts-and-trade-rate-limits.md): the proxy and the limiter sets.
