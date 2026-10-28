import type {
  IpcEvent,
  IpcEventPayload,
  UpdateInfo,
  HostState,
} from "@ipc/types";
import type { ConfigProblem } from "@ipc/config-problem";
import type { UnregisteredHotkey } from "@ipc/hotkeys";
import { shallowRef } from "vue";
import Sockette from "sockette";

/** The number of lines of main's log that `Host.logs` keeps for Settings, Debug. */
export const LOG_LINES = 1000;

/** The number of events that `Host.sendEvent()` keeps while the socket to main is not open. */
export const QUEUED_EVENTS = 100;

function keepLastLines(text: string, count: number): string {
  let cut = text.length - 1;
  for (let i = 0; i < count; i++) {
    cut = text.lastIndexOf("\n", cut - 1);
    if (cut === -1) return text;
  }
  return text.slice(cut + 1);
}

class HostTransport {
  private evBus = new EventTarget();
  private socket!: Sockette;
  private isOpen = false;
  private queue: Array<{ name: IpcEvent["name"]; text: string }> = [];
  logs = shallowRef("");
  version = shallowRef("0.0.00000");
  updateInfo = shallowRef<UpdateInfo>({ state: "initial" });
  /** The hotkeys of the saved config that main did not register, which the Settings window marks. */
  unregisteredHotkeys = shallowRef<UnregisteredHotkey[]>([]);
  /** Why main sent no saved config at start although config.json exists, which the start message names. */
  configProblem = shallowRef<ConfigProblem | null>(null);
  /** The focus of the game window and the overlay that main sent last, also sent to each page that connects. */
  focus = shallowRef<IpcEventPayload<"MAIN->OVERLAY::focus-change">>({
    game: false,
    overlay: false,
  });

  async init() {
    this.onEvent("MAIN->CLIENT::log-entry", (entry) => {
      this.logs.value = keepLastLines(
        this.logs.value + entry.message,
        LOG_LINES,
      );
    });
    this.onEvent("MAIN->CLIENT::updater-state", (info) => {
      this.updateInfo.value = info;
    });
    this.onEvent("MAIN->CLIENT::unregistered-hotkeys", (e) => {
      this.unregisteredHotkeys.value = e.hotkeys;
    });
    this.onEvent("MAIN->OVERLAY::focus-change", (focus) => {
      this.focus.value = focus;
    });
    await new Promise((resolve) => {
      this.socket = new Sockette(`ws://${window.location.host}/events`, {
        onmessage: (e) => {
          this.selfDispatch(JSON.parse(e.data));
        },
        onopen: (e) => {
          // main sends its whole log history first on each connection, including one after a reconnect
          this.logs.value = "";
          this.isOpen = true;
          for (const { text } of this.queue.splice(0)) {
            this.socket.send(text);
          }
          resolve(e);
        },
        onclose: () => {
          this.isOpen = false;
        },
      });
    });
  }

  selfDispatch(event: IpcEvent) {
    this.evBus.dispatchEvent(
      new CustomEvent(event.name, {
        detail: event.payload,
      }),
    );
  }

  sendEvent(event: IpcEvent) {
    if (!this.isElectron && event.name.startsWith("OVERLAY->MAIN")) {
      return;
    }
    const text = JSON.stringify(event);
    if (this.isOpen) {
      this.socket.send(text);
      return;
    }
    // A closed socket drops the text without an error, and a connecting one throws
    if (this.queue.length >= QUEUED_EVENTS) {
      const [dropped] = this.queue.splice(0, 1);
      console.warn(
        `Dropped ${dropped.name}: ${QUEUED_EVENTS} newer events wait for the socket to main to open`,
      );
    }
    this.queue.push({ name: event.name, text });
  }

  onEvent<Name extends IpcEvent["name"]>(
    name: Name,
    cb: (payload: IpcEventPayload<Name>) => void,
  ): AbortController {
    const controller = new AbortController();
    if (!this.isElectron && name.startsWith("MAIN->OVERLAY")) {
      return controller;
    }

    this.evBus.addEventListener(
      name,
      (e) => {
        cb((e as CustomEvent<IpcEventPayload<Name>>).detail);
      },
      { signal: controller.signal },
    );
    return controller;
  }

  async getConfig(): Promise<string | null> {
    const response = await fetch("/config");
    const config = (await response.json()) as HostState;
    this.version.value = config.version;
    this.updateInfo.value = config.updater;
    this.configProblem.value = config.configProblem;
    return config.contents;
  }

  async importFile(file: File): Promise<string> {
    // main reads the extension from the URL path, which a # or ? in the name would cut short
    const response = await fetch(`/uploads/${encodeURIComponent(file.name)}`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: file,
    });
    if (!response.ok) {
      throw new Error(`Storing ${file.name} failed (${response.status})`);
    }
    const body = (await response.json()) as { name: string };
    return body.name;
  }

  proxy = async (
    hostAndPath: string,
    init?: RequestInit,
  ): Promise<Response> => {
    const headers = new Headers(init?.headers);
    // main's /proxy route returns 403 without it (PROXY_HEADER in main/src/proxy.ts)
    headers.set("x-kalandra-proxy", "1");
    return await window.fetch(`/proxy/${hostAndPath}`, { ...init, headers });
  };

  get isElectron() {
    return navigator.userAgent.includes("Electron");
  }
}

export const MainProcess = new HostTransport();
export const Host = MainProcess;
