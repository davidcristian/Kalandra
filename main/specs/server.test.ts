import * as fs from "fs";
import * as path from "path";
import type { AddressInfo } from "net";
import { app } from "electron";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { addFileUploadRoutes } from "../src/host-files/file-uploads";
import { Logger } from "../src/RemoteLogger";
import { httpRoutes, server } from "../src/server";
import { FakeServer } from "./fake-server";
import { get, getHeaders, openSocket, sendMethod } from "./request";

vi.mock("electron", async () => {
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "kalandra-main-"));
  return { app: { getPath: () => userData, getVersion: () => "0.0.0" } };
});

const userData = app.getPath("userData");
let port = 0;

beforeAll(async () => {
  addFileUploadRoutes(httpRoutes, new Logger(new FakeServer()));
  const uploads = path.join(userData, "apt-data", "files");
  fs.mkdirSync(uploads, { recursive: true });
  fs.writeFileSync(path.join(uploads, "image.png"), "image");
  fs.writeFileSync(path.join(userData, "secret.txt"), "secret");
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  port = (server.address() as AddressInfo).port;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(() => {
  server.close();
  fs.rmSync(userData, { recursive: true, force: true });
});

describe("the uploads route", () => {
  it("serves a file in the uploads folder", async () => {
    expect(await get(port, "/uploads/image.png")).toEqual({
      status: 200,
      body: "image",
    });
  });

  it("returns 404 for a path outside the uploads folder", async () => {
    expect(await get(port, "/uploads/../../secret.txt")).toEqual({
      status: 404,
      body: "",
    });
  });

  it("returns 404 for a missing file", async () => {
    expect((await get(port, "/uploads/missing.png")).status).toBe(404);
  });
});

describe("the static file route", () => {
  it("serves a file from the folder of the server bundle", async () => {
    expect((await get(port, "/listen-option.ts")).status).toBe(200);
  });

  it("returns 404 for a path outside that folder", async () => {
    const reply = await get(port, "/../package.json");
    expect(reply.status).toBe(404);
    expect(reply.body).not.toContain("kalandra");
  });
});

describe("a request that no route serves", () => {
  it.each(["/configuration.js", "/config?x=1", "/uploads", "/proxy"])(
    "returns 404 for %s",
    async (urlPath) => {
      expect((await get(port, urlPath)).status).toBe(404);
    },
  );

  it.each(["PUT", "DELETE", "HEAD"])(
    "returns 405 and the allowed methods for %s under /uploads/",
    async (method) => {
      expect(await sendMethod(port, method, "/uploads/image.png")).toEqual({
        status: 405,
        allow: "GET, POST",
      });
    },
  );

  it("returns 404 for a renderer file in development, where Vite serves them", async () => {
    vi.stubEnv("VITE_DEV_SERVER_URL", "http://localhost:5173");
    expect((await get(port, "/listen-option.ts")).status).toBe(404);
  });
});

// A browser applies the first directive of a repeated name and ignores the others
function policyDirectives(
  header: string | string[] | undefined,
): Record<string, string[]> {
  const directives: Record<string, string[]> = {};
  if (typeof header !== "string") return directives;
  for (const directive of header.split(";")) {
    const [name, ...sources] = directive.trim().split(/\s+/);
    if (name && !(name in directives)) directives[name] = sources;
  }
  return directives;
}

describe("the Content-Security-Policy header", () => {
  it.each(["/", "/index.html", "/listen-option.ts", "/uploads/image.png"])(
    "is sent with %s",
    async (urlPath) => {
      const { headers } = await getHeaders(port, urlPath);
      expect(policyDirectives(headers["content-security-policy"])).toEqual({
        "default-src": ["'self'"],
        "script-src": ["'self'"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "img-src": ["'self'", "https://web.poecdn.com"],
        "font-src": ["'self'"],
        "connect-src": ["'self'"],
        "object-src": ["'none'"],
        "base-uri": ["'self'"],
        "frame-ancestors": ["'none'"],
      });
    },
  );
});

describe("the request check", () => {
  it("returns 403 for a request to a host name", async () => {
    const reply = await get(port, "/uploads/image.png", {
      host: `evil.example:${port}`,
    });
    expect(reply.status).toBe(403);
  });

  it("returns 403 for a request from another origin", async () => {
    const reply = await get(port, "/uploads/image.png", {
      origin: "http://evil.example",
    });
    expect(reply.status).toBe(403);
  });

  it("serves a request from the page's own origin", async () => {
    const reply = await get(port, "/uploads/image.png", {
      host: `localhost:${port}`,
      origin: `http://localhost:${port}`,
    });
    expect(reply.status).toBe(200);
  });
});

describe("the /events WebSocket", () => {
  it("accepts the page's own origin", async () => {
    const status = await openSocket(port, {
      host: `localhost:${port}`,
      origin: `http://localhost:${port}`,
    });
    expect(status).toBe(101);
  });

  it("returns 403 for another origin, no origin and a host name", async () => {
    expect(await openSocket(port, { origin: "http://evil.example" })).toBe(403);
    expect(await openSocket(port, {})).toBe(403);
    const rebound = await openSocket(port, {
      host: `evil.example:${port}`,
      origin: `http://evil.example:${port}`,
    });
    expect(rebound).toBe(403);
  });

  it("closes the connection of an upgrade to another path", async () => {
    const pageOrigin = {
      host: `localhost:${port}`,
      origin: `http://localhost:${port}`,
    };
    expect(await openSocket(port, pageOrigin, "/other")).toBe(0);
  });
});
