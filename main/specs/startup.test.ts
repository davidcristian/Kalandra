import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { startWhenReady } from "../src/startup";

// Emits `ready` once, like Electron's app: a listener added later never runs,
// while whenReady() resolves before and after the event.
class FakeApp extends EventEmitter {
  quitRequested = false;
  private readonly ready = new Promise<void>((resolve) => {
    this.once("ready", () => {
      resolve();
    });
  });

  async whenReady() {
    await this.ready;
  }

  quit() {
    this.quitRequested = true;
  }
}

function permissionAnswer() {
  let answer!: (granted: boolean) => void;
  const asked = new Promise<boolean>((resolve) => {
    answer = resolve;
  });
  return { ask: async () => await asked, answer };
}

const settle = async () =>
  await new Promise((resolve) => setImmediate(resolve));

function startOn(
  app: FakeApp,
  platform: NodeJS.Platform,
  ask: () => Promise<boolean>,
) {
  const status = { started: false, done: Promise.resolve() };
  status.done = startWhenReady(app, platform, ask, async () => {
    status.started = true;
  });
  return status;
}

describe("startWhenReady", () => {
  it("starts on macOS when the permission is granted after ready", async () => {
    const app = new FakeApp();
    const permission = permissionAnswer();
    const status = startOn(app, "darwin", permission.ask);

    app.emit("ready");
    permission.answer(true);
    await status.done;

    expect(status.started).toBe(true);
    expect(app.quitRequested).toBe(false);
  });

  it("waits for ready on macOS when the permission is granted first", async () => {
    const app = new FakeApp();
    const status = startOn(app, "darwin", async () => true);

    await settle();
    expect(status.started).toBe(false);

    app.emit("ready");
    await status.done;
    expect(status.started).toBe(true);
  });

  it("quits on macOS without starting when the permission is not granted", async () => {
    const app = new FakeApp();
    const permission = permissionAnswer();
    const status = startOn(app, "darwin", permission.ask);

    app.emit("ready");
    permission.answer(false);
    await status.done;

    expect(status.started).toBe(false);
    expect(app.quitRequested).toBe(true);
  });

  it.each(["win32", "linux"] as const)(
    "starts on %s at ready without the macOS permission",
    async (platform) => {
      const app = new FakeApp();
      const status = startOn(app, platform, async () => false);

      await settle();
      expect(status.started).toBe(false);

      app.emit("ready");
      await status.done;
      expect(status.started).toBe(true);
      expect(app.quitRequested).toBe(false);
    },
  );
});
