import path from "path";
import { BrowserWindow, dialog, shell, Menu } from "electron";
import {
  OverlayController,
  OVERLAY_WINDOW_OPTS,
} from "electron-overlay-window";
import { type ListenAddress, pageUrl } from "../listen-option";
import { isTradeSiteUrl } from "../proxy";
import type { ServerEvents } from "../server";
import { type Logger, logRejection } from "../RemoteLogger";
import type { GameWindow } from "./GameWindow";
import { overlayKeyCommand } from "./overlay-keys";
import { watchPage } from "./page-watch";

export class OverlayWindow {
  public isInteractable = false;
  public wasUsedRecently = true;
  private window?: BrowserWindow;
  private overlayKey: string = "Shift + Space";
  private shouldShowOverlay = true;
  private hideOverlayOnBlur = false;

  constructor(
    private server: ServerEvents,
    private logger: Logger,
    private poeWindow: GameWindow,
  ) {
    this.server.onEventAnyClient(
      "OVERLAY->MAIN::focus-game",
      this.assertGameActive,
    );
    this.poeWindow.on("active-change", this.handlePoeWindowActiveChange);
    this.poeWindow.onAttach(this.handleOverlayAttached);

    this.server.onEventAnyClient("CLIENT->MAIN::used-recently", (e) => {
      this.wasUsedRecently = e.isOverlay;
    });

    if (process.argv.includes("--no-overlay")) return;

    this.server.onEventAnyClient("OVERLAY->MAIN::render-state", (e) => {
      this.shouldShowOverlay = e.shouldShow;
      this.syncWindowVisibility();
    });

    this.window = new BrowserWindow({
      icon: path.join(__dirname, process.env.STATIC, "icon.png"),
      ...OVERLAY_WINDOW_OPTS,
      // Electron rounds a frameless window's corners on Linux too, which would clip the overlay's corners there.
      // macOS keeps the default, since false there makes the window not fullscreenable.
      roundedCorners: process.platform !== "linux",
      width: 800,
      height: 600,
      webPreferences: {
        allowRunningInsecureContent: false,
        webviewTag: true,
        spellcheck: false,
      },
    });

    // A reload drops the overlay's state, so only a dev run has its key. The developer tools key stays, because
    // docs/dev/runbooks/in-game-check.md reads the page's console in a packaged build with it
    const reload = process.env.VITE_DEV_SERVER_URL
      ? [{ role: "reload" as const }]
      : [];
    this.window.setMenu(
      Menu.buildFromTemplate([
        { role: "editMenu" },
        ...reload,
        { role: "toggleDevTools" },
      ]),
    );

    watchPage(this.window.webContents, this.logger);
    this.window.webContents.on("before-input-event", this.handleExtraCommands);
    this.window.webContents.on("will-attach-webview", this.checkWebview);
    this.window.webContents.on(
      "did-attach-webview",
      (_, webviewWebContents) => {
        webviewWebContents.on("before-input-event", this.handleExtraCommands);
      },
    );

    this.window.webContents.setWindowOpenHandler((details) => {
      shell
        .openExternal(details.url)
        .catch(logRejection(this.logger, "Overlay", "open a link"));
      return { action: "deny" };
    });
  }

  loadAppPage(address: ListenAddress) {
    if (!this.window) {
      const browserUrl =
        process.env.VITE_DEV_SERVER_URL || `${pageUrl(address)}/index.html`;
      shell
        .openExternal(browserUrl)
        .catch(logRejection(this.logger, "Overlay", `open ${browserUrl}`));
      return;
    }

    const url =
      process.env.VITE_DEV_SERVER_URL ||
      `http://localhost:${address.port}/index.html`;
    const logFailedLoad = logRejection(this.logger, "Overlay", "load the page");

    if (process.env.VITE_DEV_SERVER_URL) {
      this.window.loadURL(url).catch(logFailedLoad);
      this.window.webContents.openDevTools({ mode: "detach", activate: false });
    } else {
      this.window.loadURL(url).catch(logFailedLoad);
    }
  }

