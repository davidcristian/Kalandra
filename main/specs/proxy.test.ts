import type { AddressInfo } from "net";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { HttpProxy } from "../src/proxy";
import { Logger } from "../src/RemoteLogger";
import { httpRoutes, server } from "../src/server";
import { get, getHeaders, post } from "./request";

type ResponseHeaders = Record<string, string[]> | undefined;
type HeadersReceived = (
  details: { responseHeaders?: ResponseHeaders },
  next: (response: { responseHeaders?: ResponseHeaders }) => void,
) => void;

const electron = vi.hoisted(() => ({
  forwarded: [] as string[],
  headersReceived: undefined as HeadersReceived | undefined,
}));

// net.request answers every request with the options it was given and the body it received, in place
// of the remote host. A path that ends in /plain-request or /plain-response gets an object that is
// not a stream, one that ends in /fails gets the error Electron emits when the connection fails, and
// one that ends in /sets-cookie gets a response that sets a cookie.
vi.mock("electron", async () => {
  const { EventEmitter } = await import("node:events");
  const { Readable, Writable } = await import("node:stream");
  return {
    app: { userAgentFallback: "kalandra-test" },
    session: {
      defaultSession: {
        webRequest: {
          onHeadersReceived: (listener: HeadersReceived) => {
            electron.headersReceived = listener;
          },
        },
      },
    },
    net: {
      request: (options: { url: string }) => {
        electron.forwarded.push(options.url);
        if (options.url.endsWith("/plain-request")) return new EventEmitter();
        let body = "";
        const request = new Writable({
          write: (chunk: Buffer, _encoding, done) => {
            body += chunk.toString("utf-8");
            done();
          },
        });
        request.on("finish", () => {
          if (options.url.endsWith("/fails")) {
            request.emit("error", new Error("net::ERR_CONNECTION_RESET"));
            return;
          }
          const headers = options.url.endsWith("/sets-cookie")
            ? {
                "set-cookie": ["POESESSID=from-site; Path=/; Secure; HttpOnly"],
                "x-rate-limit-rules": "Ip",
              }
            : {};
          const head = { statusCode: 200, statusMessage: "OK", headers };
          const response = options.url.endsWith("/plain-response")
            ? Object.assign(new EventEmitter(), head)
            : Object.assign(
                Readable.from([JSON.stringify({ ...options, body })]),
                head,
              );
          request.emit("response", response);
        });
        return request;
      },
    },
  };
});

interface ForwardedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  useSessionCookies: boolean;
  body: string;
}

const logger = new Logger({
  onEventAnyClient: () => undefined,
  sendEventTo: () => undefined,
});
let port = 0;

beforeAll(async () => {
  // eslint-disable-next-line no-new -- the proxy adds its route to the emitter it receives
  new HttpProxy(httpRoutes, logger);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  port = (server.address() as AddressInfo).port;
});

beforeEach(() => {
  electron.forwarded.length = 0;
});

afterAll(() => {
  server.close();
});

const fetchPath = "/proxy/www.pathofexile.com/api/trade2/fetch/abc";
// Host.proxy in renderer/src/web/background/IPC.ts sends this header
const PROXY_HEADER = "x-kalandra-proxy";

