# ADR-0006: Prices come from Kalandra's own price service

**Status:** Accepted (2026-10-18)

## Context

A price check shows an estimate for the item, from poe.ninja's economy data, together with the trade listings.
The app needs that data as one file per league. Exiled Exchange 2 serves such a file from its own server, which
Kalandra does not control. poe.ninja asks apps to use their own backend instead of calling its API from every
player's machine ([its API page](https://poe.ninja/docs/api)).

## Decision

**1. `priceService/` builds one price file per league each hour.** For each league that poe.ninja's league list
returns, at most 12 (`MAX_LEAGUES` in `priceService/price_service/ninja.py`), it writes `<league>.json` and an
`index.json` that says when the cycle ran and which leagues it wrote or skipped. They are served at
`https://kalandra.ashoal.com/prices/`. The file name comes from the league id, so `Runes of Aldur` is
`runesofaldur.json` ([the rule](../modules/price-service.md#the-files)). Reason: one service fetches the data for
every user, so poe.ninja receives requests from one client instead of from every player's machine.

**2. The app reads the file through the proxy and sends no request to poe.ninja.** `Prices.ts` requests
`priceFileUrl(league.id)` through `Host.proxy`, `kalandra.ashoal.com` is in `PROXY_HOSTS`, and `poe.ninja` is not
([ADR-0005](ADR-0005-proxy-hosts-and-trade-rate-limits.md)). The app shows links to poe.ninja pages, which the user
opens in a browser. Reason: poe.ninja's request above.

**3. Every value in the file is in divines.** Each league's responses are converted with the divine rate in the
`core` block of that response, and the lines of a response without one are left out. Reason: the app expects
divines, and poe.ninja reports some leagues in another currency. On 18 Oct 2026, `core.primary` in the Currency
overview was `exalted` for `HC Runes of Aldur` and `chaos` for `Hardcore`; the same field in a fresh Currency
overview shows it again.

**4. Both sides read the categories from `renderer/public/data/namespaceMap.json`.** The service reads it from
`PRICE_NAMESPACE_MAP`, and `priceService/Dockerfile` copies it into the image. The app fetches it in `Prices.ts`.
Reason: the service then fetches exactly the categories the app looks up.

**5. The key order of the file is part of its format.** The app searches the raw text of the file instead of
parsing it, so `priceService/price_service/transform.py` writes the keys in a fixed order and both test suites
read one shared fixture ([price-service.md](../modules/price-service.md#why-the-key-order-is-a-format)). Reason: a
reordered key makes the app find no item, and only a test over one shared file shows that on both sides.

**6. The service limits its requests to poe.ninja.** It sends one request at a time with a pause after each, starts
one cycle an hour, names itself and a contact in its User-Agent, sends the last ETag so that unchanged data comes
back as a 304, and uses the last good response when a request fails
([price-service.md](../modules/price-service.md#how-it-treats-poeninja)). Reason: the service is the only client of
poe.ninja's API for every Kalandra user, so its traffic is the whole project's traffic.

**7. The service uses the Python 3.12 standard library only.** Reason: the image is `python:3.12-slim` plus the
package and `namespaceMap.json`, and the CI job runs the tests with no install step.

## Consequences

- A change to the file format updates the service, the app and the shared fixture in one commit, and runs both test
  suites ([AGENTS.md](../../../AGENTS.md), What every change must pass).
- When the price file is missing or the request fails, `Prices.ts` writes a warning to the console and keeps the
  prices it had. After a change of league or core currency it has none, so the price check has no estimate to show.
- `kalandra.ashoal.com` is a service the maintainer runs. Deploying and checking it is in
  [the deploy runbook](../runbooks/price-service-deploy.md).
- The price service is under the AGPL v3 like the rest of the repo ([ADR-0002](ADR-0002-agpl-with-mit-notice.md)).
- A cycle sends up to 277 requests to poe.ninja
  ([price-service.md](../modules/price-service.md#how-it-treats-poeninja)). So the service never runs in a test or a
  loop, and a live run needs the maintainer's go-ahead ([AGENTS.md](../../../AGENTS.md), Safety).

## Alternatives rejected

- **Calling poe.ninja from every copy of the app.** poe.ninja asks apps not to.
- **Reading Exiled Exchange 2's price server.** Kalandra does not control it.

## Related

- [Price service module](../modules/price-service.md): the file format, the environment and the tests.
- [Price service deploy runbook](../runbooks/price-service-deploy.md).
- [Price check module](../modules/renderer-price-check.md): how the app uses the estimate.
- [ADR-0005](ADR-0005-proxy-hosts-and-trade-rate-limits.md): the proxy list the price host is on.