  assertOverlayActive = () => {
    if (!this.isInteractable) {
      this.isInteractable = true;

      this.onOverlayActive();

      OverlayController.activateOverlay();
      this.poeWindow.isActive = false;
    }
  };

  assertGameActive = () => {
    if (this.isInteractable) {
      this.isInteractable = false;
      OverlayController.focusTarget();
      this.poeWindow.isActive = true;

      this.onGameActive();
    }
  };

  // Keys go to the window with the focus, which is the browser after a click in a browser tab
  focusGameFor = (action: string): boolean => {
    this.assertGameActive();
    if (!this.poeWindow.isActive) {
      this.logger.write(
        `warn [Overlay] Skipped ${action} because the game window does not have the focus`,
      );
    }
    return this.poeWindow.isActive;
  };

  toggleActiveState = () => {
    if (this.isInteractable) {
      this.assertGameActive();
    } else {
      this.assertOverlayActive();
    }
  };

  updateOpts(
    overlayKey: string,
    windowTitle: string,
    hideOverlayOnBlur: boolean,
  ) {
    this.overlayKey = overlayKey;
    this.poeWindow.attach(this.window, windowTitle);
    this.hideOverlayOnBlur = hideOverlayOnBlur;
  }

  private handleExtraCommands = (
    event: Electron.Event,
    input: Electron.Input,
  ) => {
    const command = overlayKeyCommand(input, this.overlayKey);
    if (command === "focus-game") {
      event.preventDefault();
      process.nextTick(this.assertGameActive);
    } else if (command === "toggle-overlay") {
      event.preventDefault();
      process.nextTick(this.toggleActiveState);
    }
  };

  // The page's <webview> attributes set the guest's preferences, so main resets those that give it more access
  private checkWebview = (
    event: Electron.Event,
    webPreferences: Electron.WebPreferences,
    params: Record<string, string>,
  ) => {
    delete webPreferences.preload;
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
    if (isTradeSiteUrl(params.src)) return;

    event.preventDefault();
    const blocked = URL.parse(params.src);
    this.logger.write(
      `warn [Overlay] Blocked a web view that opens ${blocked ? `${blocked.protocol}//${blocked.host}` : "an address that is not a URL"}`,
    );
  };

  private handleOverlayAttached = (hasAccess?: boolean) => {
    if (hasAccess === false) {
      this.logger.write(
        "error [Overlay] PoE2 is running with administrator rights",
      );

      dialog.showErrorBox(
        "PoE2 window: no access",
        "Path of Exile 2 is running with administrator rights.\n" +
          "\n" +
          "You need to restart Kalandra with administrator rights.",
      );
    } else {
      this.server.sendEventTo("broadcast", {
        name: "MAIN->OVERLAY::overlay-attached",
        payload: undefined,
      });
    }
    this.syncWindowVisibility();
  };

  private handlePoeWindowActiveChange = (isActive: boolean) => {
    if (isActive && this.isInteractable) {
      this.isInteractable = false;
    }
    this.server.sendEventTo("broadcast", {
      name: "MAIN->OVERLAY::focus-change",
      payload: {
        game: isActive,
        overlay: this.isInteractable,
      },
    });
    this.syncWindowVisibility();
  };

  private syncWindowVisibility() {
    if (!this.window || !this.hideOverlayOnBlur) return;

    if (
      this.isInteractable ||
      (this.shouldShowOverlay && this.poeWindow.isActive)
    ) {
      this.showOverlay();
    } else if (this.window.isVisible()) {
      this.window.hide();
    }
  }

  private showOverlay() {
    if (!this.window || this.window.isVisible() || !this.hideOverlayOnBlur)
      return;

    this.window.showInactive();
    this.window.setAlwaysOnTop(true, "screen-saver");
  }

  private onGameActive() {
    this.syncWindowVisibility();
  }

  private onOverlayActive() {
    this.showOverlay();
  }
}
