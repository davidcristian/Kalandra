# priceService/: the hourly price files

**Purpose.** `priceService/` is a Python service that builds one price file per league from poe.ninja's PoE 2
economy API and serves the files at `https://kalandra.ashoal.com/prices/`. It runs one cycle an hour by default. A
cycle requests poe.ninja's league list and every category of each league, then writes the files. The app reads these
files through the proxy in `main/`, which forwards the app's requests to a fixed list of hosts. The app sends no
request to poe.ninja's API, because poe.ninja asks apps to use their own backend
([its API page](https://poe.ninja/docs/api)). The decision is
[ADR-0006](../adr/ADR-0006-own-price-service.md). Running, testing and configuring the service:
[priceService/README.md](../../../priceService/README.md). Deploying it and fixing a failed deploy:
[price-service-deploy.md](../runbooks/price-service-deploy.md).

| File | Does |
| --- | --- |
| `price_service/__main__.py` | `read_settings` reads the environment, then `main` calls `run_schedule` with `--once` or without it |
| `price_service/ninja.py` | `NinjaClient`: the requests to poe.ninja, one at a time, with ETags and a fallback copy |
| `price_service/service.py` | `run_schedule`: one cycle per interval, or one cycle with `--once`; `run_cycle` and `build_league`: one file per league and `index.json` |
| `price_service/transform.py` | turns poe.ninja's responses into the price file, in the key order the app searches |

## Public contract

### The files

Each cycle writes into `PRICE_OUTPUT_DIR`:

- `<league>.json` for each league that `https://poe.ninja/poe2/api/economy/leagues` lists, the first 12 in list
  order (`MAX_LEAGUES` in `ninja.py`). The name is the league id in lowercase letters and digits only:
  `HC Runes of Aldur` is `hcrunesofaldur.json`. `league_file_name` in `transform.py` and `leagueFileName` in
  `renderer/src/web/background/price-source.ts` compute it, and both test suites check them against
  `tests/fixtures/league_files.json`. A league id with no letter or digit is skipped.
- `index.json`: `generatedAt` (UTC, ISO 8601 to the second), `leagues` (an `{"id", "file"}` pair for each file
  written in this cycle) and `failed` (the league ids skipped in this cycle). The app does not read it. The health
  check in `compose.yaml` and the deploy runbook do.

`write_atomic` in `service.py` writes each file as `.<name>.tmp` next to its target and then renames it, so a reader
never gets half a file, and `nginx.conf` returns 404 for any name that starts with a dot. A league that fails in a
cycle keeps the file of its last good cycle.

### The price file format

One line of compact JSON, UTF-8 with non-ASCII names kept, with the keys in this order:

```text
{"core":{"rates":{"exalted":541.6,"chaos":8.53},"primary":"divine","secondary":"chaos"},"itemOverviews":[{"type":"Currency","lines":[...]},...]}
```

- `core` comes from the league's `Currency` overview (`CORE_CATEGORY` in `service.py`): `rates` (how many of each
  currency one divine buys), then `primary`, always `divine`, then `secondary`. When `namespaceMap.json` has no
  exchange category with the type `Currency`, every league fails.
- `itemOverviews` has one entry per category in `namespaceMap.json`, in its order: `type`, then `lines`.
- An exchange line (`exchange_lines`) has `name`, `primaryValue`, `detailsId`, `id`, `volumePrimaryValue`,
  `maxVolumeCurrency`, `maxVolumeRate` and `sparkline`. A line whose `id` is not a string or has no named item in
  the response's `items`, or whose value is not a number, is left out. An item whose `id` is not a string is
  ignored.
- A stash line (`stash_lines`) has `name`, `variant`, `primaryValue`, `detailsId` and `sparkline`. `variant` is
  poe.ninja's `variant`, or its `baseType` when there is none, and is left out when neither is a string. The price
  check finds a unique, flasks included, by its name and its base item as `variant` (`getDetailsId` in
  `renderer/src/web/price-check/trends/getDetailsId.ts`).
- An `items` or `lines` value that is not a list, such as `null`, is read as an empty list and logged as a warning.
- A missing sparkline is written as `{"totalChange":0,"data":[]}`.

`primaryValue` and `volumePrimaryValue` are in divines, which the app expects. poe.ninja reports some leagues in
another currency: on 18 Oct 2026, `HC Runes of Aldur` in exalted and `Hardcore` in chaos, and the saved response
`tests/fixtures/ninja/hardcore_exchange_currency.json` is in exalted. `divine_factor` converts each response with the
divine rate in its own `core`. A response with neither a divine primary currency nor a positive divine rate gives no
lines.

### Why the key order is a format

`renderer/src/web/background/Prices.ts` does not parse the whole file. It searches the raw text:

- `parseXchg` takes the text from `{"rates":` to the first `"}`, so `core` keeps `rates`, `primary` and
  `secondary` in that order, with the string `secondary` last.
- `splitJsonBlob` splits the text at each `{"type":"` and keeps the parts whose type is in `namespaceMap.json`, so
  `type` is the first key of an overview.
- `findInDatabase` searches a part for `{"name":<name>,"variant":<variant>,"primaryValue":`, without `variant` when
  the query has none, and reads up to the next `}}`. So a line starts with `name`, then `variant` when it has one,
  then `primaryValue`, and ends with `sparkline`, its only nested object.
- The search strings have no space after a `,` or a `:`, so the file has none there. `price_file` in
  `transform.py` writes it with `separators=(",", ":")`, and with `allow_nan=False`, since NaN is not valid JSON.

`tests/fixtures/price_file.json` is the output of `build_league` for the saved responses in `tests/fixtures/ninja/`.
`tests/test_service.py` checks that `build_league` returns exactly that text, and `renderer/specs/web/prices.test.ts`
checks that the app reads prices from it. A format change updates `transform.py`, `Prices.ts` and the fixture in one
commit ([AGENTS.md](../../../AGENTS.md)).

### namespaceMap.json

`renderer/public/data/namespaceMap.json` lists the categories both sides use. It has `schemaVersion` 1 and a `map`
of entries with four fields:

| Field | Read by | Meaning |
| --- | --- | --- |
| `ns` | the app | the namespace a price lookup searches: `ITEM`, `GEM` or `UNIQUE` |
| `cx` | both | `true` reads poe.ninja's exchange overview (`exchange/current/overview`), `false` the stash item overview (`stash/current/item/overview`) |
| `url` | the app | the path of the poe.ninja page the app links an item to |
| `type` | both | poe.ninja's `type` parameter, and the `type` of the overview in the file |

The map has 23 entries on 18 Oct 2026, which `tests/test_transform.py` checks. A category the app should price is a
new entry. The service image copies the file when it is built, so the service fetches a new category only after a
deploy with `--build`. A `schemaVersion` other than 1 stops the service at start (`load_categories` raises
`SnapshotError`) and makes the app find no price in the price file (`splitJsonBlob` returns an empty list).

### Environment

`read_settings` in `price_service/__main__.py` reads these variables once, at start:

| Variable | Default | Meaning |
| --- | --- | --- |
| `PRICE_OUTPUT_DIR` | `/srv/prices` | where the files are written; created when missing |
| `PRICE_NAMESPACE_MAP` | `/app/namespaceMap.json` | the categories to fetch |
| `PRICE_INTERVAL_MINUTES` | `60` | time between the starts of two cycles, above 0; a cycle longer than this starts the next at once |
| `PRICE_REQUEST_DELAY_SECONDS` | `1` | pause after every request, a failed one included; 0 or more |
| `PRICE_CONTACT` | `https://github.com/davidcristian/Kalandra/issues` | the contact sent in the User-Agent |
| `PRICE_LOG_LEVEL` | `INFO` | the Python logging level |

An interval or a delay that is not a finite number in its range stops the service at start, before its first
request, with a `SettingsError` that names the variable.

The Dockerfile sets `PRICE_OUTPUT_DIR` and `PRICE_NAMESPACE_MAP` to these defaults. Each request times out after 30
seconds (`timeout_seconds` in `NinjaClient`), which no variable changes.

## How it treats poe.ninja

- One request at a time, a pause of `PRICE_REQUEST_DELAY_SECONDS` after each one, and one cycle per
  `PRICE_INTERVAL_MINUTES`. The default of 60 minutes matches how often poe.ninja refreshes its PoE 2 data.
- A cycle sends one request for the league list, then one per category per league: at most 1 + 12 × 23 = 277. On
  18 Oct 2026 poe.ninja listed six leagues (`tests/fixtures/ninja/leagues.json`), so a cycle sent 139. The league
  count today is the length of `leagues` plus `failed` in `https://kalandra.ashoal.com/prices/index.json`.
- The User-Agent is `kalandra-price-service/1 (+<PRICE_CONTACT>)`, and every request sends
  `Accept-Encoding: gzip`.
- An ETag is a version tag a server sends with a response. The service sends the last one back in `If-None-Match`,
  so unchanged data comes back as a 304 with no body and the service reuses its copy.
- When a request fails, the service uses the last good response for that URL. A request fails on an error status, a
  network error, a body cut short, a corrupt gzip body, or a body that is not valid JSON. `parse_json` in `ninja.py`
  also rejects `NaN`, `Infinity`, a number such as `1e999` that Python reads as an infinity, and a lone surrogate
  escape such as `"\ud800"`. Python's JSON parser accepts them, and the price file cannot hold them. The service
  keeps the copies in memory only, so the first cycle after a start has none.
- An overview request that fails with no copy skips its whole league, which is logged and listed in `failed`. So
  does a value that becomes too large for a float in the conversion to divines. A league list request that fails
  with no copy ends the cycle before any league, and no `index.json` is written.
- Any other error in a cycle, such as a failed disk write, ends that cycle with `ERROR cycle failed` and its
  traceback (`run_schedule` in `service.py`). The process keeps running, and the next cycle starts on time. A
  process that ends would make Docker start a new one (`restart: unless-stopped` in `compose.yaml`), and the new
  one would send its requests again at once.

## App side

- `renderer/src/web/background/price-source.ts`: `PRICE_HOST` (`kalandra.ashoal.com`), `leagueFileName` and
  `priceFileUrl`.
- `main/src/proxy.ts` has `kalandra.ashoal.com` in `PROXY_HOSTS`, and poe.ninja is not in it
  ([ADR-0005](../adr/ADR-0005-proxy-hosts-and-trade-rate-limits.md)).
- `renderer/src/web/background/Prices.ts` (`usePoeninja`): `load` requests
  `/proxy/kalandra.ashoal.com/prices/<file>` through `Host.proxy` for the selected league. It loads a league only
  when the trade site lists it, `isPrivateLeague` in `Leagues.ts` does not match it (a private league or a Ruthless
  league), and the realm setting is `pc-ggg`, labelled International. The realm setting shows only with the
  Traditional Chinese language, where `pc-garena` is the other choice.
- The core currency is the currency the app shows prices in, exalted or chaos. It is the **Primary base currency**
  setting in the price check settings (`coreCurrency` in `renderer/src/web/price-check/settings-price-check.vue`).
  `core.rates` converts the file's divine values to it. While one divine costs fewer than 5 chaos, the app shows
  exalted in place of chaos.
- `load` loads the file at once after a change of league or core currency, and otherwise at most every 31 minutes
  after a recent price check or item search
  ([renderer-price-check.md](renderer-price-check.md#price-estimates-backgroundpricests-backgroundprice-sourcets)).
- When the response has an error status, `load` writes the error `No price file for <league id> (<status>)` to the
  renderer's console as a warning. The app keeps the prices it already loaded, and a change of league or core
  currency clears them first. With none loaded, the app shows no price estimate.
- `findPriceByQuery` links each price to its poe.ninja page,
  `https://poe.ninja/poe2/economy/<league>/<url>/<detailsId>`, which the user can open. `<league>` is the league's
  name in poe.ninja's URLs (`selectedLeagueToUrl`). The app requests nothing from poe.ninja itself.
- The price check and its other price sources: [renderer-price-check.md](renderer-price-check.md).

## Invariants

- Standard library only, on Python 3.12 (the `python:3.12-slim` image and CI). Nothing is installed with pip.
- Only this service calls poe.ninja's API, in the pattern above. No test, script or app code calls it.
- The service and the app use the same file names, categories and format. `namespaceMap.json` is the one list of
  categories, and the tests of both read the two shared fixtures, `tests/fixtures/price_file.json` and
  `tests/fixtures/league_files.json`.
- Tests send no request to poe.ninja: `FakeGet` in `tests/support.py` replays the saved responses in
  `tests/fixtures/ninja/`, and `UrllibGetTest` in `tests/test_ninja.py` sends its requests to an HTTP server on
  `127.0.0.1`.

## Tests

`python -m unittest discover -s tests -v` in `priceService/`, 48 tests on 19 Oct 2026. The `price-service` job in
`.github/workflows/test.yml` runs it under coverage.py ([architecture.md](../architecture.md#ci)) and fails below the
floor in `priceService/.coveragerc`, 96.5% of lines and branches on 19 Oct 2026. The pre-commit hooks run Ruff with
every rule but those `priceService/ruff.toml` turns off, each with its reason, and Pyright in strict mode, set in
`pyrightconfig.json` at the repo root. The app side is `renderer/specs/web/prices.test.ts` and
`renderer/specs/web/price-check/trends/getDetailsId.test.ts`, run by `npx vitest run` in `renderer/`.

**Dependencies.** The Python standard library and poe.ninja's PoE 2 economy API. The deployment uses Docker
Compose, nginx and Cloudflare Tunnel ([price-service-deploy.md](../runbooks/price-service-deploy.md)).
