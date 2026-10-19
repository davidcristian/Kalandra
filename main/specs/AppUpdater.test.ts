import { autoUpdater } from "electron-updater";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IpcEvent } from "../../ipc/types";
import { AppUpdater } from "../src/AppUpdater";
import { FakeServer } from "./fake-server";

// A check finds version 9.9.9 and, with autoDownload on, downloads it, as electron-updater does
vi.mock("electron-updater", async () => {
  const { EventEmitter } = await import("node:events");
  class FakeAutoUpdater extends EventEmitter {
    autoDownload = true;

    async checkForUpdates() {
      this.emit("checking-for-update");
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

beforeEach(() => {
  autoUpdater.removeAllListeners();
});

describe("AppUpdater", () => {
  it("checks for updates when it is created, before a page sends its settings", () => {
    const server = new FakeServer();
    const updater = new AppUpdater(server);

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
        const updater = new AppUpdater(new FakeServer());

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
});
