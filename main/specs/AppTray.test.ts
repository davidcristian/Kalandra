import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppTray } from "../src/AppTray";
import { FakeServer } from "./fake-server";

interface FakeImage {
  file: string;
  size: { width: number; height: number };
}

interface MenuItem {
  label?: string;
  type?: string;
  click?: () => void;
}

// Stands in for the desktop: keeps the tray, its menu and every window, link, folder and quit the app opens
const desktop = vi.hoisted(() => ({
  trays: [] as Array<{ image: FakeImage; toolTip: string; menu: MenuItem[] }>,
  messages: [] as Array<{ title: string; message: string }>,
  opened: [] as string[],
  quits: 0,
}));

vi.mock("electron", () => {
  const image = (file: string, width: number, height: number) => ({
    file,
    size: { width, height },
    resize: (size: { width: number; height: number }) =>
      image(file, size.width, size.height),
  });
  return {
    app: {
      getVersion: () => "1.2.3",
      getPath: (name: string) => `/home/${name}`,
      quit: () => {
        desktop.quits += 1;
      },
    },
    nativeImage: { createFromPath: (file: string) => image(file, 256, 256) },
    Tray: class {
      private readonly state;
      constructor(trayImage: FakeImage) {
        this.state = { image: trayImage, toolTip: "", menu: [] as MenuItem[] };
        desktop.trays.push(this.state);
      }

      setToolTip(text: string) {
        this.state.toolTip = text;
      }

      setContextMenu(menu: MenuItem[]) {
        this.state.menu = menu;
      }
    },
    Menu: { buildFromTemplate: (template: MenuItem[]) => template },
    shell: {
      openExternal: async (url: string) => {
        desktop.opened.push(url);
      },
      openPath: async (folder: string) => {
        desktop.opened.push(folder);
        return "";
      },
    },
    dialog: {
      showMessageBox: async (box: { title: string; message: string }) => {
        desktop.messages.push(box);
        return { response: 0 };
      },
    },
  };
});

const PLATFORM = process.platform;

function onPlatform(platform: NodeJS.Platform) {
  Object.defineProperty(process, "platform", { value: platform });
}

function createTray() {
  const server = new FakeServer();
  const tray = new AppTray(server);
  return { server, tray, shown: desktop.trays[desktop.trays.length - 1] };
}

function click(menu: MenuItem[], label: string) {
  const item = menu.find((entry) => entry.label === label);
  expect(item, label).toBeDefined();
  item!.click!();
}

beforeEach(() => {
  vi.stubEnv("STATIC", "icons");
  desktop.trays = [];
  desktop.messages = [];
  desktop.opened = [];
  desktop.quits = 0;
});

afterEach(() => {
  onPlatform(PLATFORM);
  vi.unstubAllEnvs();
});

describe("AppTray", () => {
  it.each([
    ["win32", "icon.ico", 256],
    ["linux", "icon.png", 256],
    ["darwin", "icon.png", 22],
  ] as const)(
    "shows the icon of %s at its size, with the version",
    (platform, file, size) => {
      onPlatform(platform);
      const { shown } = createTray();

      expect(shown.image.file).toBe(path.join(__dirname, "../src/icons", file));
      expect(shown.image.size).toEqual({ width: size, height: size });
      expect(shown.toolTip).toBe("Kalandra v1.2.3");
    },
  );

  it("lists the menu entries in order", () => {
    const { shown } = createTray();

    expect(shown.menu.map((item) => item.label ?? item.type)).toEqual([
      "Settings/League",
      "Open in Browser",
      "separator",
      "Open config folder",
      "Quit",
    ]);
  });

  it("opens the page main gives it and names the overlay key set after the menu was built", () => {
    const { tray, shown } = createTray();
    tray.pageUrl = "http://192.168.1.20:4321";
    tray.overlayKey = "Ctrl + Space";

    click(shown.menu, "Open in Browser");
    click(shown.menu, "Settings/League");

    expect(desktop.opened).toEqual(["http://192.168.1.20:4321"]);
    expect(desktop.messages).toEqual([
      {
        title: "Settings",
        message:
          'Open Path of Exile 2 and press "Ctrl + Space". Click on the button with cog icon there.',
      },
    ]);
  });

  it("opens no page before the server listens", () => {
    const { shown } = createTray();

    click(shown.menu, "Open in Browser");

    expect(desktop.opened).toEqual([]);
  });

  it("opens the folder of the saved config", () => {
    const { shown } = createTray();

    click(shown.menu, "Open config folder");

    expect(desktop.opened).toEqual([path.join("/home/userData", "apt-data")]);
  });

  it("quits from the menu and when a page asks to quit, and not for other actions", async () => {
    const { server, shown } = createTray();

    await server.emit("CLIENT->MAIN::user-action", {
      action: "check-for-update",
    });
    expect(desktop.quits).toBe(0);

    await server.emit("CLIENT->MAIN::user-action", { action: "quit" });
    click(shown.menu, "Quit");
    expect(desktop.quits).toBe(2);
  });
});
