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
  return new GameConfig(server, logger, possiblePaths);
}

function configPath(...folders: string[]) {
  return path.join(folder, ...folders, "poe2_production_Config.ini");
}

async function writeConfig(file: string) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, BOUND_TO_Z);
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
});
