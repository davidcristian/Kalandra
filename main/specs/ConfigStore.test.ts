import { EventEmitter } from "events";
import { promises as fs } from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IpcEvent, IpcEventPayload } from "../../ipc/types";
import type { ServerEvents } from "../src/server";
import { ConfigStore, type ConfigFiles } from "../src/host-files/ConfigStore";
import { Logger } from "../src/RemoteLogger";

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

  saveConfig(contents: string, isTemporary = false) {
    const payload: IpcEventPayload<"CLIENT->MAIN::save-config"> = {
      contents,
      isTemporary,
    };
    this.bus.emit("CLIENT->MAIN::save-config", payload);
  }
}

const STEP_1 = '{"step":1}';
const STEP_2 = '{"step":2}';

async function readText(file: string): Promise<string> {
  return await fs.readFile(file, "utf8");
}

class SlowFiles implements ConfigFiles {
  finished = 0;

  constructor(private readonly delayMs: Record<string, number> = {}) {}

  readFile = readText;

  writeFile = async (file: string, contents: string) => {
    const delay = this.delayMs[contents] ?? 0;
    await new Promise((resolve) => setTimeout(resolve, delay));
    await fs.writeFile(file, contents);
    this.finished += 1;
  };

  rename = async (from: string, to: string) => {
    await fs.rename(from, to);
  };
}

function lockedFiles(failures: number): ConfigFiles {
  let left = failures;
  return {
    readFile: readText,
    writeFile: async (file, contents) => {
      await fs.writeFile(file, contents);
    },
    rename: async (from, to) => {
      if (left > 0) {
        left -= 1;
        const err = new Error("EPERM: operation not permitted, rename");
        throw Object.assign(err, { code: "EPERM" });
      }
      await fs.rename(from, to);
    },
  };
}

const BUSY = "EBUSY: resource busy or locked, open";

// Fails the first `failures` reads as Windows does while another program holds the file open
function busyFiles(failures: number): ConfigFiles {
  let left = failures;
  return {
    readFile: async (file) => {
      if (left > 0) {
        left -= 1;
        throw Object.assign(new Error(BUSY), { code: "EBUSY" });
      }
      return await readText(file);
    },
    writeFile: async (file, contents) => {
      await fs.writeFile(file, contents);
    },
    rename: fs.rename,
  };
}

function configFolder() {
  return path.join(electron.userData, "apt-data");
}

async function saveOnDisk(contents: string) {
  await fs.mkdir(configFolder(), { recursive: true });
  await fs.writeFile(path.join(configFolder(), "config.json"), contents);
}

async function readOnDisk(name: string): Promise<string> {
  return await fs.readFile(path.join(configFolder(), name), "utf8");
}

let server: FakeServer;
let logger: Logger;

function createStore(files?: ConfigFiles) {
  return new ConfigStore(server, logger, files);
}

beforeEach(async () => {
  electron.userData = await fs.mkdtemp(path.join(os.tmpdir(), "kalandra-cfg-"));
  electron.exitCodes = [];
  server = new FakeServer();
  logger = new Logger(server);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await fs.rm(electron.userData, { recursive: true, force: true });
});

