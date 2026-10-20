import { autoUpdater } from "electron-updater";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IpcEvent } from "../../ipc/types";
import { AppUpdater } from "../src/AppUpdater";
import { Logger } from "../src/RemoteLogger";
import { FakeServer } from "./fake-server";

const check = vi.hoisted(() => ({ failure: undefined as Error | undefined }));

// A check finds version 9.9.9 and, with autoDownload on, downloads it, as electron-updater does.
// With check.failure set, it emits the error and then rejects with it, as electron-updater does.
vi.mock("electron-updater", async () => {
  const { EventEmitter } = await import("node:events");
  class FakeAutoUpdater extends EventEmitter {
    autoDownload = true;

    async checkForUpdates() {
      this.emit("checking-for-update");
      if (check.failure) {
        this.emit("error", check.failure, String(check.failure.stack));
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

beforeEach(() => {
  autoUpdater.removeAllListeners();
  check.failure = undefined;
});

describe("AppUpdater", () => {
  it("checks for updates when it is created, before a page sends its settings", () => {
    const server = new FakeServer();
    const updater = new AppUpdater(server, new Logger(server));

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

  // macOS reports updates as not supported and ignores --no-updates
  it.skipIf(process.platform === "darwin")(
    "does not download in the first check with --no-updates",
    () => {
      process.argv.push("--no-updates");
      try {
        const server = new FakeServer();
        const updater = new AppUpdater(server, new Logger(server));

        expect(updater.info).toEqual({
          state: "update-available",
          version: "9.9.9",
          noDownloadReason: "disabled-by-flag",
        });
      } finally {
        process.argv.splice(process.argv.indexOf("--no-updates"), 1);
      }
    },
  );

  it("logs the first line of a failed check's message, without the response headers", () => {
    check.failure = new Error(
      '404 Not Found\nHeaders: {\n  "set-cookie": "_gh_sess=fake-session; path=/"\n}',
    );
    const server = new FakeServer();
    const logger = new Logger(server);
    const updater = new AppUpdater(server, logger);

    expect(loggedLines(logger)).toEqual([
      "error [AppUpdater] Update failed: 404 Not Found",
    ]);
    expect(updater.info.state).toBe("error");
    expect(states(server.sent)).toEqual(["checking-for-update", "error"]);
  });
});
