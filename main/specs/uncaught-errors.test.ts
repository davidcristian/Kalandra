import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { Logger } from "../src/RemoteLogger";
import { logUncaughtErrors } from "../src/uncaught-errors";
import { FakeServer } from "./fake-server";

/** Returns the log entries written after `events` emits `name` with `reason`, without their time. */
function logFor(
  name: "uncaughtException" | "unhandledRejection",
  reason: unknown,
): string[] {
  // Stands in for process, which emits both events
  const events = new EventEmitter();
  const server = new FakeServer();
  logUncaughtErrors(events, new Logger(server));
  events.emit(name, reason);
  return server
    .logEntries()
    .map((entry) => entry.replace(/^\[[^\]]*\] /, "").replace(/\n$/, ""));
}

describe("logUncaughtErrors", () => {
  it.each(["uncaughtException", "unhandledRejection"] as const)(
    "logs the stack of an Error for %s",
    (name) => {
      const error = new TypeError("Cannot read properties of undefined");

      expect(logFor(name, error)).toEqual([`error [${name}] ${error.stack}`]);
    },
  );

  it("logs the name and message of an Error without a stack", () => {
    const error = new RangeError("Invalid array length");
    error.stack = undefined;

    expect(logFor("unhandledRejection", error)).toEqual([
      "error [unhandledRejection] RangeError: Invalid array length",
    ]);
  });

  it.each([
    ["a string", "timed out", "'timed out'"],
    ["a number", 404, "404"],
    ["undefined", undefined, "undefined"],
    ["null", null, "null"],
    ["an object", { code: "ECONNRESET" }, "{ code: 'ECONNRESET' }"],
  ])("logs a rejection with %s", (_kind, reason, text) => {
    expect(logFor("unhandledRejection", reason)).toEqual([
      `error [unhandledRejection] ${text}`,
    ]);
  });

  it("logs a thrown value that is not an Error", () => {
    expect(logFor("uncaughtException", "the game window closed")).toEqual([
      "error [uncaughtException] 'the game window closed'",
    ]);
  });
});
