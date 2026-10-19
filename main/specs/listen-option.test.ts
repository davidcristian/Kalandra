import { createServer, type Server } from "http";
import type { AddressInfo } from "net";
import { afterEach, describe, expect, it } from "vitest";
import { listenWithFallback, readListenOption } from "../src/listen-option";
import { get } from "./request";

const defaults = { host: "127.0.0.1", port: 0 };
const read = (...argv: string[]) =>
  readListenOption(["electron", "main.js", ...argv], defaults);

describe("readListenOption", () => {
  it("uses the defaults without the option", () => {
    expect(read()).toEqual({ address: defaults });
  });

  it("reads a port, a host, or both", () => {
    expect(read("--listen=:9001").address).toEqual({
      host: "127.0.0.1",
      port: 9001,
    });
    expect(read("--listen=0.0.0.0").address).toEqual({
      host: "0.0.0.0",
      port: 0,
    });
    expect(read("--listen=0.0.0.0:9001").address).toEqual({
      host: "0.0.0.0",
      port: 9001,
    });
    expect(read("--listen=[::1]:9001").address).toEqual({
      host: "::1",
      port: 9001,
    });
  });

  it("uses the defaults for an empty value", () => {
    expect(read("--listen=")).toEqual({ address: defaults });
  });

  it("reports --listen without a value instead of throwing", () => {
    for (const argv of [["--listen"], ["--listen", "0.0.0.0"]]) {
      const option = read(...argv);
      expect(option.address).toEqual(defaults);
      expect(option.error).toMatch(/after =/);
    }
  });

  it("reports a value it cannot read", () => {
    for (const arg of ["--listen=::1", "--listen=:abc", "--listen=:70000"]) {
      const option = read(arg);
      expect(option.address).toEqual(defaults);
      expect(option.error).toBeDefined();
    }
  });

  it("ignores other options that start with --listen", () => {
    expect(read("--listener=x")).toEqual({ address: defaults });
  });
});

describe("listenWithFallback", () => {
  const servers: Server[] = [];
  const fallbackErrors: Error[] = [];
  const newServer = () => {
    const server = createServer((_req, res) => res.end("page"));
    servers.push(server);
    return server;
  };
  const listenOn = async (address: { host: string; port: number }) =>
    await listenWithFallback(newServer(), address, defaults, (error) => {
      fallbackErrors.push(error);
    });

  async function takenPort() {
    const blocker = newServer();
    await new Promise<void>((resolve) => {
      blocker.listen(0, "127.0.0.1", resolve);
    });
    return (blocker.address() as AddressInfo).port;
  }

  afterEach(() => {
    for (const server of servers.splice(0)) server.close();
    fallbackErrors.splice(0);
  });

  it("listens on a free address", async () => {
    const port = await listenOn({ host: "127.0.0.1", port: 0 });

    expect(port).toBeGreaterThan(0);
    expect(fallbackErrors).toEqual([]);
  });

  it("listens on the fallback when the port is in use, and serves there", async () => {
    const taken = await takenPort();
    const port = await listenOn({ host: "127.0.0.1", port: taken });

    expect(port).not.toBe(taken);
    expect(fallbackErrors).toEqual([
      expect.objectContaining({ code: "EADDRINUSE" }),
    ]);
    expect(await get(port, "/")).toEqual({ status: 200, body: "page" });
  });

  it("listens on the fallback for a host this computer does not have", async () => {
    // 192.0.2.0/24 is reserved for documentation, so no computer has an address in it
    const port = await listenOn({ host: "192.0.2.1", port: 0 });

    expect(port).toBeGreaterThan(0);
    expect(fallbackErrors).toEqual([
      expect.objectContaining({ code: "EADDRNOTAVAIL" }),
    ]);
  });

  it("rejects when the fallback itself fails", async () => {
    const taken = await takenPort();
    const fallback = { host: "127.0.0.1", port: taken };
    const result = listenWithFallback(newServer(), fallback, fallback, (e) => {
      fallbackErrors.push(e);
    });

    await expect(result).rejects.toMatchObject({ code: "EADDRINUSE" });
    expect(fallbackErrors).toEqual([]);
  });
});