describe("ConfigStore", () => {
  it("returns no contents and no problem when no config was saved", async () => {
    const store = createStore();
    expect(await store.load()).toEqual({ contents: null, problem: null });
  });

  it("keeps the second of two saves in a row when the first write is slower", async () => {
    const files = new SlowFiles({ [STEP_1]: 50 });
    const store = createStore(files);

    server.saveConfig(STEP_1);
    server.saveConfig(STEP_2);

    expect((await store.load()).contents).toBe(STEP_2);
    expect(files.finished).toBe(2);
    expect(electron.exitCodes).toEqual([]);
  });

  it("returns the text of a save that is still being written", async () => {
    const store = createStore(new SlowFiles({ [STEP_1]: 50 }));

    server.saveConfig(STEP_1);

    expect((await store.load()).contents).toBe(STEP_1);
  });

  it("sends each saved config to every client", async () => {
    const store = createStore(new SlowFiles());

    server.saveConfig(STEP_1);
    await store.load();

    expect(server.sent).toEqual([
      {
        name: "MAIN->CLIENT::config-changed",
        payload: { contents: STEP_1 },
      },
    ]);
  });

  it("logs why a write failed and keeps the app running", async () => {
    const store = createStore({
      readFile: readText,
      writeFile: async () => {
        throw new Error("the disk is full");
      },
      rename: fs.rename,
    });

    server.saveConfig(STEP_1);

    expect((await store.load()).contents).toBeNull();
    expect(logger.history).toContain(
      "error [ConfigStore] Failed to save the config: the disk is full",
    );
    expect(electron.exitCodes).toEqual([]);
  });

  it("replaces an existing config.json with the saved text", async () => {
    await saveOnDisk(STEP_1);
    const store = createStore();

    server.saveConfig(STEP_2);

    expect((await store.load()).contents).toBe(STEP_2);
    expect(await fs.readdir(configFolder())).toEqual(["config.json"]);
  });

  it("keeps the saved config when a write stops partway", async () => {
    await saveOnDisk(STEP_1);
    const store = createStore({
      readFile: readText,
      writeFile: async (file, contents) => {
        await fs.writeFile(file, contents.slice(0, contents.length / 2));
        throw new Error("the process stopped during the write");
      },
      rename: fs.rename,
    });

    server.saveConfig(STEP_2);

    expect((await store.load()).contents).toBe(STEP_1);
    expect(logger.history).toContain("the process stopped during the write");
  });

  it("replaces config.json once another program closes it", async () => {
    await saveOnDisk(STEP_1);
    const store = createStore(lockedFiles(2));

    server.saveConfig(STEP_2);

    expect((await store.load()).contents).toBe(STEP_2);
    expect(electron.exitCodes).toEqual([]);
  });

  it("keeps the saved config when config.json stays open in another program", async () => {
    await saveOnDisk(STEP_1);
    const store = createStore(lockedFiles(Infinity));

    server.saveConfig(STEP_2);

    expect((await store.load()).contents).toBe(STEP_1);
    expect(logger.history).toContain("EPERM: operation not permitted, rename");
  });

  it("writes a temporary save and every later save to config.json.tmp, and leaves config.json as it was", async () => {
    await saveOnDisk("a config that is not JSON");
    const store = createStore();

    server.saveConfig(STEP_1, true);
    expect((await store.load()).contents).toBe(STEP_1);
    server.saveConfig(STEP_2);
    expect((await store.load()).contents).toBe(STEP_2);

    expect(await readOnDisk("config.json")).toBe("a config that is not JSON");
    expect(await readOnDisk("config.json.tmp")).toBe(STEP_2);
  });

  it("writes nothing in development, where Vite serves the page", async () => {
    vi.stubEnv("VITE_DEV_SERVER_URL", "http://localhost:5173");
    await saveOnDisk(STEP_1);
    const store = createStore();

    server.saveConfig(STEP_2);

    expect((await store.load()).contents).toBe(STEP_1);
    expect(server.sent).toEqual([
      { name: "MAIN->CLIENT::config-changed", payload: { contents: STEP_2 } },
    ]);
  });

  it("returns the problem and logs it when config.json is a folder", async () => {
    const file = path.join(configFolder(), "config.json");
    await fs.mkdir(file, { recursive: true });

    const { contents, problem } = await createStore().load();

    expect(contents).toBeNull();
    expect(problem).toMatchObject({ reason: "unreadable", file });
    expect(logger.history).toContain(
      `error [ConfigStore] Failed to read ${file}`,
    );
  });

  it("keeps config.json and logs each save while another program holds it at start", async () => {
    await saveOnDisk(STEP_1);
    const store = createStore(busyFiles(1));

    expect(await store.load()).toEqual({
      contents: null,
      problem: {
        reason: "unreadable",
        file: path.join(configFolder(), "config.json"),
        message: BUSY,
      },
    });
    server.saveConfig(STEP_2);

    expect((await store.load()).contents).toBe(STEP_1);
    expect(logger.history).toContain(
      "warn [ConfigStore] Did not save the config",
    );
    expect(
      server.sent.filter((e) => e.name === "MAIN->CLIENT::config-changed"),
    ).toEqual([
      { name: "MAIN->CLIENT::config-changed", payload: { contents: STEP_2 } },
    ]);
  });

  it("saves again once a later read of config.json succeeds", async () => {
    await saveOnDisk(STEP_1);
    const store = createStore(busyFiles(1));

    expect((await store.load()).problem).not.toBeNull();
    expect(await store.load()).toEqual({ contents: STEP_1, problem: null });
    server.saveConfig(STEP_2);

    expect((await store.load()).contents).toBe(STEP_2);
  });
});
