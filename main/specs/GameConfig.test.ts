import { promises as fs } from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameConfig } from "../src/host-files/GameConfig";
import { Logger } from "../src/RemoteLogger";
import { FakeServer } from "./fake-server";

vi.mock("electron", async () => {
  const os = await import("node:os");
  return { app: { getPath: () => os.tmpdir() } };
});

// 90 is the key code of Z
const BOUND_TO_Z = "[ACTION_KEYS]\nshow_advanced_item_descriptions=90\n";

let folder = "";
let logger: Logger;

function createReader(possiblePaths?: string[]) {
  const server = new FakeServer();
  logger = new Logger(server);
  return new GameConfig(logger, possiblePaths);
}

function configPath(...folders: string[]) {
  return path.join(folder, ...folders, "poe2_production_Config.ini");
}

async function writeConfig(file: string, contents = BOUND_TO_Z) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, contents);
}

function boundTo(value: string): string {
  return `[ACTION_KEYS]\nshow_advanced_item_descriptions=${value}\n`;
}

/** Reads a config file with these contents, and returns the key it read. */
async function readKey(contents: string): Promise<string> {
  const file = configPath();
  await writeConfig(file, contents);
  const reader = createReader();
  await reader.readConfig(file);
  return reader.showModsKey;
}

beforeEach(async () => {
  folder = await fs.mkdtemp(path.join(os.tmpdir(), "kalandra-game-config-"));
});

afterEach(async () => {
  await fs.rm(folder, { recursive: true, force: true });
});

describe("GameConfig.readConfig", () => {
  it("reads the advanced descriptions key from the file at the path in settings", async () => {
    const file = configPath();
    await writeConfig(file);
    const reader = createReader();

    await reader.readConfig(file);

    expect(reader.showModsKey).toBe("Z");
  });

  it("names both default files when both exist", async () => {
    const documents = configPath("documents");
    const proton = configPath("proton");
    await writeConfig(documents);
    await writeConfig(proton);
    const reader = createReader([documents, proton]);

    await reader.readConfig("");

    expect(reader.showModsKey).toBe("Alt");
    expect(logger.history).toContain(
      `error [GameConfig] Found more than one game configuration file, enter one in settings: ${documents}, ${proton}`,
    );
    expect(logger.history).not.toContain("Failed to find");
  });

  it("logs why the file at the path in settings cannot be read", async () => {
    const reader = createReader();

    await reader.readConfig(configPath());

    expect(logger.history).toContain(
      "error [GameConfig] Failed to read game configuration file: ENOENT",
    );
  });

  it("reads the file at the same path again after a read failed", async () => {
    const file = configPath();
    const reader = createReader();

    await reader.readConfig(file);
    expect(logger.history).toContain("Failed to read game configuration file");

    await writeConfig(file);
    await reader.readConfig(file);
    expect(reader.showModsKey).toBe("Z");
  });

  it("looks for the default file again after none was found", async () => {
    const documents = configPath("documents");
    const proton = configPath("proton");
    const reader = createReader([documents, proton]);

    await reader.readConfig("");
    expect(logger.history).toContain(
      "Failed to find game configuration file in the default location.",
    );

    await writeConfig(proton);
    await reader.readConfig("");
    expect(reader.showModsKey).toBe("Z");
  });
});

describe("the advanced descriptions key in the game config", () => {
  it.each([
    ["90 1", "Shift + Z"],
    ["90 2", "Ctrl + Z"],
    ["90 3", "Alt + Z"],
    ["18", "Alt"],
  ])("reads %j as %s", async (value, key) => {
    expect(await readKey(boundTo(value))).toBe(key);
    expect(logger.history).toBe("");
  });

  it("reads a file that starts with a byte order mark", async () => {
    expect(await readKey(String.fromCharCode(0xfeff) + BOUND_TO_Z)).toBe("Z");
  });

  it("uses Alt without an error when the file does not set the key", async () => {
    expect(await readKey("[GENERAL]\nlanguage=en\n")).toBe("Alt");
    expect(logger.history).toBe("");
  });

  it("uses Alt and logs a key code that names no key", async () => {
    expect(await readKey(boundTo("9999"))).toBe("Alt");
    expect(logger.history).toContain(
      "error [GameConfig] Failed to read key: 9999.",
    );
  });

  it("uses Alt and logs a modifier code other than 1, 2 and 3", async () => {
    expect(await readKey(boundTo("90 4"))).toBe("Alt");
    expect(logger.history).toContain(
      "error [GameConfig] Failed to read modifier key: 90 4.",
    );
  });
});

describe("GameConfig.readConfig after a read succeeded", () => {
  it("does not read the file at the same path again", async () => {
    const file = configPath();
    await writeConfig(file);
    const reader = createReader();
    await reader.readConfig(file);

    await writeConfig(file, boundTo("88"));
    await reader.readConfig(file);

    expect(reader.showModsKey).toBe("Z");
  });

  it("reads the file at a new path", async () => {
    const first = configPath("first");
    const second = configPath("second");
    await writeConfig(first);
    await writeConfig(second, boundTo("88"));
    const reader = createReader();
    await reader.readConfig(first);

    await reader.readConfig(second);

    expect(reader.showModsKey).toBe("X");
  });
});
