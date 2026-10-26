import { screen, globalShortcut } from "electron";
import { uIOhook, UiohookKey, UiohookWheelEvent } from "uiohook-napi";
import { isModKey, mergeTwoHotkeys } from "../../../ipc/KeyToCode";
import { typeInChat, stashSearch } from "./text-box";
import { shortcutToElectron } from "./accelerator";
import { registrableActions } from "./registrable-actions";
import { WidgetAreaTracker } from "../windowing/WidgetAreaTracker";
import { HostClipboard } from "./HostClipboard";
import { logKeyPresses } from "./key-log";
import { OcrWorker } from "../vision/link-main";
import type { ShortcutAction } from "../../../ipc/types";
import type { UnregisteredHotkey } from "../../../ipc/hotkeys";
import type { Logger } from "../RemoteLogger";
import type { OverlayWindow } from "../windowing/OverlayWindow";
import type { GameWindow } from "../windowing/GameWindow";
import type { GameConfig } from "../host-files/GameConfig";
import type { ServerEvents } from "../server";

type UiohookKeyT = keyof typeof UiohookKey;

export class Shortcuts {
  private actions: ShortcutAction[] = [];
  private unregistered: UnregisteredHotkey[] = [];
  private taken: string[] = [];
  private stashScroll = false;
  private logKeys = false;
  private areaTracker: WidgetAreaTracker;
  private clipboard: HostClipboard;

  static async create(
    logger: Logger,
    overlay: OverlayWindow,
    poeWindow: GameWindow,
    gameConfig: GameConfig,
    server: ServerEvents,
  ) {
    const ocrWorker = await OcrWorker.create(logger);
    const shortcuts = new Shortcuts(
      logger,
      overlay,
      poeWindow,
      gameConfig,
      server,
      ocrWorker,
    );
    return shortcuts;
  }

  private constructor(
    private logger: Logger,
    private overlay: OverlayWindow,
    private poeWindow: GameWindow,
    private gameConfig: GameConfig,
    private server: ServerEvents,
    private ocrWorker: OcrWorker,
  ) {
    this.areaTracker = new WidgetAreaTracker(server, overlay);
    this.clipboard = new HostClipboard(logger);

    this.poeWindow.on("active-change", (isActive) => {
      process.nextTick(() => {
        if (isActive === this.poeWindow.isActive) {
          if (isActive) {
            this.register();
          } else {
            this.unregister();
          }
        }
      });
    });

    this.server.onEventAnyClient("CLIENT->MAIN::user-action", (e) => {
      if (e.action === "stash-search") {
        void stashSearch(e.text, this.clipboard, this.overlay);
      }
    });

    logKeyPresses(this.logger, this.poeWindow, () => this.logKeys);

    uIOhook.on("wheel", (e) => {
      if (!e.ctrlKey || !this.poeWindow.isActive || !this.stashScroll) return;

      if (!isStashArea(e, this.poeWindow)) {
        if (e.rotation > 0) {
          uIOhook.keyTap(UiohookKey.ArrowRight);
        } else if (e.rotation < 0) {
          uIOhook.keyTap(UiohookKey.ArrowLeft);
        }
      }
    });
  }

  updateDelay(delay: number) {
    this.clipboard.updateDelay(delay);
  }

  updateActions(
    actions: ShortcutAction[],
    stashScroll: boolean,
    logKeys: boolean,
    restoreClipboard: boolean,
    language: string,
  ) {
    this.stashScroll = stashScroll;
    this.logKeys = logKeys;
    this.clipboard.updateOptions(restoreClipboard);
    this.ocrWorker.updateOptions(language);
    const registrable = registrableActions(
      actions,
      this.gameConfig.showModsKey,
      this.logger,
    );
    this.actions = registrable.actions;
    this.unregistered = registrable.unregistered;
    this.taken = this.taken.filter((shortcut) =>
      this.actions.some((action) => action.shortcut === shortcut),
    );
    // Each page sends update-host-config when it loads, so this also gives the list to a page that connects later
    this.sendUnregistered();
  }

  private sendUnregistered() {
    const taken = this.taken.map((shortcut) => ({
      shortcut,
      reason: "taken" as const,
    }));
    this.server.sendEventTo("broadcast", {
      name: "MAIN->CLIENT::unregistered-hotkeys",
      payload: { hotkeys: [...this.unregistered, ...taken] },
    });
  }

