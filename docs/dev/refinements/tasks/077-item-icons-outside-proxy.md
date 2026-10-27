# Item icons load from web.poecdn.com outside the proxy

**Status:** declined 2026-10-27
**Area:** renderer
**Origin:** [ADR-0005](../../adr/ADR-0005-proxy-hosts-and-trade-rate-limits.md)
**Verified:** 2026-10-22

The `icon` of each item in `renderer/public/data/<lang>/items.ndjson` is a `https://web.poecdn.com/`
address or `%NOT_FOUND%`, and a trade listing's icon is `result.item.icon` from the trade site's
fetch response (`pathofexile-trade.ts`), which is on the same host in the saved responses under
`renderer/specs/`. `UiItemImg.vue` and the `<img>` tags of the item search, item editor, filter and
unidentified item components put these addresses in `src`, so the page requests them itself.
`HttpProxy` in `main/src/proxy.ts` never sees them, and `web.poecdn.com` is not in `PROXY_HOSTS`.
ADR-0005, AGENTS.md and [architecture.md](../../architecture.md) state this as an exception to the
rule that the renderer reaches other hosts only through `/proxy`.

This is a decision for the maintainer, with two outcomes:

- Keep the direct loads and the written exception.
- Load the icons through `/proxy`: add `web.poecdn.com` to `PROXY_HOSTS` and request
  `/proxy/web.poecdn.com/...` from the components. An `<img>` request sends no `x-kalandra-proxy`
  header, which `HttpProxy` requires
  ([ADR-0009](../../adr/ADR-0009-local-server-accepts-only-its-own-page.md)), so the icons need
  another way to pass that check.

Done looks like: the maintainer's choice is in this file's History, and the code, ADR-0005,
AGENTS.md and architecture.md match it.

## History

- 2026-10-22: Found by a search for `<img>` bindings and the hosts of the `icon` fields. Filed when
  ADR-0005 and AGENTS.md were corrected to name the item icons as an exception.
- 2026-10-27: Declined. The maintainer chose to keep the direct loads and the written exception. The
  icons come from a static image host, not the trade API that rate limits and bans clients, and
  loading them through `/proxy` needs another way past the check of ADR-0009.
