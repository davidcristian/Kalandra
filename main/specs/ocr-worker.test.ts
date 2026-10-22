import { EventEmitter } from "node:events";
import { MessageChannel } from "node:worker_threads";
import * as Comlink from "comlink";
import nodeEndpoint from "comlink/dist/umd/node-adapter";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Logger } from "../src/RemoteLogger";
import { OcrWorker } from "../src/vision/link-main";
import { FakeServer } from "./fake-server";

vi.mock("electron", async () => {
  const os = await import("node:os");
  return { app: { getPath: () => os.tmpdir() } };
});

const never = async () => await new Promise<never>(() => {});

const GEMS = {
  recognized: [{ text: "Fireball", confidence: 90 }],
};

/** Stands in for the OCR worker thread: answers calls with `body` through Comlink, as vision.js does. */
class FakeThread extends EventEmitter {
  private channel = new MessageChannel();

  constructor(body: Record<string, (...args: never[]) => Promise<unknown>>) {
    super();
    Comlink.expose(body, nodeEndpoint(this.channel.port2));
    this.channel.port1.on("message", (data) => this.emit("message", data));
  }

  postMessage(message: unknown, transfer?: ArrayBuffer[]) {
    this.channel.port1.postMessage(message, transfer);
  }

  close() {
    this.channel.port1.close();
    this.channel.port2.close();
  }
}

const threads: FakeThread[] = [];

function startThread(body: ConstructorParameters<typeof FakeThread>[0]) {
  const thread = new FakeThread(body);
  threads.push(thread);
  return thread;
}

function screenshot() {
  return { width: 2, height: 1, data: new Uint8Array(8) };
}

function loggedLines(server: FakeServer) {
  return server
    .logEntries()
    .map((line) => line.replace(/^\[[^\]]*\] /, "").trimEnd());
}

afterEach(() => {
  for (const thread of threads.splice(0)) thread.close();
});

describe("OcrWorker", () => {
  it("passes on the reply of a running worker", async () => {
    const server = new FakeServer();
    const thread = startThread({
      init: async () => {},
      findHeistGems: async () => GEMS,
    });
    const worker = await OcrWorker.create(new Logger(server), thread);

    await expect(worker.findHeistGems(screenshot())).resolves.toEqual(GEMS);
    expect(loggedLines(server)).toEqual([]);
  });

  it("finishes starting when the worker exits before it replies to init", async () => {
    const server = new FakeServer();
    const thread = startThread({ init: never });

    const created = OcrWorker.create(new Logger(server), thread);
    thread.emit("exit", 1);
    const worker = await created;

    expect(worker).toBeInstanceOf(OcrWorker);
    expect(loggedLines(server)).toEqual([
      "error [OCR] Worker exited with code 1",
    ]);
  });

  it("rejects a pending call and every later call once the worker fails", async () => {
    const server = new FakeServer();
    const thread = startThread({ init: async () => {}, findHeistGems: never });
    const worker = await OcrWorker.create(new Logger(server), thread);

    const pending = worker.findHeistGems(screenshot());
    // Node emits exit after the error of a worker that throws
    thread.emit("error", new Error("memory access out of bounds"));
    thread.emit("exit", 1);

    const stopped = "The OCR worker failed: memory access out of bounds";
    await expect(pending).rejects.toThrow(stopped);
    await expect(worker.findHeistGems(screenshot())).rejects.toThrow(stopped);
    await expect(worker.updateOptions("ru")).resolves.toBeUndefined();
    expect(loggedLines(server)).toEqual([
      "error [OCR] Worker failed: memory access out of bounds",
    ]);
  });
});
