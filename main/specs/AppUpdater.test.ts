import { autoUpdater } from "electron-updater";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IpcEvent } from "../../ipc/types";
import { AppUpdater } from "../src/AppUpdater";
import { Logger } from "../src/RemoteLogger";
import { FakeServer } from "./fake-server";

const check = vi.hoisted(() => ({
  failure: undefined as Error | undefined,
  emitsError: true,
}));

// A check finds version 9.9.9 and, with autoDownload on, downloads it, as electron-updater does.
// With check.failure set, it emits the error and then rejects with it, as electron-updater does,
// or with check.emitsError false only rejects.
vi.mock("electron-updater", async () => {
  const { EventEmitter } = await import("node:events");
  class FakeAutoUpdater extends EventEmitter {
    autoDownload = true;

    async checkForUpdates() {
      this.emit("checking-for-update");
      if (check.failure) {
        if (check.emitsError) {
          this.emit("error", check.failure, String(check.failure.stack));
        }
        throw check.failure;
      }
      this.emit("update-available", { version: "9.9.9" });
      if (this.autoDownload) {
        this.emit("update-downloaded", { version: "9.9.9" });
      }
      return null;
    }

    quitAndInstall() {}
  }
  return { autoUpdater: new FakeAutoUpdater() };
});

const states = (sent: IpcEvent[]) =>
  sent.flatMap((event) =>
    event.name === "MAIN->CLIENT::updater-state" ? [event.payload.state] : [],
  );

const loggedLines = (logger: Logger) =>
  logger.history
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => line.replace(/^\[[^\]]*\] /, ""));

// The fake check rejects at once, so the updater has handled the rejection after the pending promise callbacks
async function checkSettled() {
  await new Promise((resolve) => setImmediate(resolve));
}

beforeEach(() => {
  autoUpdater.removeAllListeners();
  check.failure = undefined;
  check.emitsError = true;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function createUpdater(platform: NodeJS.Platform) {
  const server = new FakeServer();
  const updater = new AppUpdater(server, new Logger(server), platform);
  return { server, updater };
}

function withArgument<T>(argument: string, run: () => T): T {
  process.argv.push(argument);
  try {
    return run();
  } finally {
    process.argv.splice(process.argv.indexOf(argument), 1);
  }
}

describe("AppUpdater", () => {
  it("checks for updates when it is created, before a page sends its settings", () => {
    const { server, updater } = createUpdater("win32");

    expect(states(server.sent)).toEqual([
      "checking-for-update",
      "update-available",
      "update-downloaded",
    ]);
    expect(updater.info).toEqual({
      state: "update-downloaded",
      version: "9.9.9",
    });
  });

  it("does not download on macOS, whose build has no zip file for the update", () => {
    const { server, updater } = createUpdater("darwin");

    expect(states(server.sent)).toEqual([
      "checking-for-update",
      "update-available",
    ]);
    expect(updater.info).toEqual({
      state: "update-available",
      version: "9.9.9",
      noDownloadReason: "not-supported",
    });
  });

  it("does not download in the portable Windows build", () => {
    vi.stubEnv("PORTABLE_EXECUTABLE_DIR", "C:\\Users\\Player\\Kalandra");
    const { server, updater } = createUpdater("win32");

    expect(states(server.sent)).toEqual([
      "checking-for-update",
      "update-available",
    ]);
    expect(updater.info).toEqual({
      state: "update-available",
      version: "9.9.9",
      noDownloadReason: "not-supported",
    });
  });

  it.each([
    ["win32", "disabled-by-flag"],
    ["linux", "disabled-by-flag"],
    ["darwin", "not-supported"],
  ] as const)(
    "does not download in the first check with --no-updates on %s",
    (platform, reason) => {
      const { server, updater } = withArgument("--no-updates", () =>
        createUpdater(platform),
      );

      expect(states(server.sent)).toEqual([
        "checking-for-update",
        "update-available",
      ]);
      expect(updater.info).toEqual({
        state: "update-available",
        version: "9.9.9",
        noDownloadReason: reason,
      });
    },
  );

  it("logs the first line of a failed check's message once, without the response headers", async () => {
    check.failure = new Error(
      '404 Not Found\nHeaders: {\n  "set-cookie": "_gh_sess=fake-session; path=/"\n}',
    );
    const server = new FakeServer();
    const logger = new Logger(server);
    const updater = new AppUpdater(server, logger, "win32");
    await checkSettled();

    expect(loggedLines(logger)).toEqual([
      "error [AppUpdater] Update failed: 404 Not Found",
    ]);
    expect(updater.info.state).toBe("error");
    expect(states(server.sent)).toEqual(["checking-for-update", "error"]);
  });

  it("logs a failed check that sends no error event", async () => {
    check.failure = new Error("net::ERR_INTERNET_DISCONNECTED");
    check.emitsError = false;
    const server = new FakeServer();
    const logger = new Logger(server);
    const updater = new AppUpdater(server, logger, "win32");
    await checkSettled();

    expect(loggedLines(logger)).toEqual([
      "error [AppUpdater] Update failed: net::ERR_INTERNET_DISCONNECTED",
    ]);
    expect(updater.info.state).toBe("error");
  });
});
