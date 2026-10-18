# ADR-0009: The local server accepts requests only from its own page

**Status:** Accepted (2026-10-18)

## Context

The main process serves the renderer page, the `/config`, `/uploads` and `/proxy` routes and the `/events`
WebSocket on a local HTTP server ([ADR-0004](ADR-0004-process-boundary.md)). By default it listens on `127.0.0.1`
on a random port, and `--listen` can set a fixed port or every network interface. A client of `/events` can send
any `IpcEvent`, such as `CLIENT->MAIN::save-config`, which replaces `config.json`, and `/proxy` sends requests to
the trade site with the cookies of the built-in browser ([ADR-0005](ADR-0005-proxy-hosts-and-trade-rate-limits.md)).

Any web page open in the user's browser can send requests to `127.0.0.1`. Two ways reach the server from such a
page. The page can send them from its own origin; a browser sends that origin in the `Origin` header of every
WebSocket and of a `POST`. Or the page's site can make its own host name resolve to `127.0.0.1` (DNS rebinding), so
the browser treats the server as part of that site and sends the site's name in the `Host` header.

## Decision

**1. Every HTTP route is a listener on `httpRoutes`, never on the server.** `server` in `main/src/server.ts` passes
a request to `httpRoutes` only after `isAllowedRequest()` in `main/src/request-origin.ts` accepts its headers, and
returns 403 otherwise. `addFileUploadRoutes()` and `HttpProxy` take `httpRoutes`. Reason: one check in front of
every route, so a new route cannot be added without it.

**2. The `Host` header must be `localhost` or an IP address.** Reason: a rebound host name always arrives as a
name, while the overlay opens `http://localhost:<port>` and a device on the network opens the computer's IP address.

**3. The `Origin` header must match `Host`, with the `http:` scheme.** A WebSocket upgrade without `Origin` gets
403; a plain HTTP request without it passes. Reason: a browser sends `Origin` with every WebSocket, but
not with a navigation or an image, and the page's own `GET` requests need not send it. A request that does send a
foreign origin comes from another site.

**4. A file route serves only the files inside its folder.** `sendFile()` in `main/src/served-file.ts` serves the
static files and `GET /uploads/`, and returns 404 for a missing file and for a path that `resolveInside()` finds outside
the folder. Reason: Node passes `req.url` on as sent, so `..` segments from a program other than a browser reach
the route.

## Consequences

- A device on the network opens the page at the computer's IP address, never at a host name such as
  `computer.local`. [docs/cmd-flags.md](../../cmd-flags.md) says so.
- A development run still works: Vite's proxy in `renderer/vite.config.mts` keeps the browser's `Host`, so the
  page at `localhost:5173` sends a matching `Origin` and `Host`.
- The check does not stop a program on the same computer, which can send any headers. It stops web pages.
- `main/specs/server.test.ts` starts the server and sends requests with a foreign `Origin`, without one, and with a
  host name, to the HTTP routes and to `/events`.

## Alternatives rejected

- **A secret token in the page URL.** Every client, including a browser on another device, would need it, and
  the `Host` and `Origin` checks need no setup.
- **A check in each route.** A new route without it would accept every page again (decision 1).

## Related

- [modules/main.md](../modules/main.md): `server.ts`, `request-origin.ts` and `served-file.ts`.
- [architecture.md](../architecture.md#the-boundary-between-the-processes): the routes.
