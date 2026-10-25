import { autoUpdater } from "electron-updater";
import type { ServerEvents } from "./server";
import type { Logger } from "./RemoteLogger";
import type { UpdateInfo } from "../../ipc/types";

export class AppUpdater {
  private _info: UpdateInfo = { state: "initial" };
  private reportedError: unknown;

  public readonly noAutoUpdatesReason: Extract<
    UpdateInfo,
    { state: "update-available" }
  >["noDownloadReason"] = null;

  get info() {
    return this._info;
  }

  set info(info: UpdateInfo) {
    this._info = info;
    this.server.sendEventTo("broadcast", {
      name: "MAIN->CLIENT::updater-state",
      payload: info,
    });
  }

  constructor(
    private server: ServerEvents,
    private logger: Logger,
  ) {
    setInterval(this.check, 16 * 60 * 60 * 1000);

    this.server.onEventAnyClient("CLIENT->MAIN::user-action", ({ action }) => {
      if (action === "check-for-update") {
        this.check();
      } else if (action === "update-and-restart") {
        autoUpdater.quitAndInstall(false);
      }
    });

    // https://www.electron.build/configuration/nsis.html#portable
    autoUpdater.autoDownload = !process.env.PORTABLE_EXECUTABLE_DIR;

    if (!autoUpdater.autoDownload || process.platform === "darwin") {
      this.noAutoUpdatesReason = "not-supported";
    } else if (process.argv.includes("--no-updates")) {
      autoUpdater.autoDownload = false;
      this.noAutoUpdatesReason = "disabled-by-flag";
    }

    autoUpdater.on("checking-for-update", () => {
      this.info = { state: "checking-for-update" };
    });
    autoUpdater.on("update-available", (info: { version: string }) => {
      this.info = {
        state: "update-available",
        version: info.version,
        noDownloadReason: this.noAutoUpdatesReason,
      };
    });
    autoUpdater.on("update-not-available", () => {
      this.info = { state: "update-not-available", checkedAt: Date.now() };
    });
    autoUpdater.on("error", this.reportFailure);
    autoUpdater.on("update-downloaded", (info: { version: string }) => {
      this.info = { state: "update-downloaded", version: info.version };
    });
    // on('download-progress') https://github.com/electron-userland/electron-builder/issues/2521

    // After autoDownload is set above, so the first check follows --no-updates
    this.check();
  }

  private check = async () => {
    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      // electron-updater emits a failed check as an error event, then rejects with the same error
      if (error !== this.reportedError) this.reportFailure(error);
    }
  };

  private reportFailure = (error: unknown) => {
    this.reportedError = error;
    // electron-updater writes the response headers, which can hold cookies, after the first line
    const message = error instanceof Error ? error.message : String(error);
    const reason = message.split("\n")[0];
    this.logger.write(`error [AppUpdater] Update failed: ${reason}`);
    this.info = { state: "error", checkedAt: Date.now() };
  };
}
