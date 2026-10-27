import { describe, expect, it } from "vitest";
import { Logger } from "../src/RemoteLogger";
import {
  logRendererEntries,
  RENDERER_LOG_CHARS,
  rendererLogLine,
} from "../src/renderer-log";
import { FakeServer } from "./fake-server";

// Sends the entry as a page would, and returns the lines main's log broadcast without their time
async function linesLoggedFor(message: string): Promise<string[]> {
  const server = new FakeServer();
  logRendererEntries(server, new Logger(server));
  await server.emit("CLIENT->MAIN::log-entry", { level: "warn", message });
  return server.logEntries().map((line) => line.replace(/^\[[^\]]*\] /, ""));
}

describe("a log entry from the page", () => {
  it("is written to main's log with its level under the renderer area", async () => {
    expect(
      await linesLoggedFor(
        "Loading prices failed: No price file for Standard (404)",
      ),
    ).toEqual([
      "warn [renderer] Loading prices failed: No price file for Standard (404)\n",
    ]);
  });

  it("is written as its first line only", async () => {
    expect(
      await linesLoggedFor(
        "Loading prices failed\r\nset-cookie: a=1\n[12:00:00] error [server] other",
      ),
    ).toEqual(["warn [renderer] Loading prices failed\n"]);
  });

  it("is cut to the character limit", async () => {
    const [line] = await linesLoggedFor("x".repeat(RENDERER_LOG_CHARS + 1));
    expect(line).toBe(`warn [renderer] ${"x".repeat(RENDERER_LOG_CHARS)}...\n`);
  });

  it("keeps a line at the character limit whole", async () => {
    const [line] = await linesLoggedFor("x".repeat(RENDERER_LOG_CHARS));
    expect(line).toBe(`warn [renderer] ${"x".repeat(RENDERER_LOG_CHARS)}\n`);
  });

  it.each([
    ["no payload", null],
    ["an unknown level", { level: "debug", message: "text" }],
    ["a message that is not text", { level: "error", message: 404 }],
    ["no message", { level: "info" }],
  ])("with %s is replaced by a warning", (_case, entry) => {
    expect(rendererLogLine(entry)).toBe(
      "warn [renderer] Ignored a log entry without a known level and a text message",
    );
  });

  it.each(["error", "warn", "info"])("keeps the level %s", (level) => {
    expect(rendererLogLine({ level, message: "text" })).toBe(
      `${level} [renderer] text`,
    );
  });
});