describe("the /proxy route", () => {
  it("returns 403 for a request without the proxy header", async () => {
    expect(await get(port, fetchPath)).toEqual({ status: 403, body: "" });
    expect(electron.forwarded).toEqual([]);
  });

  it("returns 403 for the GET an image or a link on another site sends", async () => {
    const reply = await get(port, fetchPath, {
      "sec-fetch-site": "cross-site",
      "sec-fetch-mode": "no-cors",
      "sec-fetch-dest": "image",
    });
    expect(reply).toEqual({ status: 403, body: "" });
  });

  it("forwards a request with the header to the host, with the session's cookies", async () => {
    const reply = await get(port, fetchPath, {
      [PROXY_HEADER]: "1",
      "sec-fetch-site": "same-origin",
      "accept": "application/json",
    });
    expect(reply.status).toBe(200);
    const forwarded = JSON.parse(reply.body) as ForwardedRequest;
    expect(forwarded.url).toBe(
      "https://www.pathofexile.com/api/trade2/fetch/abc",
    );
    expect(forwarded.method).toBe("GET");
    expect(forwarded.useSessionCookies).toBe(true);
    expect(forwarded.headers).toMatchObject({
      "accept": "application/json",
      "user-agent": "kalandra-test",
    });
    expect(Object.keys(forwarded.headers)).not.toContain(PROXY_HEADER);
    expect(Object.keys(forwarded.headers)).not.toContain("sec-fetch-site");
    expect(Object.keys(forwarded.headers)).not.toContain("host");
  });

  it("sends the session's cookies to the trade site and never the page's own cookies", async () => {
    const reply = await get(port, fetchPath, {
      [PROXY_HEADER]: "1",
      cookie: "POESESSID=page-copy",
    });

    const forwarded = JSON.parse(reply.body) as ForwardedRequest;
    expect(forwarded.useSessionCookies).toBe(true);
    expect(Object.keys(forwarded.headers)).not.toContain("cookie");
  });

  it("sends no cookies to kalandra.ashoal.com, which is not a trade site", async () => {
    const reply = await get(port, "/proxy/kalandra.ashoal.com/api", {
      [PROXY_HEADER]: "1",
      cookie: "POESESSID=page-copy",
    });

    const forwarded = JSON.parse(reply.body) as ForwardedRequest;
    expect(forwarded.url).toBe("https://kalandra.ashoal.com/api");
    expect(forwarded.useSessionCookies).toBe(false);
    expect(Object.keys(forwarded.headers)).not.toContain("cookie");
  });

  it("returns the response headers of the host without its Set-Cookie", async () => {
    const reply = await getHeaders(
      port,
      "/proxy/www.pathofexile.com/sets-cookie",
      { [PROXY_HEADER]: "1" },
    );

    expect(reply.status).toBe(200);
    expect(reply.headers["x-rate-limit-rules"]).toBe("Ip");
    expect(Object.keys(reply.headers)).not.toContain("set-cookie");
  });

  it("forwards the body of a POST without its content-length and origin", async () => {
    const query = JSON.stringify({ query: { status: { option: "online" } } });
    const reply = await post(port, "/proxy/kalandra.ashoal.com/search", query, {
      [PROXY_HEADER]: "1",
      "content-type": "application/json",
      "origin": `http://127.0.0.1:${port}`,
    });

    const forwarded = JSON.parse(reply.body) as ForwardedRequest;
    expect(forwarded.method).toBe("POST");
    expect(forwarded.body).toBe(query);
    expect(forwarded.headers["content-type"]).toBe("application/json");
    expect(Object.keys(forwarded.headers)).not.toContain("content-length");
    expect(Object.keys(forwarded.headers)).not.toContain("origin");
  });

  it.each([
    "evil.example",
    "www.poeprices.info",
    "pathofexile.com",
    "www.pathofexile.com.evil.example",
    "www.pathofexile.com:443",
    "www.pathofexile.com@evil.example",
    "WWW.PATHOFEXILE.COM",
  ])(
    "closes a request with the header for %s, which is not in the list as written",
    async (host) => {
      await expect(
        get(port, `/proxy/${host}/api`, { [PROXY_HEADER]: "1" }),
      ).rejects.toThrow();
      expect(electron.forwarded).toEqual([]);
    },
  );

  it("leaves /proxy without a host to the other routes", async () => {
    const reply = await get(port, "/proxy", { [PROXY_HEADER]: "1" });
    expect(reply.status).toBe(404);
    expect(electron.forwarded).toEqual([]);
  });

  it("closes the response and logs it when net.request returns no writable stream", async () => {
    await expect(
      get(port, "/proxy/www.pathofexile.com/plain-request", {
        [PROXY_HEADER]: "1",
      }),
    ).rejects.toThrow();
    expect(logger.history).toContain(
      "error [proxy] the request is not a writable stream (www.pathofexile.com)",
    );
  });

  it("closes the response and logs it when the remote response is no readable stream", async () => {
    await expect(
      get(port, "/proxy/www.pathofexile.com/plain-response", {
        [PROXY_HEADER]: "1",
      }),
    ).rejects.toThrow();
    expect(logger.history).toContain(
      "error [proxy] the response is not a readable stream (www.pathofexile.com)",
    );
  });

  it("closes the response and logs it when the connection to the host fails", async () => {
    await expect(
      get(port, "/proxy/www.pathofexile.com/fails", { [PROXY_HEADER]: "1" }),
    ).rejects.toThrow();
    expect(logger.history).toContain(
      "error [proxy] net::ERR_CONNECTION_RESET (www.pathofexile.com)",
    );
  });
});

describe("the request check in front of /proxy", () => {
  it("returns 403 and forwards nothing for a host name, which DNS rebinding sends", async () => {
    const reply = await get(port, fetchPath, {
      [PROXY_HEADER]: "1",
      host: `evil.example:${port}`,
    });
    expect(reply.status).toBe(403);
    expect(electron.forwarded).toEqual([]);
  });

  it("returns 403 and forwards nothing for a request from another origin", async () => {
    const reply = await post(port, fetchPath, "{}", {
      [PROXY_HEADER]: "1",
      origin: "http://evil.example",
    });
    expect(reply.status).toBe(403);
    expect(electron.forwarded).toEqual([]);
  });
});

/** Passes response headers through the listener the proxy adds to the default session. */
function receiveHeaders(responseHeaders: ResponseHeaders): ResponseHeaders {
  let passed: ResponseHeaders;
  electron.headersReceived?.({ responseHeaders }, (response) => {
    passed = response.responseHeaders;
  });
  return passed;
}

describe("the cookies of the default session", () => {
  it("removes the Partitioned attribute from each cookie a response sets", () => {
    const headers = receiveHeaders({
      "set-cookie": [
        "session=abc; Path=/; Secure; Partitioned",
        "cf_clearance=xyz; partitioned ; HttpOnly",
        "plain=1",
      ],
      "content-type": ["text/html"],
    });

    expect(headers).toEqual({
      "set-cookie": [
        "session=abc; Path=/; Secure",
        "cf_clearance=xyz; HttpOnly",
        "plain=1",
      ],
      "content-type": ["text/html"],
    });
  });

  it("passes on the headers of a response that sets no cookie", () => {
    expect(receiveHeaders({ "content-type": ["text/html"] })).toEqual({
      "content-type": ["text/html"],
    });
    expect(receiveHeaders(undefined)).toBeUndefined();
  });
});
