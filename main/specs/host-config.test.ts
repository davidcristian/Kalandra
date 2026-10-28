import { describe, expect, it } from "vitest";
import type { HostConfig, ShortcutAction } from "../../ipc/types";
import { passHostConfig } from "../src/host-config";
import type { ShortcutSettings } from "../src/shortcuts/Shortcuts";
import type { OverlaySettings } from "../src/windowing/OverlayWindow";
import { FakeServer } from "./fake-server";

class FakeOverlay {
  overlayKey = "";
  windowTitle = "";
  hideOverlayOnBlur = false;

  updateOpts(settings: OverlaySettings) {
    this.overlayKey = settings.overlayKey;
    this.windowTitle = settings.windowTitle;
    this.hideOverlayOnBlur = settings.hideOverlayOnBlur;
  }
}

class FakeShortcuts {
  actions: ShortcutAction[] = [];
  stashScroll = false;
  logKeys = false;
  restoreClipboard = false;
  delay = 0;

  updateActions(settings: ShortcutSettings) {
    this.actions = settings.shortcuts;
    this.stashScroll = settings.stashScroll;
    this.logKeys = settings.logKeys;
    this.restoreClipboard = settings.restoreClipboard;
  }

  updateDelay(delay: number) {
    this.delay = delay;
  }
}

class FakeGameLogWatcher {
  logFile: string | null = null;
  readLog = false;
  failure: Error | null = null;

  async restart(logFile: string, readLog: boolean): Promise<void> {
    if (this.failure) throw this.failure;
    this.logFile = logFile;
    this.readLog = readLog;
  }
}

class FakeGameConfig {
  filePath: string | null = null;

  async readConfig(filePath: string): Promise<void> {
    this.filePath = filePath;
  }
}

class FakeFileWriter {
  enabled = false;
  outputPath: string | null = null;

  async restart(enabled: boolean, outputPath: string | null): Promise<void> {
    this.enabled = enabled;
    this.outputPath = outputPath;
  }
}

class FakeGameCapture {
  enabled = false;
  windowTitle = "";

  update(enabled: boolean, windowTitle: string) {
    this.enabled = enabled;
    this.windowTitle = windowTitle;
  }
}

class FakeLogger {
  lines: string[] = [];

  write(message: string) {
    this.lines.push(message);
  }
}

function createServices() {
  return {
    overlay: new FakeOverlay(),
    shortcuts: new FakeShortcuts(),
    gameLogWatcher: new FakeGameLogWatcher(),
    gameConfig: new FakeGameConfig(),
    tray: { overlayKey: "Shift + Space" },
    fileWriter: new FakeFileWriter(),
    gameCapture: new FakeGameCapture(),
    logger: new FakeLogger(),
  };
}

type Services = ReturnType<typeof createServices>;

// Every switch is off and every text differs, so a field passed to the wrong place shows
const CONFIG: HostConfig = {
  shortcuts: [{ shortcut: "F5", action: { type: "toggle-overlay" } }],
  restoreClipboard: false,
  clientLog: "D:/Games/Path of Exile 2/logs/Client.txt",
  gameConfig:
    "D:/Documents/My Games/Path of Exile 2/poe2_production_Config.ini",
  stashScroll: false,
  overlayKey: "Alt + Q",
  logKeys: false,
  windowTitle: "Path of Exile 2",
  readClientLog: false,
  libraryAlpha: false,
  libraryOutputPath: "D:/Library",
  initialDelay: 120,
  hideOverlayOnBlur: false,
  stashCapture: false,
};

type Switch = {
  [Name in keyof HostConfig]: HostConfig[Name] extends boolean ? Name : never;
}[keyof HostConfig];

// Each switch of HostConfig and the service state that keeps it
const SWITCHES: Record<Switch, (services: Services) => boolean> = {
  restoreClipboard: (services) => services.shortcuts.restoreClipboard,
  stashScroll: (services) => services.shortcuts.stashScroll,
  logKeys: (services) => services.shortcuts.logKeys,
  readClientLog: (services) => services.gameLogWatcher.readLog,
  libraryAlpha: (services) => services.fileWriter.enabled,
  hideOverlayOnBlur: (services) => services.overlay.hideOverlayOnBlur,
  stashCapture: (services) => services.gameCapture.enabled,
};

function switchesOn(services: Services): string[] {
  return Object.entries(SWITCHES)
    .filter(([, isOn]) => isOn(services))
    .map(([name]) => name);
}

async function sendConfig(
  config: HostConfig,
  services = createServices(),
): Promise<Services> {
  const server = new FakeServer();
  passHostConfig(server, services);
  await server.emit("CLIENT->MAIN::update-host-config", config);
  // The services start their work without waiting, so a failure is logged after the pending promise callbacks
  await new Promise((resolve) => setImmediate(resolve));
  return services;
}

describe("passHostConfig", () => {
  it("passes each text, number and hotkey list to the service that uses it", async () => {
    const sent = await sendConfig(CONFIG);

    expect(sent.overlay.overlayKey).toBe("Alt + Q");
    expect(sent.overlay.windowTitle).toBe("Path of Exile 2");
    expect(sent.gameCapture.windowTitle).toBe("Path of Exile 2");
    expect(sent.tray.overlayKey).toBe("Alt + Q");
    expect(sent.shortcuts.actions).toEqual(CONFIG.shortcuts);
    expect(sent.shortcuts.delay).toBe(120);
    expect(sent.gameLogWatcher.logFile).toBe(
      "D:/Games/Path of Exile 2/logs/Client.txt",
    );
    expect(sent.gameConfig.filePath).toBe(
      "D:/Documents/My Games/Path of Exile 2/poe2_production_Config.ini",
    );
    expect(sent.fileWriter.outputPath).toBe("D:/Library");
    expect(switchesOn(sent)).toEqual([]);
    expect(sent.logger.lines).toEqual([]);
  });

  it.each(Object.keys(SWITCHES))(
    "passes %s to its service and turns no other switch on",
    async (name) => {
      const sent = await sendConfig({ ...CONFIG, [name]: true });

      expect(switchesOn(sent)).toEqual([name]);
    },
  );

  it("passes empty paths for the log file and the game config the settings leave empty", async () => {
    const sent = await sendConfig({
      ...CONFIG,
      clientLog: null,
      gameConfig: null,
      libraryOutputPath: null,
    });

    expect(sent.gameLogWatcher.logFile).toBe("");
    expect(sent.gameConfig.filePath).toBe("");
    expect(sent.fileWriter.outputPath).toBeNull();
  });

  it("logs a failed log watcher restart and still passes the other settings", async () => {
    const services = createServices();
    services.gameLogWatcher.failure = new Error("EACCES: permission denied");

    const sent = await sendConfig(CONFIG, services);

    expect(sent.logger.lines).toEqual([
      "error [GameLogWatcher] Cannot restart: EACCES: permission denied",
    ]);
    expect(sent.tray.overlayKey).toBe("Alt + Q");
    expect(sent.gameConfig.filePath).toBe(
      "D:/Documents/My Games/Path of Exile 2/poe2_production_Config.ini",
    );
    expect(sent.fileWriter.outputPath).toBe("D:/Library");
  });
});
