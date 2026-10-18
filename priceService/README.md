# Price service

Builds the price files Kalandra reads, from poe.ninja's PoE 2 economy API, and serves them at
`https://kalandra.ashoal.com/prices/`. poe.ninja asks desktop apps to go through their own backend instead of calling
its API from every player's machine ([its API page](https://poe.ninja/docs/api)), so the app reads these files and
never calls poe.ninja itself.

Python 3.12 or newer, standard library only.

## What it writes

Once an hour, for each league that `GET /poe2/api/economy/leagues` lists (at most 12):

- `<league>.json`: one request per category in `renderer/public/data/namespaceMap.json`, joined into one file. The
  name is the league id in lowercase letters and digits (`Runes of Aldur` is `runesofaldur.json`), the same rule as
  `leagueFileName` in `renderer/src/web/background/price-source.ts`.
- `index.json`: when the cycle ran, which leagues it wrote and which failed.

The file has `core` (the exchange rates per divine, from the Currency overview) and `itemOverviews` (one `type` and
its `lines` per category). Every value is in divines, which the app expects. poe.ninja reports some leagues in another
currency (on 18 Oct 2026, `HC Runes of Aldur` in exalted and `Hardcore` in chaos), so each response is converted with
the divine rate in its own `core`, and a response without one is left out. The app finds an item by searching the raw text for `{"name":...,"variant":...,"primaryValue":`,
so the key order in `price_service/transform.py` is part of the format. `tests/fixtures/price_file.json` is read by
both this service's tests and `renderer/specs/web/prices.test.ts`; a format change updates both in one commit.

A category the app should price is added to `namespaceMap.json`: `cx: true` reads the exchange overview, `cx: false`
the stash item overview, and `type` is poe.ninja's `type` parameter.

## How it treats poe.ninja

- One request at a time, with `PRICE_REQUEST_DELAY_SECONDS` between requests and one cycle per hour, which matches
  how often poe.ninja refreshes PoE 2 data.
- A User-Agent that names the service and a contact (`PRICE_CONTACT`).
- `If-None-Match` with the last ETag, so unchanged data comes back as a 304.
- When a request fails, the last good response is used. A league whose data was never fetched keeps its old file.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `PRICE_OUTPUT_DIR` | `/srv/prices` | Where the files are written |
| `PRICE_NAMESPACE_MAP` | `/app/namespaceMap.json` | The categories to fetch |
| `PRICE_INTERVAL_MINUTES` | `60` | Time between the starts of two cycles |
| `PRICE_REQUEST_DELAY_SECONDS` | `1` | Pause after each request |
| `PRICE_CONTACT` | the repo's issues page | Contact sent in the User-Agent |
| `PRICE_LOG_LEVEL` | `INFO` | Python logging level |

## Run and test

From this folder:

```bash
python -m unittest discover -s tests -v
```

```bash
PRICE_OUTPUT_DIR=/tmp/prices PRICE_NAMESPACE_MAP=../renderer/public/data/namespaceMap.json python -m price_service --once
```

`--once` runs one cycle and exits; it sends about 140 requests to poe.ninja, so do not run it in a loop.

## Deploy

`compose.yaml` runs three containers on one network:

- `prices`: this service, writing to the `prices` volume. Its health check fails when `index.json` is more than about
  two hours old.
- `web`: nginx serving the volume read only under `/prices/`, with gzip and `Cache-Control: public, max-age=300`.
  It also listens on `127.0.0.1:8080` for checks on the host.
- `tunnel` (profile `tunnel`): `cloudflared`, which opens an outbound connection to Cloudflare, so nothing listens on
  the internet.

1. In Cloudflare Zero Trust, create a tunnel and give it the public hostname `kalandra.ashoal.com` with the service
   `http://web:80`.
2. Put its token in `priceService/.env` as `TUNNEL_TOKEN=...` (the file is ignored by git; keep it mode 600).
3. In the `ashoal.com` zone, add a cache rule that makes `kalandra.ashoal.com/prices/*` eligible for cache and uses
   the origin's Cache-Control. Cloudflare does not cache JSON without one.
4. Start it: `docker compose --profile tunnel up -d --build`.
5. Check it: `curl -s https://kalandra.ashoal.com/prices/index.json` shows a `generatedAt` from the last hour.
