import { describe, expect, it } from "vitest";
import {
  isAllowedRequest,
  isLocalHost,
  isSameOrigin,
} from "../src/request-origin";

describe("isLocalHost", () => {
  it("accepts localhost and IP addresses, with or without a port", () => {
    for (const host of [
      "localhost:5173",
      "127.0.0.1",
      "127.0.0.1:9001",
      "192.168.1.20:9001",
      "[::1]:9001",
    ]) {
      expect(isLocalHost(host)).toBe(true);
    }
  });

  it("rejects host names, which DNS rebinding can point at 127.0.0.1", () => {
    for (const host of [
      "evil.example",
      "evil.example:9001",
      "127.0.0.1.nip.io:9001",
      "user@evil.example",
      "",
      undefined,
    ]) {
      expect(isLocalHost(host)).toBe(false);
    }
  });
});

describe("isSameOrigin", () => {
  it("accepts an http origin with the host and port of the request", () => {
    expect(isSameOrigin("http://localhost:9001", "localhost:9001")).toBe(true);
    expect(isSameOrigin("http://[::1]:9001", "[::1]:9001")).toBe(true);
  });

  it("rejects another host, port or scheme, and an unreadable origin", () => {
    for (const origin of [
      "http://evil.example",
      "http://localhost:9002",
      "https://localhost:9001",
      "null",
    ]) {
      expect(isSameOrigin(origin, "localhost:9001")).toBe(false);
    }
  });
});

describe("isAllowedRequest", () => {
  const host = "localhost:9001";

  it("needs a matching Origin on a WebSocket", () => {
    expect(
      isAllowedRequest({ host, origin: "http://localhost:9001" }, true),
    ).toBe(true);
    expect(isAllowedRequest({ host }, true)).toBe(false);
    expect(
      isAllowedRequest({ host, origin: "http://evil.example" }, true),
    ).toBe(false);
  });

  it("allows plain HTTP without Origin, but not with another one", () => {
    expect(isAllowedRequest({ host }, false)).toBe(true);
    expect(
      isAllowedRequest({ host, origin: "http://evil.example" }, false),
    ).toBe(false);
  });

  it("rejects a host name even when Origin matches it", () => {
    const rebound = {
      host: "evil.example:9001",
      origin: "http://evil.example:9001",
    };
    expect(isAllowedRequest(rebound, true)).toBe(false);
    expect(isAllowedRequest(rebound, false)).toBe(false);
  });
});
