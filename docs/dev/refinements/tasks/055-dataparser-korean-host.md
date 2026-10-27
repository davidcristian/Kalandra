# dataParser uses a different Korean trade host from the app

**Status:** done 2026-10-27
**Area:** dataparser
**Origin:** [dataParser/src/constants/urls.py](../../../../dataParser/src/constants/urls.py)
**Verified:** 2026-10-27

`LANG_URLS` in `dataParser/src/constants/urls.py` sends the Korean trade data requests to
`https://poe.game.daum.net`. The app uses `poe.kakaogames.com` for Korean: `tradeHost()` in
`renderer/src/web/trade-host.ts` and `PROXY_HOSTS` in `main/src/proxy.ts`.

The app used `poe.game.daum.net` too until 17 Jun 2026. On that day Exiled Exchange 2 changed the
app's hosts to `poe.kakaogames.com` in a commit about the Korean server migration, and did not
change `urls.py`. Agents send no request to a trade site, so whether the old host still serves the
trade data is not checked.

Done looks like: `LANG_URLS` sends the Korean requests to `https://poe.kakaogames.com`, the host
the app uses. The maintainer checks the Korean files the next time a `--pull` runs.

## History

- 2026-10-18: Found while the dataParser module doc was written, by comparing the hosts in the tool
  and the app.
- 2026-10-27: Done in `fix(dataparser): pull the Korean trade data from poe.kakaogames.com`. A
  unit test checks each language's host against `tradeHost()` in the app. No request was sent, so
  the maintainer checks the Korean files in `data/json/ko/` at the next `--pull`.
