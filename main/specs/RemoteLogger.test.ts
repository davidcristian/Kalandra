import { describe, expect, it } from "vitest";
import { HISTORY_ENTRIES, Logger, logRejection } from "../src/RemoteLogger";
import { FakeServer } from "./fake-server";

function writeEntries(count: number) {
  const server = new FakeServer();
  const logger = new Logger(server);
  for (let i = 0; i < count; i++) {
    logger.write(`info entry ${i}`);
  }
  return { server, logger };
}

const historyLines = (logger: Logger) =>
  logger.history
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => line.replace(/^\[[^\]]*\] /, ""));

describe("Logger", () => {
  it("keeps every entry in its history, oldest first, up to the limit", () => {
    const { logger } = writeEntries(HISTORY_ENTRIES);

    const lines = historyLines(logger);
    expect(lines).toHaveLength(HISTORY_ENTRIES);
    expect(lines[0]).toBe("info entry 0");
    expect(lines.at(-1)).toBe(`info entry ${HISTORY_ENTRIES - 1}`);
  });

  it("drops the oldest entries from its history past the limit", () => {
    const { logger } = writeEntries(HISTORY_ENTRIES + 5);

    const lines = historyLines(logger);
    expect(lines).toHaveLength(HISTORY_ENTRIES);
    expect(lines[0]).toBe("info entry 5");
    expect(lines.at(-1)).toBe(`info entry ${HISTORY_ENTRIES + 4}`);
  });

  it("sends every entry to the pages, including the ones the history dropped", () => {
    const { server } = writeEntries(HISTORY_ENTRIES + 5);

    const entries = server.logEntries();
    expect(entries).toHaveLength(HISTORY_ENTRIES + 5);
    expect(entries[0]).toMatch(/\] info entry 0\n$/);
  });
});

describe("logRejection", () => {
  it("logs the message of an Error and the text of any other value", () => {
    const logger = new Logger(new FakeServer());
    const logFailedOpen = logRejection(logger, "AppTray", "open the folder");

    logFailedOpen(new Error("access is denied"));
    logFailedOpen("no handler");

    expect(historyLines(logger)).toEqual([
      "error [AppTray] Cannot open the folder: access is denied",
      "error [AppTray] Cannot open the folder: no handler",
    ]);
  });
});
