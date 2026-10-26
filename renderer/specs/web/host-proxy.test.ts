import {
  afterEach,
  beforeAll,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from "vitest";
import type * as IPC from "@/web/background/IPC";

// Answers every fetch with the URL and headers it received, as main's /proxy route would see them
async function echoFetch(input: RequestInfo | URL, init?: RequestInit) {
  const headers = Object.fromEntries(new Headers(init?.headers));
  return new Response(JSON.stringify({ url: String(input), headers }));
}

interface Echo {
  url: string;
  headers: Record<string, string>;
}

let Host: typeof IPC.Host;

// Vue reads document on import when window exists, so the stub comes after the import
beforeAll(async () => {
  ({ Host } = await vi.importActual<typeof IPC>("@/web/background/IPC"));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Host.proxy", () => {
  it("fetches /proxy/<host>/<path> with the header main's /proxy route needs", async () => {
    vi.stubGlobal("window", { fetch: echoFetch });
    const response = await Host.proxy("www.pathofexile.com/api/trade2/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const echo = (await response.json()) as Echo;

    expect(echo.url).toBe("/proxy/www.pathofexile.com/api/trade2/data");
    expect(echo.headers).toEqual({
      "content-type": "application/json",
      "x-kalandra-proxy": "1",
    });
  });

  it("sends the header when the caller gives no options", async () => {
    vi.stubGlobal("window", { fetch: echoFetch });
    const response = await Host.proxy("www.poeprices.info/api?l=Standard");
    const echo = (await response.json()) as Echo;

    expect(echo.headers).toEqual({ "x-kalandra-proxy": "1" });
  });

  it("takes the host and path as a string, the only input it can forward", () => {
    expectTypeOf(Host.proxy).parameter(0).toEqualTypeOf<string>();
  });
});
