import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { Logger } from "../src/RemoteLogger";
import { MAX_RELOADS, watchPage } from "../src/windowing/page-watch";
import { FakeServer } from "./fake-server";

/** Stands in for the overlay window's webContents: its renderer process exits and a reload starts a new one. */
class FakePage extends EventEmitter {
  running = true;
  loads = 1;
  destroyed = false;

  isDestroyed = () => this.destroyed;

  reload = () => {
    this.running = true;
    this.loads++;
  };

  exit(reason: string, exitCode = 1) {
    this.running = false;
    this.emit("render-process-gone", {}, { reason, exitCode });
  }

  failLoad(errorCode: number, errorDescription: string, isMainFrame = true) {
    this.emit(
      "did-fail-load",
      {},
      errorCode,
      errorDescription,
      "http://localhost:4000/index.html",
      isMainFrame,
    );
  }
}

function watch() {
  const server = new FakeServer();
  const page = new FakePage();
  watchPage(page, new Logger(server));
  const logged = () =>
    server
      .logEntries()
      .map((line) => line.replace(/^\[[^\]]*\] /, "").trimEnd());
  return { page, logged };
}

describe("watchPage", () => {
  it("logs a failed load of the page", () => {
    const { page, logged } = watch();

    page.failLoad(-102, "ERR_CONNECTION_REFUSED");

    expect(logged()).toEqual([
      "error [Overlay] The page failed to load: ERR_CONNECTION_REFUSED (-102)",
    ]);
  });

  it("does not log a failed frame inside the page or a load that a reload stopped", () => {
    const { page, logged } = watch();

    page.failLoad(-105, "ERR_NAME_NOT_RESOLVED", false);
    page.failLoad(-3, "ERR_ABORTED");

    expect(logged()).toEqual([]);
  });

  it("logs a renderer process exit and reloads the page", () => {
    const { page, logged } = watch();

    page.exit("crashed", -1073741819);

    expect(page.running).toBe(true);
    expect(page.loads).toBe(2);
    expect(logged()).toEqual([
      "error [Overlay] The page's renderer process exited: crashed (exit code -1073741819)",
      `info [Overlay] Reloading the page (1 of ${MAX_RELOADS})`,
    ]);
  });

  it("stops reloading a page whose renderer process keeps exiting", () => {
    const { page, logged } = watch();

    for (let i = 0; i <= MAX_RELOADS; i++) {
      page.exit("oom");
    }

    expect(page.running).toBe(false);
    expect(page.loads).toBe(1 + MAX_RELOADS);
    expect(logged().at(-1)).toBe(
      `error [Overlay] The page is not reloaded again after ${MAX_RELOADS} reloads`,
    );
  });

  it("does not reload after a clean exit or once the window is closed", () => {
    const { page, logged } = watch();

    page.exit("clean-exit", 0);
    page.destroyed = true;
    page.exit("killed");

    expect(page.loads).toBe(1);
    expect(logged()).toEqual([
      "error [Overlay] The page's renderer process exited: clean-exit (exit code 0)",
      "error [Overlay] The page's renderer process exited: killed (exit code 1)",
    ]);
  });
});
