import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Logger } from "../src/RemoteLogger";
import { HostClipboard } from "../src/shortcuts/HostClipboard";
import { FakeServer } from "./fake-server";

// Stands in for the system clipboard, which the game and the user write to
const system = vi.hoisted(() => ({ text: "" }));

vi.mock("electron", () => ({
  clipboard: {
    readText: () => system.text,
    writeText: (text: string) => {
      system.text = text;
    },
  },
}));

const ITEM_TEXT = "Item Class: Rings\nRarity: Rare\nGale Loop\nAmethyst Ring";
const PLATFORM = process.platform;

function onPlatform(platform: NodeJS.Platform) {
  Object.defineProperty(process, "platform", { value: platform });
}

function createClipboard(restoreClipboard: boolean) {
  const clipboard = new HostClipboard(new Logger(new FakeServer()));
  clipboard.updateOptions(restoreClipboard);
  return clipboard;
}

/** Reads item text with Restore clipboard off and runs `during` 100 ms in, before the read gives up at 500 ms. */
async function failedCopy(during = () => {}) {
  const read = createClipboard(false).readItemText();
  const failed = expect(read).rejects.toThrow("Reading clipboard timed out");
  await vi.advanceTimersByTimeAsync(100);
  during();
  await vi.advanceTimersByTimeAsync(1000);
  await failed;
}

beforeEach(() => {
  vi.useFakeTimers();
  system.text = "";
});

afterEach(() => {
  vi.useRealTimers();
  onPlatform(PLATFORM);
});

describe("HostClipboard.readItemText", () => {
  it("writes the copied text back on Linux after a failed copy with Restore clipboard off", async () => {
    onPlatform("linux");
    system.text = "copied text";

    await failedCopy();

    expect(system.text).toBe("copied text");
  });

  it("writes no empty text on Linux after a failed copy over item text", async () => {
    onPlatform("linux");
    system.text = ITEM_TEXT;

    await failedCopy();

    expect(system.text).not.toBe("");
  });

  it.each(["linux", "win32", "darwin"] as const)(
    "keeps text copied during a failed copy on %s with Restore clipboard off",
    async (platform) => {
      onPlatform(platform);
      system.text = "copied text";

      await failedCopy(() => {
        system.text = "copied later";
      });

      expect(system.text).toBe("copied later");
    },
  );

  it("resolves with the item text that the game copies on Linux", async () => {
    onPlatform("linux");
    system.text = "copied text";

    const read = createClipboard(false).readItemText();
    await vi.advanceTimersByTimeAsync(100);
    system.text = ITEM_TEXT;
    await vi.advanceTimersByTimeAsync(100);

    await expect(read).resolves.toBe(ITEM_TEXT);
    expect(system.text).toBe(ITEM_TEXT);
  });
});
