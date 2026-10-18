# The /events WebSocket accepts a connection from any origin

**Status:** done 2026-10-18
**Area:** main
**Origin:** [main/src/server.ts](../../../../main/src/server.ts)
**Verified:** 2026-10-18

The `upgrade` handler in `main/src/server.ts` accepts every WebSocket upgrade whose `req.url` is
`/events` and does not read the `Origin` header. A browser sends the origin of the page that opens
a WebSocket in that header, so the header is how a server tells its own page apart from another web
page. Without the check, a page in the user's browser that finds the port can connect. The port is
random by default and fixed by `--listen=:<port>` ([docs/cmd-flags.md](../../../cmd-flags.md)).

A connected client can send any `IpcEvent`. `CLIENT->MAIN::save-config` makes `ConfigStore` write
its `contents` to `config.json` and send them to every client as `MAIN->CLIENT::config-changed`,
which the overlay applies. On a new connection main also sets `lastActiveClient` to it and sends it
the log history. The events main sends to the last active client, such as
`MAIN->CLIENT::item-text`, then go to that client until the overlay sends
`CLIENT->MAIN::used-recently`.

Done looks like: the upgrade handler accepts only an `Origin` whose host and port match the
request's `Host` header, which covers the overlay at `localhost` and a browser on another device
with `--listen=0.0.0.0`. A match alone does not stop DNS rebinding, where a page's own host name
resolves to `127.0.0.1` and its `Origin` and `Host` match, so the handler also accepts only a
`Host` that is `localhost` or an IP address. A test covers an accepted and a rejected origin.
`main/` has no test runner yet, and [008](008-listen-option-without-value.md) decides where its
tests run. The HTTP routes (`/config`, `/uploads`, `/proxy`) have the same question, and this task
decides them too or files a task for them.

## History

- 2026-10-18: Found while the main module doc was written, by reading the `upgrade` and
  `connection` handlers. A copy of the `upgrade` handler in a scratch Node 24 script with `ws`
  8.18.0 accepted an upgrade sent with `Origin: https://evil.example`. Not tried against a running
  app or a browser.
- 2026-10-18: Closed, the HTTP routes included. `isAllowedRequest()` in
  `main/src/request-origin.ts` accepts a `Host` that is `localhost` or an IP address and an
  `Origin` that matches it, required on a WebSocket. Every route now listens on `httpRoutes`
  behind that check ([ADR-0009](../../adr/ADR-0009-local-server-accepts-only-its-own-page.md)).
  `main/specs/server.test.ts` sends foreign origins and host names to the real server.
