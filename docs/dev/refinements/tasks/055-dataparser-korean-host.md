# dataParser uses a different Korean trade host from the app

**Status:** open
**Area:** dataparser
**Origin:** [dataParser/src/constants/urls.py](../../../../dataParser/src/constants/urls.py)
**Verified:** 2026-10-18

`LANG_URLS` in `dataParser/src/constants/urls.py` sends the Korean trade data requests to
`https://poe.game.daum.net`. The app uses `poe.kakaogames.com` for Korean: `poeWebApi()` in
`renderer/src/web/Config.ts`, `tradeUrl` in `renderer/src/web/settings/general.vue` and
`PROXY_HOSTS` in `main/src/proxy.ts`.

The app used `poe.game.daum.net` too until 17 Jun 2026. On that day Exiled Exchange 2 changed those
three files to `poe.kakaogames.com` in a commit about the Korean server migration, and did not
change `urls.py`. Agents send no request to a trade site, so whether the old host still serves the
trade data is not checked.

Done looks like: `LANG_URLS` sends the Korean requests to `https://poe.kakaogames.com`, the host
the app uses. The maintainer checks the Korean files the next time a `--pull` runs.

## History

- 2026-10-18: Found while the dataParser module doc was written, by comparing the hosts in the tool
  and the app.
