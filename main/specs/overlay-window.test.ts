import { EventEmitter } from "node:events";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IpcEvent } from "../../ipc/types";
import { Logger } from "../src/RemoteLogger";
import { GameWindow } from "../src/windowing/GameWindow";
import { OverlayWindow } from "../src/windowing/OverlayWindow";
import { FakeServer } from "./fake-server";

// Stands in for the desktop: the overlay window main creates, the game window it follows, and every dialog,
// link and focus change
const desktop = vi.hoisted(() => ({
  windows: [] as Array<{
    options: Record<string, unknown>;
    menu: Array<{ role: string }>;
    visible: boolean;
    alwaysOnTop: string[];
    loaded: string[];
    devTools: unknown[];
    contents: {
      emit: (event: string, ...args: unknown[]) => void;
      openWindow?: (details: { url: string }) => { action: string };
    };
  }>,
  opened: [] as string[],
  errors: [] as string[],
  focus: [] as string[],
  attached: [] as Array<{ window: unknown; title: string }>,
}));

vi.mock("electron", async () => {
  const { EventEmitter } = await import("node:events");
  class FakeContents extends EventEmitter {
    constructor(private readonly state: (typeof desktop.windows)[number]) {
      super();
    }

    setWindowOpenHandler(
      handler: (details: { url: string }) => { action: string },
    ) {
      this.state.contents.openWindow = handler;
    }

    openDevTools(options: unknown) {
      this.state.devTools.push(options);
    }
  }
  class BrowserWindow {
    readonly webContents;
    private readonly state: (typeof desktop.windows)[number];
    constructor(options: Record<string, unknown>) {
      this.state = {
        options,
        menu: [],
        visible: true,
        alwaysOnTop: [],
        loaded: [],
        devTools: [],
        contents: { emit: () => {} },
      };
      this.webContents = new FakeContents(this.state);
      this.state.contents.emit = (event, ...args) =>
        this.webContents.emit(event, ...args);
      desktop.windows.push(this.state);
    }

    setMenu(menu: Array<{ role: string }>) {
      this.state.menu = menu;
    }

    loadURL(url: string) {
      this.state.loaded.push(url);
    }

    isVisible() {
      return this.state.visible;
    }

    hide() {
      this.state.visible = false;
    }

    showInactive() {
      this.state.visible = true;
    }

    setAlwaysOnTop(flag: boolean, level: string) {
      if (flag) this.state.alwaysOnTop.push(level);
    }
  }
  return {
    BrowserWindow,
    Menu: { buildFromTemplate: (template: unknown) => template },
    shell: {
      openExternal: async (url: string) => {
        desktop.opened.push(url);
      },
    },
    dialog: {
      showErrorBox: (title: string) => {
        desktop.errors.push(title);
      },
    },
  };
});

vi.mock("electron-overlay-window", async () => {
  const { EventEmitter } = await import("node:events");
  return {
    OVERLAY_WINDOW_OPTS: { transparent: true },
    OverlayController: {
      events: new EventEmitter(),
      activateOverlay: () => {
        desktop.focus.push("overlay");
      },
      focusTarget: () => {
        desktop.focus.push("game");
      },
      attachByTitle: (window: unknown, title: string) => {
        desktop.attached.push({ window, title });
      },
    },
  };
});

const { OverlayController } = await import("electron-overlay-window");
const PLATFORM = process.platform;

let server: FakeServer;
let game: GameWindow;

function createOverlay() {
  const overlay = new OverlayWindow(server, new Logger(server), game);
  return { overlay, shown: desktop.windows[desktop.windows.length - 1] };
}

function sent(name: IpcEvent["name"]) {
  return server.sent.filter((event) => event.name === name);
}

function keyDown(code: string, modifiers: { shift?: boolean } = {}) {
  return {
    type: "keyDown",
    code,
    control: false,
    shift: modifiers.shift ?? false,
    alt: false,
  };
}

beforeEach(() => {
  vi.stubEnv("STATIC", "icons");
  vi.stubEnv("VITE_DEV_SERVER_URL", "");
  server = new FakeServer();
  game = new GameWindow();
  desktop.windows = [];
  desktop.opened = [];
  desktop.errors = [];
  desktop.focus = [];
  desktop.attached = [];
});

afterEach(() => {
  Object.defineProperty(process, "platform", { value: PLATFORM });
  OverlayController.events.removeAllListeners();
  game.removeAllListeners();
  vi.unstubAllEnvs();
});

