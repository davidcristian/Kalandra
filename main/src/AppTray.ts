import path from "path";
import { app, Tray, Menu, shell, nativeImage, dialog } from "electron";
import type { ServerEvents } from "./server";
import { type Logger, logRejection } from "./RemoteLogger";

export class AppTray {
  public overlayKey = "Shift + Space";
  private tray: Tray;
  pageUrl?: string;

  constructor(
    server: ServerEvents,
    private readonly logger: Logger,
  ) {
    let trayImage = nativeImage.createFromPath(
      path.join(
        __dirname,
        process.env.STATIC,
        process.platform === "win32" ? "icon.ico" : "icon.png",
      ),
    );

    if (process.platform === "darwin") {
      // Mac image size needs to be smaller, or else it looks huge. Size
      // guideline is from https://iconhandbook.co.uk/reference/chart/osx/
      trayImage = trayImage.resize({ width: 22, height: 22 });
    }

    this.tray = new Tray(trayImage);
    this.tray.setToolTip(`Kalandra v${app.getVersion()}`);
    this.rebuildMenu();

    server.onEventAnyClient("CLIENT->MAIN::user-action", ({ action }) => {
      if (action === "quit") {
        app.quit();
      }
    });
  }

  rebuildMenu() {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: "Settings/League",
        click: () => {
          dialog
            .showMessageBox({
              title: "Settings",
              message: `Open Path of Exile 2 and press "${this.overlayKey}". Click on the button with cog icon there.`,
            })
            .catch(logRejection(this.logger, "AppTray", "show a message"));
        },
      },
      {
        label: "Open in Browser",
        click: () => {
          if (!this.pageUrl) return;
          shell
            .openExternal(this.pageUrl)
            .catch(
              logRejection(this.logger, "AppTray", `open ${this.pageUrl}`),
            );
        },
      },
      { type: "separator" },
      {
        label: "Open config folder",
        click: () => {
          const folder = path.join(app.getPath("userData"), "apt-data");
          shell
            .openPath(folder)
            .catch(logRejection(this.logger, "AppTray", `open ${folder}`));
        },
      },
      {
        label: "Quit",
        click: () => {
          app.quit();
        },
      },
    ]);

    this.tray.setContextMenu(contextMenu);
  }
}
