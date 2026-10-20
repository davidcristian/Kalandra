import type {
  IpcEvent,
  IpcEventPayload,
  UpdateInfo,
  HostState,
} from "@ipc/types";
import { shallowRef } from "vue";
import Sockette from "sockette";

/** The number of lines of main's log that `Host.logs` keeps for Settings, Debug. */
export const LOG_LINES = 1000;

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
  logs = shallowRef("");
  version = shallowRef("0.0.00000");
  updateInfo = shallowRef<UpdateInfo>({ state: "initial" });

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
    await new Promise((resolve) => {
      this.socket = new Sockette(`ws://${window.location.host}/events`, {
        onmessage: (e) => {
          this.selfDispatch(JSON.parse(e.data));
        },
        onopen: resolve,
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
    this.socket.send(JSON.stringify(event));
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
    // TODO: refactor this
    this.version.value = config.version;
    this.updateInfo.value = config.updater;
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

  proxy: (typeof window)["fetch"] = async (url, init) => {
    const headers = new Headers(init?.headers);
    // main's /proxy route returns 403 without it (PROXY_HEADER in main/src/proxy.ts)
    headers.set("x-kalandra-proxy", "1");
    return await window.fetch(`/proxy/${url as string}`, { ...init, headers });
  };

  get isElectron() {
    return navigator.userAgent.includes("Electron");
  }
}

export const MainProcess = new HostTransport();
export const Host = MainProcess;
