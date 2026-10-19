import { EventEmitter } from "events";
import { promises as fs } from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IpcEvent, IpcEventPayload } from "../../ipc/types";
import type { ServerEvents } from "../src/server";
import { ConfigStore, type ConfigFiles } from "../src/host-files/ConfigStore";

const electron = vi.hoisted(() => ({
  userData: "",
  exitCodes: [] as number[],
}));

vi.mock("electron", () => ({
  app: {
    getPath: () => electron.userData,
    exit: (code: number) => {
      electron.exitCodes.push(code);
    },
  },
}));

class FakeServer implements ServerEvents {
  readonly sent: IpcEvent[] = [];
  private readonly bus = new EventEmitter();

  onEventAnyClient: ServerEvents["onEventAnyClient"] = (name, cb) => {
    this.bus.on(name, cb);
  };

  sendEventTo: ServerEvents["sendEventTo"] = (_target, event) => {
    this.sent.push(event);
  };

  saveConfig(contents: string) {
    const payload: IpcEventPayload<"CLIENT->MAIN::save-config"> = {
      contents,
      isTemporary: false,
    };
    this.bus.emit("CLIENT->MAIN::save-config", payload);
  }
}

const STEP_1 = '{"step":1}';
const STEP_2 = '{"step":2}';

class SlowFiles implements ConfigFiles {
  finished = 0;

  constructor(private readonly delayMs: Record<string, number> = {}) {}

  writeFile = async (file: string, contents: string) => {
    const delay = this.delayMs[contents] ?? 0;
    await new Promise((resolve) => setTimeout(resolve, delay));
    await fs.writeFile(file, contents);
    this.finished += 1;
  };
}

let server: FakeServer;

beforeEach(async () => {
  electron.userData = await fs.mkdtemp(path.join(os.tmpdir(), "kalandra-cfg-"));
  electron.exitCodes = [];
  server = new FakeServer();
});

afterEach(async () => {
  await fs.rm(electron.userData, { recursive: true, force: true });
});

describe("ConfigStore", () => {
  it("returns null when no config was saved", async () => {
    const store = new ConfigStore(server);
    expect(await store.load()).toBeNull();
  });

  it("keeps the second of two saves in a row when the first write is slower", async () => {
    const files = new SlowFiles({ [STEP_1]: 50 });
    const store = new ConfigStore(server, files);

    server.saveConfig(STEP_1);
    server.saveConfig(STEP_2);
    await vi.waitFor(() => {
      expect(files.finished).toBe(2);
    });

    expect(await store.load()).toBe(STEP_2);
    expect(electron.exitCodes).toEqual([]);
  });

  it("returns the text of a save that is still being written", async () => {
    const store = new ConfigStore(server, new SlowFiles({ [STEP_1]: 50 }));

    server.saveConfig(STEP_1);

    expect(await store.load()).toBe(STEP_1);
  });

  it("sends each saved config to every client", async () => {
    const store = new ConfigStore(server, new SlowFiles());

    server.saveConfig(STEP_1);
    await store.load();

    expect(server.sent).toEqual([
      {
        name: "MAIN->CLIENT::config-changed",
        payload: { contents: STEP_1 },
      },
    ]);
  });

  it("exits with status 1 when the write fails", async () => {
    const store = new ConfigStore(server, {
      writeFile: () => Promise.reject(new Error("the disk is full")),
    });

    server.saveConfig(STEP_1);

    expect(await store.load()).toBeNull();
    expect(electron.exitCodes).toEqual([1]);
  });
});
