import type { MessagePort } from "node:worker_threads";
import * as Comlink from "comlink";
import nodeEndpoint from "comlink/dist/umd/node-adapter";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkerAPI } from "../src/vision/link-worker";

// Stands in for OpenCV and Tesseract: keeps each call, and holds each language change until the test ends it
const vision = vi.hoisted(() => ({
  calls: [] as string[],
  endChange: new Map<string, (error?: Error) => void>(),
  port: undefined as MessagePort | undefined,
}));

vi.mock("worker_threads", async () => {
  const actual =
    await vi.importActual<typeof import("worker_threads")>("worker_threads");
  const channel = new actual.MessageChannel();
  vision.port = channel.port1;
  return { ...actual, parentPort: channel.port2 };
});

vi.mock("../src/vision/wasm-bindings", () => ({
  init: async (binDir: string) => {
    vision.calls.push(`init ${binDir}`);
  },
  changeLanguage: async (lang: string) => {
    vision.calls.push(`start ${lang}`);
    await new Promise<void>((resolve, reject) => {
      vision.endChange.set(lang, (error) => {
        vision.calls.push(`end ${lang}`);
        if (error) reject(error);
        else resolve();
      });
    });
  },
}));

vi.mock("../src/vision/HeistGemFinder", () => ({
  HeistGemFinder: {
    create: async (binDir: string) => {
      vision.calls.push(`finder ${binDir}`);
      return {
        ocrScreenshot: (image: { width: number; height: number }) => {
          vision.calls.push(`ocr ${image.width}x${image.height}`);
          return { recognized: [{ text: "Fireball", confidence: 90 }] };
        },
      };
    },
  },
}));

const BIN = "/bin";
const SCREENSHOT = { width: 2, height: 1, data: new Uint8Array(8) };

let api: WorkerAPI;

/** Waits until the worker has run `call`. */
async function ran(call: string) {
  await vi.waitFor(() => {
    expect(vision.calls).toContain(call);
  });
}

/** Ends the language change the worker started for `lang`. */
async function endChange(lang: string, error?: Error) {
  await ran(`start ${lang}`);
  vision.endChange.get(lang)!(error);
}

beforeAll(async () => {
  await import("../src/vision/link-worker");
  api = Comlink.wrap(nodeEndpoint(vision.port!));
  await api.init(BIN);
});

beforeEach(() => {
  vision.calls = [];
});

describe("the OCR worker thread", () => {
  it("loads the bindings before it creates the gem finder from the same folder", async () => {
    await api.init(BIN);

    expect(vision.calls).toEqual([`init ${BIN}`, `finder ${BIN}`]);
  });

  it("finds gems once the language change in progress ends", async () => {
    const change = api.changeLanguage("ru", BIN);
    const search = api.findHeistGems(SCREENSHOT);
    await ran("start ru");
    // A call sent after the search shows that the worker has received the search
    await api.init(BIN);
    expect(vision.calls).not.toContain("ocr 2x1");

    await endChange("ru");
    await change;

    expect(await search).toEqual({
      recognized: [{ text: "Fireball", confidence: 90 }],
    });
    expect(vision.calls).toEqual([
      "start ru",
      `init ${BIN}`,
      `finder ${BIN}`,
      "end ru",
      "ocr 2x1",
    ]);
  });

  it("starts a language change after the one before it ends", async () => {
    const english = api.changeLanguage("en", BIN);
    const russian = api.changeLanguage("ru", BIN);
    await api.init(BIN);

    await endChange("en");
    await endChange("ru");
    await Promise.all([english, russian]);

    expect(vision.calls).toEqual([
      "start en",
      `init ${BIN}`,
      `finder ${BIN}`,
      "end en",
      "start ru",
      "end ru",
    ]);
  });

  it("starts each of three quick language changes after the one before it ends", async () => {
    const changes = [
      api.changeLanguage("en", BIN),
      api.changeLanguage("ru", BIN),
      api.changeLanguage("ko", BIN),
    ];
    await api.init(BIN);

    await endChange("en");
    await endChange("ru");
    await endChange("ko");
    await Promise.all(changes);

    expect(
      vision.calls.filter(
        (call) => !call.startsWith("init") && !call.startsWith("finder"),
      ),
    ).toEqual([
      "start en",
      "end en",
      "start ru",
      "end ru",
      "start ko",
      "end ko",
    ]);
  });

  it("changes the language and finds gems after a language change fails", async () => {
    const unsupported = api.changeLanguage("de", BIN);
    await endChange("de", new Error("Unsupported language"));
    await expect(unsupported).rejects.toThrow("Unsupported language");

    const english = api.changeLanguage("en", BIN);
    await endChange("en");
    await english;

    expect(await api.findHeistGems(SCREENSHOT)).toEqual({
      recognized: [{ text: "Fireball", confidence: 90 }],
    });
  });

  it("fails a gem search while the last language change has failed", async () => {
    const unsupported = api.changeLanguage("de", BIN);
    await endChange("de", new Error("Unsupported language"));
    await expect(unsupported).rejects.toThrow("Unsupported language");

    await expect(api.findHeistGems(SCREENSHOT)).rejects.toThrow(
      "Unsupported language",
    );
    expect(vision.calls).not.toContain("ocr 2x1");
  });
});
