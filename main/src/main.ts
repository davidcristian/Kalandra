"use strict";

import { app, dialog, systemPreferences } from "electron";
import { uIOhook } from "uiohook-napi";
import os from "node:os";
import { startServer, eventPipe, httpRoutes } from "./server";
import { type ListenAddress, pageUrl } from "./listen-option";
import { Logger } from "./RemoteLogger";
import { logRendererEntries } from "./renderer-log";
import { GameWindow } from "./windowing/GameWindow";
import { OverlayWindow } from "./windowing/OverlayWindow";
import { GameConfig } from "./host-files/GameConfig";
import { Shortcuts } from "./shortcuts/Shortcuts";
import { AppUpdater } from "./AppUpdater";
import { AppTray } from "./AppTray";
import { OverlayVisibility } from "./windowing/OverlayVisibility";
import { GameLogWatcher } from "./host-files/GameLogWatcher";
import { HttpProxy } from "./proxy";
import { addFileUploadRoutes } from "./host-files/file-uploads";
import { FileWriter } from "./host-files/FileWriter";
import { startWhenReady } from "./startup";
import { logUncaughtErrors } from "./uncaught-errors";

if (!app.requestSingleInstanceLock()) {
  app.exit();
}

if (process.platform !== "darwin") {
  app.disableHardwareAcceleration();
}
app.enableSandbox();
let tray: AppTray;

async function ensureAccessibilityPermission(): Promise<boolean> {
  if (systemPreferences.isTrustedAccessibilityClient(false)) return true;

  // Trigger the system prompt
  systemPreferences.isTrustedAccessibilityClient(true);

  const maxWaitTime = 15000;
  const startTime = Date.now();

  return await new Promise((resolve) => {
    const interval = setInterval(() => {
      if (systemPreferences.isTrustedAccessibilityClient(false)) {
        clearInterval(interval);
        resolve(true);
      }

      if (Date.now() - startTime > maxWaitTime) {
        clearInterval(interval);
        resolve(false);
      }
    }, 1000);
  });
}

startWhenReady(
  app,
  process.platform,
  ensureAccessibilityPermission,
  async () => {
    tray = new AppTray(eventPipe);
    const logger = new Logger(eventPipe);
    logRendererEntries(eventPipe, logger);
    const gameConfig = new GameConfig(logger);
    const poeWindow = new GameWindow();
    const appUpdater = new AppUpdater(eventPipe, logger);
    // eslint-disable-next-line no-new -- the proxy adds its route to the emitter it receives
    new HttpProxy(httpRoutes, logger);
    addFileUploadRoutes(httpRoutes, logger);
    const fileWriter = new FileWriter(eventPipe, logger);
    const gameLogWatcher = new GameLogWatcher(eventPipe, logger);

    if (process.env.VITE_DEV_SERVER_URL) {
      try {
        // The production build defines VITE_DEV_SERVER_URL as null, so esbuild leaves this import out of its bundle
        const { installExtension, VUEJS_DEVTOOLS } = await import(
          "electron-devtools-installer"
        );
        await installExtension(VUEJS_DEVTOOLS);
        logger.write("info Vue Devtools installed");
      } catch (error) {
        logger.write(`error installing Vue Devtools: ${error}`);
      }
    }
    logUncaughtErrors(process, logger);

    setTimeout(
      async () => {
        const overlay = new OverlayWindow(eventPipe, logger, poeWindow);
        // eslint-disable-next-line no-new -- the instance listens to key events from its constructor
        new OverlayVisibility(eventPipe, overlay);
        const shortcuts = new Shortcuts(
          logger,
          overlay,
          poeWindow,
          gameConfig,
          eventPipe,
        );
        eventPipe.onEventAnyClient(
          "CLIENT->MAIN::update-host-config",
          (cfg) => {
            overlay.updateOpts(
              cfg.overlayKey,
              cfg.windowTitle,
              cfg.hideOverlayOnBlur,
            );
            shortcuts.updateActions(
              cfg.shortcuts,
              cfg.stashScroll,
              cfg.logKeys,
              cfg.restoreClipboard,
            );
            shortcuts.updateDelay(cfg.initialDelay);
            gameLogWatcher.restart(cfg.clientLog ?? "", cfg.readClientLog);
            gameConfig.readConfig(cfg.gameConfig ?? "");
            tray.overlayKey = cfg.overlayKey;
            fileWriter.restart(cfg.libraryAlpha, cfg.libraryOutputPath);
          },
        );
        uIOhook.start();
        let address: ListenAddress;
        try {
          address = await startServer(appUpdater, logger);
        } catch (error) {
          dialog.showErrorBox(
            "Kalandra cannot start",
            `Kalandra cannot start the local web server that serves its page.\n\n${String(error)}`,
          );
          app.quit();
          return;
        }
        logger.write(`info ${os.type()} ${os.release} / v${app.getVersion()}`);
        overlay.loadAppPage(address);
        tray.pageUrl = pageUrl(address);
      },
      // fixes(linux): window is black instead of transparent
      process.platform === "linux" ? 1000 : 0,
    );
  },
);
