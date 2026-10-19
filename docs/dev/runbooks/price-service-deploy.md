# Runbook: deploying the price service

How to run `priceService/` on a machine with Docker Compose so that `https://kalandra.ashoal.com/prices/` serves its
files, how to check it, and what to do when it fails. What the service writes and why:
[price-service.md](../modules/price-service.md). Running it without Docker:
[priceService/README.md](../../../priceService/README.md). Decision: [ADR-0006](../adr/ADR-0006-own-price-service.md).

Every installed copy of the app reads these files, so a deploy is an outward-facing change: an agent asks the
maintainer before running any step here ([AGENTS.md](../../../AGENTS.md), Safety). A cycle is one pass in which the
service requests poe.ninja's league list and every category of each league, then writes the files. Every start of the
service runs a cycle at once, which sends up to 277 requests to poe.ninja
([price-service.md](../modules/price-service.md#how-it-treats-poeninja)), so never restart it in a loop.

## What runs

`priceService/compose.yaml` (project `kalandra-prices`) runs three containers on one network:

| Service | Image | Does |
| --- | --- | --- |
| `prices` | built from `priceService/Dockerfile`, with the repo root as the build context | runs `python -m price_service` as the user `prices` and writes to the `prices` volume at `/srv/prices`; restarts unless stopped |
| `web` | `nginx:stable-alpine` | serves the volume read only under `/prices/` with `priceService/nginx.conf`, and publishes port 8080 on the host's loopback interface only |
| `tunnel` (profile `tunnel`) | `cloudflare/cloudflared:latest` | connects out to Cloudflare Tunnel with `TUNNEL_TOKEN`, so the machine opens no port to the internet |

`nginx.conf` sends every file as `application/json`, compresses files of 1024 bytes or more with gzip, adds
`Cache-Control: public, max-age=300` and returns 404 for a name that starts with a dot and for any path outside
`/prices/`.

The health check of `prices` fails when `/srv/prices/index.json` is missing or older than 7500 seconds (two hours
and five minutes). It runs every 5 minutes, and failures in the first 10 minutes do not count. After three failed
checks in a row (Docker's default `retries`), Docker marks the container `unhealthy` and does not restart it. The
check reads only the age of `index.json`, which is written at the end of every cycle, so a cycle in which every
league fails still counts as healthy.

## Setup, once

The tunnel exists so that the machine accepts no inbound connection: `cloudflared` connects out, and Cloudflare
sends the requests for the public hostname through that connection.

1. In Cloudflare Zero Trust, create a tunnel. Give it the public hostname `kalandra.ashoal.com` with the service
   `http://web:80`, which is the `web` container on the compose network.
2. Put the tunnel's token in `priceService/.env` as `TUNNEL_TOKEN=<token>`. Git ignores this file (the root
   `.gitignore`). Make it readable by its owner only (`chmod 600 priceService/.env`) and never commit it. A
   `PRICE_CONTACT=<url>` line in the same file changes the contact the service sends to poe.ninja.
3. In the Cloudflare zone that holds `kalandra.ashoal.com`, add a cache rule that makes `kalandra.ashoal.com/prices/*`
   eligible for cache and uses the origin's Cache-Control. Cloudflare does not cache JSON without such a rule, so
   every app's request would reach the machine.

## Deploy or update

From `priceService/`, in a checkout of the commit to deploy:

```sh
docker compose --profile tunnel up -d --build
```

`--build` rebuilds the `prices` image. The build copies only `price_service/` and
`renderer/public/data/namespaceMap.json` into the Python image. `Dockerfile.dockerignore` excludes every other path
from the build context. So a change to either path reaches the service only through this command. The `prices`
volume keeps the files across rebuilds, and `web` serves the last cycle's files while the new container runs its
first cycle.

## Check it

1. `docker compose --profile tunnel ps` lists all three containers as running. `prices` shows `health: starting`
   until a check finds an `index.json` younger than 7500 seconds, which on a first deploy means after the first
   cycle, and `healthy` from then on.
2. `docker compose logs prices` shows one line at the end of each cycle, with no warnings before it:

   ```text
   <date> <time> INFO wrote <leagues> leagues, 0 failed
   ```

3. On the machine, `curl -s http://localhost:8080/prices/index.json` shows a `generatedAt` from the last hour and
   `"failed": []`.
4. From anywhere, `curl -s https://kalandra.ashoal.com/prices/index.json` shows the same `generatedAt`, or the one
   before it for up to five minutes, the cache lifetime.
5. `curl -s -D - -o /dev/null https://kalandra.ashoal.com/prices/index.json` prints the response headers:
   `cache-control: public, max-age=300`, and Cloudflare's `cf-cache-status` reads `HIT` or `MISS`. `DYNAMIC` means
   Cloudflare does not cache the file: check the cache rule from setup step 3.

## When it fails

### `prices` is unhealthy

`index.json` has not been written for over two hours. Read `docker compose logs --tail 50 prices`:

- `ERROR cycle failed: https://poe.ninja/poe2/api/economy/leagues: <reason>`: the league list request failed and the
  service has no earlier copy of it, which is the case in the first cycle after a start. `HTTP <status>` is the
  status poe.ninja returned. A network error such as `URLError` or `TimeoutError` means the machine did not reach
  poe.ninja. The next cycle starts `PRICE_INTERVAL_MINUTES` after the failed one started. Do not restart the service
  to retry sooner.
- `ERROR cycle failed` followed by a Python traceback: the cycle ended on an error that is not a failed request,
  such as a failed disk write. The service keeps running, and the next cycle starts `PRICE_INTERVAL_MINUTES` after
  the failed one started, so the error sends no extra requests. `web` keeps serving the last files. Read the
  traceback. A full disk or a read-only volume needs no deploy: the next cycle writes the files once the volume is
  writable. For an error in the code, fix it with a test that replays the response, and deploy again.
- A Python traceback without `cycle failed`, and `docker compose ps` shows `prices` restarting: the process ends at
  start, before its first request, so the restarts send no requests. Read the traceback; the next case is the known
  one.
- `load_categories` or `SnapshotError: unsupported schemaVersion` in the traceback: the image's `namespaceMap.json`
  is not schema version 1, and the service stops at start, before any request
  ([price-service.md](../modules/price-service.md#namespacemapjson)).

### index.json lists failed leagues

`docker compose logs prices | grep skipped` shows one `WARNING league '<id>' skipped: <reason>` line per failed
league. A failed league keeps the file of its last good cycle, so the app shows older prices for it. One category
that fails with no earlier copy skips the whole league.

| Reason | Meaning | What to do |
| --- | --- | --- |
| `<url>: HTTP <status>` or `<url>: <error>` | a request failed and the service has no earlier copy of that URL | nothing; the next cycle sends the request again. If the same category fails in every cycle, compare its `type` with the categories on poe.ninja's PoE 2 economy pages, change or remove it in `namespaceMap.json` and deploy with `--build`. The app reads the same file, so the change also goes into the next app release |
| `no Currency category to take exchange rates from` | the image's `namespaceMap.json` has no entry with the type `Currency` and `cx: true` | restore the entry and deploy with `--build` |
| `exchange core in <currency> has no divine rate`, `exchange response has no core` or `exchange core needs rates, primary and secondary` | the league's `Currency` overview has no rates the service can convert | if it repeats in every cycle, poe.ninja's format changed: save the new response under `priceService/tests/fixtures/ninja/`, change `transform.py` and its tests, and deploy |
| `<type> overview is not an object` | poe.ninja returned JSON that is not an object | the same as the row above |
| `Out of range float values are not JSON compliant: inf` or `int too large to convert to float` | a value in one of the league's overviews becomes too large for a float in the conversion to divines | the same as the row above |
| `league id has no letters or digits: '<id>'` | the id gives no file name | nothing; the app gets a 404 for that league |

`WARNING using the last good copy of <url> (<reason>)` means a request failed and the service used the response from
an earlier cycle, so that category's prices are one cycle older. It needs action only when it repeats in every cycle.

### The app shows no prices

1. Request the league's file: `curl -s -o /dev/null -w '%{http_code}\n' https://kalandra.ashoal.com/prices/<file>`,
   where `<file>` is the league's file name ([price-service.md](../modules/price-service.md#the-files)).
2. `404`: the file does not exist. Check that `index.json` lists the league under `leagues`. A league that poe.ninja
   does not list, one past the first 12 it lists, and one that has failed in every cycle so far have no file.
3. A `5xx` status from Cloudflare, such as `502` or `530`: the request did not reach `web`. On the machine, run
   `curl -s http://localhost:8080/prices/index.json`. If that prints the file, the tunnel is down: read
   `docker compose --profile tunnel logs tunnel` and check `TUNNEL_TOKEN`. If it does not, `web` is down: read
   `docker compose logs web`.
4. `200`: the service side works. The app loads prices only for some leagues and logs a failed load to the
   renderer's console ([price-service.md](../modules/price-service.md#app-side)).

### Old prices after a fix

Cloudflare keeps a file for up to five minutes (`max-age=300`). An app in use loads its league's file again at most
every 31 minutes
([renderer-price-check.md](../modules/renderer-price-check.md#price-estimates-backgroundpricests-backgroundprice-sourcets)).
So a fixed file reaches an app in use at its next load, with no action on the app's side.

## Stop it

`docker compose --profile tunnel down` stops and removes the three containers and their network, and keeps the
`prices` volume. Cloudflare serves its cached copies for at most five more minutes. After that, until the next `up`,
every load of a price file fails: an app that already loaded prices keeps them, and an app that starts or changes
league shows no prices. `docker compose --profile tunnel down -v` also deletes the volume and every price file in it.