describe("OverlayWindow", () => {
  it.each([
    ["win32", true],
    ["linux", false],
    ["darwin", true],
  ] as const)(
    "creates the window on %s with rounded corners %s",
    (platform, rounded) => {
      Object.defineProperty(process, "platform", { value: platform });

      const { shown } = createOverlay();

      expect(shown.options).toMatchObject({
        icon: path.join(__dirname, "../src/windowing/icons", "icon.png"),
        transparent: true,
        roundedCorners: rounded,
      });
      expect(shown.menu.map((item) => item.role)).toEqual([
        "editMenu",
        "reload",
        "toggleDevTools",
      ]);
    },
  );

  it("loads the app page from the port, or from the dev server with the dev tools", () => {
    const { overlay, shown } = createOverlay();
    overlay.loadAppPage(4321);
    vi.stubEnv("VITE_DEV_SERVER_URL", "http://localhost:5173");
    overlay.loadAppPage(4321);

    expect(shown.loaded).toEqual([
      "http://localhost:4321/index.html",
      "http://localhost:5173",
    ]);
    expect(shown.devTools).toEqual([{ mode: "detach", activate: false }]);
  });

  it("opens the app page in the browser without the overlay window", () => {
    process.argv.push("--no-overlay");
    try {
      const { overlay } = createOverlay();
      overlay.loadAppPage(4321);
    } finally {
      process.argv.pop();
    }

    expect(desktop.windows).toHaveLength(0);
    expect(desktop.opened).toEqual(["http://localhost:4321/index.html"]);
  });

  it("opens a link of the page in the browser instead of a new window", () => {
    const { shown } = createOverlay();

    const result = shown.contents.openWindow!({ url: "https://example.com/" });

    expect(result).toEqual({ action: "deny" });
    expect(desktop.opened).toEqual(["https://example.com/"]);
  });

  it("attaches to the game window once, by the title from the settings", () => {
    const { overlay } = createOverlay();

    overlay.updateOpts("Shift + Space", "Path of Exile 2", false);
    overlay.updateOpts("Shift + Space", "Other title", false);

    expect(desktop.attached).toHaveLength(1);
    expect(desktop.attached[0].title).toBe("Path of Exile 2");
    expect(desktop.attached[0].window).toBeDefined();
  });

  it("shows an error when the game runs with administrator rights, and tells the page when it attaches", () => {
    createOverlay();

    OverlayController.events.emit("attach", { hasAccess: false });
    expect(desktop.errors).toEqual(["PoE2 window: no access"]);
    expect(sent("MAIN->OVERLAY::overlay-attached")).toHaveLength(0);

    OverlayController.events.emit("attach", { hasAccess: true });
    expect(desktop.errors).toHaveLength(1);
    expect(sent("MAIN->OVERLAY::overlay-attached")).toHaveLength(1);
  });

  it("follows the focus of the game window and tells the page", () => {
    const { overlay } = createOverlay();
    overlay.updateOpts("Shift + Space", "Path of Exile 2", false);

    overlay.assertOverlayActive();
    OverlayController.events.emit("focus");

    expect(game.isActive).toBe(true);
    expect(overlay.isInteractable).toBe(false);
    expect(
      sent("MAIN->OVERLAY::focus-change").map((event) => event.payload),
    ).toEqual([{ game: true, overlay: false }]);
  });

  it("moves the focus between the game and the overlay", async () => {
    const { overlay } = createOverlay();

    overlay.toggleActiveState();
    expect([overlay.isInteractable, game.isActive]).toEqual([true, false]);
    overlay.toggleActiveState();
    expect([overlay.isInteractable, game.isActive]).toEqual([false, true]);
    overlay.toggleActiveState();
    await server.emit("OVERLAY->MAIN::focus-game", undefined);

    expect(desktop.focus).toEqual(["overlay", "game", "overlay", "game"]);
  });

  it("handles the overlay key and Escape in the window and in a web view, on the next tick", async () => {
    const { overlay, shown } = createOverlay();
    overlay.updateOpts("Shift + Space", "Path of Exile 2", false);
    const webView = new EventEmitter();
    shown.contents.emit("did-attach-webview", {}, webView);
    const prevented: string[] = [];
    const press = (
      target: { emit: (event: string, ...args: unknown[]) => unknown },
      input: ReturnType<typeof keyDown>,
    ) =>
      target.emit(
        "before-input-event",
        { preventDefault: () => prevented.push(input.code) },
        input,
      );

    press(shown.contents, keyDown("Space", { shift: true }));
    expect(overlay.isInteractable).toBe(false);
    await new Promise((resolve) => {
      process.nextTick(resolve);
    });
    expect(overlay.isInteractable).toBe(true);

    press(webView, keyDown("Escape"));
    press(webView, keyDown("KeyA"));
    await new Promise((resolve) => {
      process.nextTick(resolve);
    });

    expect(overlay.isInteractable).toBe(false);
    expect(prevented).toEqual(["Space", "Escape"]);
  });

  it("keeps the last used state that a page sends", async () => {
    const { overlay } = createOverlay();

    await server.emit("CLIENT->MAIN::used-recently", { isOverlay: false });

    expect(overlay.wasUsedRecently).toBe(false);
  });

  describe("with Hide overlay on blur", () => {
    it("hides the window while the game and the overlay are inactive, and shows it on top again", () => {
      const { overlay, shown } = createOverlay();
      overlay.updateOpts("Shift + Space", "Path of Exile 2", true);

      OverlayController.events.emit("focus");
      OverlayController.events.emit("blur");
      expect(shown.visible).toBe(false);

      OverlayController.events.emit("focus");
      expect(shown.visible).toBe(true);
      expect(shown.alwaysOnTop).toEqual(["screen-saver"]);

      OverlayController.events.emit("blur");
      overlay.assertOverlayActive();
      expect(shown.visible).toBe(true);
    });

    it("hides the window while the page has nothing to show", async () => {
      const { overlay, shown } = createOverlay();
      overlay.updateOpts("Shift + Space", "Path of Exile 2", true);
      OverlayController.events.emit("focus");

      await server.emit("OVERLAY->MAIN::render-state", { shouldShow: false });
      expect(shown.visible).toBe(false);

      await server.emit("OVERLAY->MAIN::render-state", { shouldShow: true });
      expect(shown.visible).toBe(true);
    });

    it("never hides the window with the setting off", () => {
      const { overlay, shown } = createOverlay();
      overlay.updateOpts("Shift + Space", "Path of Exile 2", false);

      OverlayController.events.emit("focus");
      OverlayController.events.emit("blur");

      expect(shown.visible).toBe(true);
    });
  });
});
