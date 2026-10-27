import { EventEmitter } from "node:events";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IpcEvent } from "../../ipc/types";
import { Logger } from "../src/RemoteLogger";
import { GameWindow } from "../src/windowing/GameWindow";
import { OverlayWindow } from "../src/windowing/OverlayWindow";
import { FakeServer } from "./fake-server";

// Stands in for the desktop: the overlay window main creates, the game window it follows, and every dialog,
// link and focus change. With failure set, each page load and link rejects with it.
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
  failure: null as Error | null,
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

    async loadURL(url: string) {
      this.state.loaded.push(url);
      if (desktop.failure) throw desktop.failure;
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
        if (desktop.failure) throw desktop.failure;
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

// The fakes reject at once, so the window has handled each rejection after the pending promise callbacks
async function rejectionsHandled() {
  await new Promise((resolve) => setImmediate(resolve));
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

// Sends what Electron emits before a <webview> starts, with the preferences a page could ask for
function attachWebview(window: (typeof desktop.windows)[number], src: string) {
  let prevented = false;
  const event = {
    preventDefault: () => {
      prevented = true;
    },
  };
  const webPreferences = {
    preload: "/page/preload.js",
    nodeIntegration: true,
    contextIsolation: false,
  };
  window.contents.emit("will-attach-webview", event, webPreferences, { src });
  return { prevented, webPreferences };
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
  desktop.failure = null;
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
        "toggleDevTools",
      ]);
    },
  );

  it("adds the reload key to the menu only in a dev run", () => {
    vi.stubEnv("VITE_DEV_SERVER_URL", "http://localhost:5173");

    const { shown } = createOverlay();

    expect(shown.menu.map((item) => item.role)).toEqual([
      "editMenu",
      "reload",
      "toggleDevTools",
    ]);
  });

  it("loads the app page from localhost and the port, or from the dev server with the dev tools", () => {
    const { overlay, shown } = createOverlay();
    overlay.loadAppPage({ host: "0.0.0.0", port: 4321 });
    vi.stubEnv("VITE_DEV_SERVER_URL", "http://localhost:5173");
    overlay.loadAppPage({ host: "0.0.0.0", port: 4321 });

    expect(shown.loaded).toEqual([
      "http://localhost:4321/index.html",
      "http://localhost:5173",
    ]);
    expect(shown.devTools).toEqual([{ mode: "detach", activate: false }]);
  });

  it("opens the app page in the browser at the server's address without the overlay window", () => {
    process.argv.push("--no-overlay");
    try {
      const { overlay } = createOverlay();
      overlay.loadAppPage({ host: "192.168.1.20", port: 4321 });
    } finally {
      process.argv.pop();
    }

    expect(desktop.windows).toHaveLength(0);
    expect(desktop.opened).toEqual(["http://192.168.1.20:4321/index.html"]);
  });

  it("opens a link of the page in the browser instead of a new window", () => {
    const { shown } = createOverlay();

    const result = shown.contents.openWindow!({ url: "https://example.com/" });

    expect(result).toEqual({ action: "deny" });
    expect(desktop.opened).toEqual(["https://example.com/"]);
  });

  it("logs a page load and a link of the page that fail", async () => {
    desktop.failure = new Error("ERR_CONNECTION_REFUSED (-102)");
    const { overlay, shown } = createOverlay();

    overlay.loadAppPage({ host: "0.0.0.0", port: 4321 });
    vi.stubEnv("VITE_DEV_SERVER_URL", "http://localhost:5173");
    overlay.loadAppPage({ host: "0.0.0.0", port: 4321 });
    shown.contents.openWindow?.({ url: "https://example.com/" });
    await rejectionsHandled();

    expect(server.logEntries()).toEqual([
      expect.stringContaining(
        "error [Overlay] Cannot load the page: ERR_CONNECTION_REFUSED (-102)\n",
      ),
      expect.stringContaining(
        "error [Overlay] Cannot load the page: ERR_CONNECTION_REFUSED (-102)\n",
      ),
      expect.stringContaining(
        "error [Overlay] Cannot open a link: ERR_CONNECTION_REFUSED (-102)\n",
      ),
    ]);
  });

  it("logs an app page that the browser fails to open without the overlay window", async () => {
    desktop.failure = new Error("no browser is set");
    process.argv.push("--no-overlay");
    try {
      const { overlay } = createOverlay();
      overlay.loadAppPage({ host: "192.168.1.20", port: 4321 });
    } finally {
      process.argv.pop();
    }
    await rejectionsHandled();

    expect(server.logEntries()).toEqual([
      expect.stringContaining(
        "error [Overlay] Cannot open http://192.168.1.20:4321/index.html: no browser is set\n",
      ),
    ]);
  });

  it("lets a web view open the trade site, with no preload, no Node.js and an isolated context", () => {
    const { shown } = createOverlay();

    const attach = attachWebview(
      shown,
      "https://www.pathofexile.com/trade2/search/poe2/Standard/abc",
    );

    expect(attach).toEqual({
      prevented: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });
    expect(server.logEntries()).toEqual([]);
  });

  it.each([
    ["http://www.pathofexile.com/trade2", "http://www.pathofexile.com"],
    ["https://kalandra.ashoal.com/prices", "https://kalandra.ashoal.com"],
    [
      "https://www.pathofexile.com.evil.example/",
      "https://www.pathofexile.com.evil.example",
    ],
    ["file:///C:/Windows/win.ini", "file://"],
    ["not a url", "an address that is not a URL"],
  ])(
    "blocks and logs a web view that opens %s, with its preferences reset",
    (src, logged) => {
      const { shown } = createOverlay();

      const attach = attachWebview(shown, src);

      expect(attach).toEqual({
        prevented: true,
        webPreferences: { nodeIntegration: false, contextIsolation: true },
      });
      expect(server.logEntries()).toEqual([
        expect.stringContaining(
          `warn [Overlay] Blocked a web view that opens ${logged}\n`,
        ),
      ]);
    },
  );

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
