import { EventEmitter } from "events";
import { createServer, type IncomingMessage, type ServerResponse } from "http";
import type { AddressInfo } from "net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { HttpProxy } from "../src/proxy";
import { Logger } from "../src/RemoteLogger";
import type { HttpRoutes } from "../src/server";
import { get } from "./request";

// net.request answers every request with the options it was given, in place of the remote host
vi.mock("electron", async () => {
  const { Readable, Writable } = await import("node:stream");
  return {
    app: { userAgentFallback: "kalandra-test" },
    session: {
      defaultSession: { webRequest: { onHeadersReceived: () => undefined } },
    },
    net: {
      request: (options: object) => {
        const request = new Writable({
          write: (_chunk, _encoding, done) => {
            done();
          },
        });
        request.on("finish", () => {
          const response = Object.assign(
            Readable.from([JSON.stringify(options)]),
            { statusCode: 200, statusMessage: "OK", headers: {} },
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
}

const routes: HttpRoutes = new EventEmitter<{
  request: [IncomingMessage, ServerResponse];
}>();
const server = createServer((req, res) => routes.emit("request", req, res));
let port = 0;

beforeAll(async () => {
  new HttpProxy(
    routes,
    new Logger({
      onEventAnyClient: () => undefined,
      sendEventTo: () => undefined,
    }),
  );
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  port = (server.address() as AddressInfo).port;
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

  it("closes a request with the header for a host outside the list", async () => {
    await expect(
      get(port, "/proxy/evil.example/api", { [PROXY_HEADER]: "1" }),
    ).rejects.toThrow();
  });
});