  private register() {
    const taken: string[] = [];
    for (const entry of this.actions) {
      const isOk = globalShortcut.register(
        shortcutToElectron(entry.shortcut),
        () => {
          if (this.logKeys) {
            this.logger.write(
              `debug [Shortcuts] Action type: ${entry.action.type}`,
            );
          }

          if (entry.keepModKeys) {
            const nonModKey = entry.shortcut
              .split(" + ")
              .filter((key) => !isModKey(key))[0];
            uIOhook.keyToggle(UiohookKey[nonModKey as UiohookKeyT], "up");
          } else {
            entry.shortcut
              .split(" + ")
              .reverse()
              .forEach((key) => {
                uIOhook.keyToggle(UiohookKey[key as UiohookKeyT], "up");
              });
          }

          if (entry.action.type === "toggle-overlay") {
            this.areaTracker.removeListeners();
            this.overlay.toggleActiveState();
          } else if (entry.action.type === "paste-in-chat") {
            const { text, send } = entry.action;
            void typeInChat(text, send, this.clipboard);
          } else if (entry.action.type === "trigger-event") {
            this.server.sendEventTo("broadcast", {
              name: "MAIN->CLIENT::widget-action",
              payload: { target: entry.action.target },
            });
          } else if (entry.action.type === "stash-search") {
            void stashSearch(entry.action.text, this.clipboard, this.overlay);
          } else if (entry.action.type === "copy-item") {
            const { action } = entry;

            const pressPosition = screen.getCursorScreenPoint();
            const modKeys = entry.shortcut.split(" + ").filter(isModKey);

            this.clipboard
              .readItemText(() => {
                pressKeysToCopyItemText(
                  entry.keepModKeys ? modKeys : undefined,
                  this.gameConfig.showModsKey,
                );
              })
              .then((clipboard) => {
                this.areaTracker.removeListeners();
                this.server.sendEventTo("last-active", {
                  name: "MAIN->CLIENT::item-text",
                  payload: {
                    target: action.target,
                    clipboard,
                    position: pressPosition,
                    focusOverlay: Boolean(action.focusOverlay),
                  },
                });
                if (action.focusOverlay && this.overlay.wasUsedRecently) {
                  this.overlay.assertOverlayActive();
                }
              })
              .catch(() => {});
          } else if (
            entry.action.type === "ocr-text" &&
            entry.action.target === "heist-gems"
          ) {
            if (process.platform !== "win32") return;

            const { action } = entry;
            const imageData = this.poeWindow.screenshot();
            this.ocrWorker
              .findHeistGems({
                width: this.poeWindow.bounds.width,
                height: this.poeWindow.bounds.height,
                data: imageData,
              })
              .then((result) => {
                this.server.sendEventTo("last-active", {
                  name: "MAIN->CLIENT::ocr-text",
                  payload: {
                    target: action.target,
                    paragraphs: result.recognized.map((p) => p.text),
                  },
                });
              })
              .catch(() => {});
          }
        },
      );

      if (!isOk) {
        this.logger.write(
          `error [Shortcuts] Failed to register a shortcut "${entry.shortcut}". It is already registered by another application.`,
        );
        taken.push(entry.shortcut);
      }

      if (entry.action.type === "test-only") {
        globalShortcut.unregister(shortcutToElectron(entry.shortcut));
      }
    }
    if (taken.join("\n") !== this.taken.join("\n")) {
      this.taken = taken;
      this.sendUnregistered();
    }
  }

  private unregister() {
    globalShortcut.unregisterAll();
  }
}

function pressKeysToCopyItemText(
  pressedModKeys: string[] = [],
  showModsKey: string,
) {
  let keys = mergeTwoHotkeys("Ctrl + C", showModsKey).split(" + ");
  keys = keys.filter((key) => key !== "C");
  if (process.platform !== "darwin") {
    // On macOS the held keys are pressed again too: without that, a shortcut such as
    // "Alt + any letter" does not copy the advanced mod descriptions.
    keys = keys.filter((key) => !pressedModKeys.includes(key));
  }

  for (const key of keys) {
    uIOhook.keyToggle(UiohookKey[key as UiohookKeyT], "down");
  }

  uIOhook.keyTap(UiohookKey.C);

  // The game dropped key releases sent right after the copy key, so they are sent 10 ms later
  setTimeout(() => {
    keys.reverse();
    for (const key of keys) {
      uIOhook.keyToggle(UiohookKey[key as UiohookKeyT], "up");
    }
  }, 10);
}

function isStashArea(mouse: UiohookWheelEvent, poeWindow: GameWindow): boolean {
  if (mouse.x > poeWindow.bounds.x + poeWindow.uiSidebarWidth) return false;

  return (
    mouse.y > poeWindow.bounds.y + (poeWindow.bounds.height * 154) / 1600 &&
    mouse.y < poeWindow.bounds.y + (poeWindow.bounds.height * 1192) / 1600
  );
}
