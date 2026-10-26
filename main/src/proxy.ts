import type { HttpRoutes } from "./server";
import { app, net, session } from "electron";
import { Readable, Writable } from "stream";
import type { Logger } from "./RemoteLogger";

// An official trade site gets the session's cookies, which hold the sign-in and the bot check passed in the
// built-in browser; no other host needs them
const PROXY_HOSTS = [
  { host: "www.pathofexile.com", official: true },
  { host: "ru.pathofexile.com", official: true },
  { host: "pathofexile.tw", official: true },
  { host: "poe.kakaogames.com", official: true },
  { host: "jp.pathofexile.com", official: true },
  { host: "de.pathofexile.com", official: true },
  { host: "es.pathofexile.com", official: true },
  { host: "br.pathofexile.com", official: true },
  { host: "fr.pathofexile.com", official: true },
  // Kalandra's price files; poe.ninja asks apps to use their own backend
  { host: "kalandra.ashoal.com", official: false },
];

// A page on another site cannot send this header: a fetch that sets it needs a
// CORS preflight, which the Origin check rejects, and an image, a script or a link sends none
const PROXY_HEADER = "x-kalandra-proxy";

/** Returns whether `url` is an `https:` address on one of the official trade sites. */
export function isTradeSiteUrl(url: string): boolean {
  const parsed = URL.parse(url);
  return (
    parsed?.protocol === "https:" &&
    PROXY_HOSTS.some((entry) => entry.official && entry.host === parsed.host)
  );
}

// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- the class only adds the proxy route in its constructor
export class HttpProxy {
  constructor(routes: HttpRoutes, logger: Logger) {
    routes.addListener("request", (req, res) => {
      if (!req.url?.startsWith("/proxy/")) return;
      if (req.headers[PROXY_HEADER] === undefined) {
        res.statusCode = 403;
        res.end();
        return;
      }
      const host = req.url.split("/", 3)[2];

      const official = PROXY_HOSTS.find(
        (entry) => entry.host === host,
      )?.official;
      if (official === undefined) return req.destroy();

      for (const key in req.headers) {
        if (
          key.startsWith("sec-") ||
          key === "host" ||
          key === "origin" ||
          key === "content-length" ||
          // The page's cookies are those of Kalandra's server, which no remote host needs
          key === "cookie" ||
          key === PROXY_HEADER
        ) {
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- the loop removes the headers the remote host must not receive
          delete req.headers[key];
        }
      }

      const proxyReq = net.request({
        url: "https://" + req.url.slice("/proxy/".length),
        method: req.method,
        headers: {
          ...req.headers,
          "user-agent": app.userAgentFallback,
        },
        useSessionCookies: official,
        referrerPolicy: "no-referrer-when-downgrade",
      });
      // Electron's request and response extend Node's streams, which its types do not declare
      if (!(proxyReq instanceof Writable)) {
        logger.write(
          `error [proxy] the request is not a writable stream (${host})`,
        );
        res.destroy();
        return;
      }
      proxyReq.addListener("response", (proxyRes) => {
        try {
          if (!(proxyRes instanceof Readable)) {
            throw new Error("the response is not a readable stream");
          }
          const resHeaders = { ...proxyRes.headers };
          delete resHeaders["content-encoding"];
          // The page would store a remote host's cookie as one of Kalandra's server and send it to every host
          delete resHeaders["set-cookie"];
          res.writeHead(
            proxyRes.statusCode,
            proxyRes.statusMessage,
            resHeaders,
          );
          proxyRes.pipe(res);
        } catch (error) {
          logger.write(`error [proxy] ${(error as Error).message} (${host})`);
          res.destroy();
        }
      });
      proxyReq.addListener("error", (err) => {
        logger.write(`error [proxy] ${err.message} (${host})`);
        res.destroy(err);
      });

      req.pipe(proxyReq);
    });
    session.defaultSession.webRequest.onHeadersReceived((details, next) => {
      // Cloudflare sets cookies with Partitioned attribute, however `net.request` API
      // doesn't provide a way to specify partition key, so we simply remove it.
      const headers = details.responseHeaders;
      const cookies = headers?.["set-cookie"];
      if (headers && cookies) {
        headers["set-cookie"] = cookies.map((cookie) => {
          return cookie
            .split(";")
            .filter((part) => part.trim().toLowerCase() !== "partitioned")
            .join(";");
        });
      }
      next({ responseHeaders: headers });
    });
  }
}
