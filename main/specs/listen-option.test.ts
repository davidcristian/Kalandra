import { describe, expect, it } from "vitest";
import { readListenOption } from "../src/listen-option";

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
