import type { AppTray } from "./AppTray";
import type { FileWriter } from "./host-files/FileWriter";
import type { GameConfig } from "./host-files/GameConfig";
import type { GameLogWatcher } from "./host-files/GameLogWatcher";
import { type Logger, logRejection } from "./RemoteLogger";
import type { ServerEvents } from "./server";
import type { Shortcuts } from "./shortcuts/Shortcuts";
import type { OverlayWindow } from "./windowing/OverlayWindow";

/** The services that use the `HostConfig` settings, as far as `passHostConfig()` calls them. */
export interface HostConfigServices {
  overlay: Pick<OverlayWindow, "updateOpts">;
  shortcuts: Pick<Shortcuts, "updateActions" | "updateDelay">;
  gameLogWatcher: Pick<GameLogWatcher, "restart">;
  gameConfig: Pick<GameConfig, "readConfig">;
  tray: Pick<AppTray, "overlayKey">;
  fileWriter: Pick<FileWriter, "restart">;
  logger: Pick<Logger, "write">;
}

/** Passes each `HostConfig` field of `CLIENT->MAIN::update-host-config` to the service that uses it. */
export function passHostConfig(
  server: Pick<ServerEvents, "onEventAnyClient">,
  services: HostConfigServices,
): void {
  const { overlay, shortcuts, gameLogWatcher, gameConfig, tray, fileWriter } =
    services;
  server.onEventAnyClient("CLIENT->MAIN::update-host-config", (cfg) => {
    overlay.updateOpts(cfg);
    shortcuts.updateActions(cfg);
    shortcuts.updateDelay(cfg.initialDelay);
    gameLogWatcher
      .restart(cfg.clientLog ?? "", cfg.readClientLog)
      .catch(logRejection(services.logger, "GameLogWatcher", "restart"));
    void gameConfig.readConfig(cfg.gameConfig ?? ""); // logs a failed read
    tray.overlayKey = cfg.overlayKey;
    void fileWriter.restart(cfg.libraryAlpha, cfg.libraryOutputPath); // logs a failed write
  });
}
