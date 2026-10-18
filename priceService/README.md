# Price service

Builds the price files Kalandra reads, from poe.ninja's PoE 2 economy API, once an hour by default, and serves them at
`https://kalandra.ashoal.com/prices/`. poe.ninja asks apps to use their own backend instead of calling its API from
every player's machine ([its API page](https://poe.ninja/docs/api)), so the app reads these files and sends no request
to poe.ninja's API.

Python 3.12 or newer, standard library only.

- What it writes, the file format, why its key order matters and how it treats poe.ninja:
  [docs/dev/modules/price-service.md](../docs/dev/modules/price-service.md).
- Deploying it with Docker Compose, checking it and fixing a failed deploy:
  [docs/dev/runbooks/price-service-deploy.md](../docs/dev/runbooks/price-service-deploy.md).

## Test

From this folder:

```bash
python -m unittest discover -s tests -v
```

The tests replay saved poe.ninja responses from `tests/fixtures/ninja/` and send no request to poe.ninja. CI runs
them in the `price-service` job of `.github/workflows/test.yml`. `renderer/specs/web/prices.test.ts` reads
`tests/fixtures/price_file.json` and `tests/fixtures/league_files.json` too, so after a change to the file format, also
run `npx vitest run` in `renderer/`.

## Run

From this folder:

```bash
PRICE_OUTPUT_DIR=/tmp/prices PRICE_NAMESPACE_MAP=../renderer/public/data/namespaceMap.json python -m price_service --once
```

A cycle requests poe.ninja's league list and every category of each league, then writes the files. `--once` runs one
cycle and exits. Without it, the service runs a cycle every `PRICE_INTERVAL_MINUTES` until it is stopped. A cycle
sends up to 277 requests to poe.ninja
([how it treats poe.ninja](../docs/dev/modules/price-service.md#how-it-treats-poeninja)), so ask the maintainer
before a live run, and never run it in a loop.

## Configure

The service reads environment variables once, at start. The variables and their defaults are listed in
[the module doc](../docs/dev/modules/price-service.md#environment). In Docker, the image sets `PRICE_OUTPUT_DIR` and
`PRICE_NAMESPACE_MAP`, and `compose.yaml` takes `PRICE_CONTACT` and `TUNNEL_TOKEN` from the shell or from
`priceService/.env`, which git ignores.
