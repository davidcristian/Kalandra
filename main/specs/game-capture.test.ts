import { afterEach, describe, expect, it } from "vitest";
import {
  type CaptureRequest,
  GameCapture,
  isSameFrame,
  type WindowLister,
  type PageFrame,
  type WindowSource,
} from "../src/windowing/GameCapture";

const PLATFORM = process.platform;

function onPlatform(platform: NodeJS.Platform) {
  Object.defineProperty(process, "platform", { value: platform });
}

afterEach(() => {
  onPlatform(PLATFORM);
});

const OVERLAY_PAGE: PageFrame = { processId: 7, routingId: 1 };

const GAME: WindowSource = { id: "window:4242:0", name: "Path of Exile 2" };

/** Stands in for the desktop: lists its windows, or fails with `failure` once `failing` is set, and keeps each list request. */
class FakeDesktop {
  windows: WindowSource[] = [
    { id: "window:100:0", name: "Kalandra" },
    GAME,
    { id: "window:300:0", name: "Path of Exile 2 - Wiki - Browser" },
  ];

  failing = false;
  failure: unknown;
  readonly requests: Array<Parameters<WindowLister["getSources"]>[0]> = [];

  getSources: WindowLister["getSources"] = async (options) => {
    this.requests.push(options);
    if (this.failing) throw this.failure;
    return this.windows;
  };
}

class FakeLogger {
  readonly lines: string[] = [];

  write(line: string) {
    this.lines.push(line);
  }
}

function overlayRequest(changes: Partial<CaptureRequest> = {}): CaptureRequest {
  return {
    frame: { ...OVERLAY_PAGE },
    videoRequested: true,
    audioRequested: false,
    ...changes,
  };
}

function createCapture(pageFrame: PageFrame | null = OVERLAY_PAGE) {
  const desktop = new FakeDesktop();
  const logger = new FakeLogger();
  const overlay = { pageFrame: pageFrame ?? undefined };
  const capture = new GameCapture(logger, overlay, desktop);
  capture.update(true, "Path of Exile 2");
  return { desktop, logger, capture };
}

/** Sends a request and returns what the handler answered. */
async function ask(
  capture: GameCapture,
  request = overlayRequest(),
): Promise<WindowSource | null> {
  return await new Promise((resolve) => {
    capture.handleRequest(request, (streams) => {
      resolve(streams ? streams.video : null);
    });
  });
}

describe("GameCapture", () => {
  it("answers the overlay page with the window named as the window title setting, on Windows", async () => {
    onPlatform("win32");
    const { desktop, logger, capture } = createCapture();

    expect(await ask(capture)).toEqual(GAME);
    expect(desktop.requests).toEqual([
      { types: ["window"], thumbnailSize: { width: 0, height: 0 } },
    ]);
    expect(logger.lines).toEqual([
      'info [GameCapture] Captures the window "Path of Exile 2"',
    ]);
  });

  it("uses the window title of the last update", async () => {
    onPlatform("win32");
    const { desktop, capture } = createCapture();
    desktop.windows.push({
      id: "window:500:0",
      name: "Path of Exile 2 (DX12)",
    });

    capture.update(true, "Path of Exile 2 (DX12)");

    expect(await ask(capture)).toEqual({
      id: "window:500:0",
      name: "Path of Exile 2 (DX12)",
    });
  });

  it.each(["linux", "darwin"] as const)(
    "refuses every request on %s without listing the windows",
    async (platform) => {
      onPlatform(platform);
      const { desktop, logger, capture } = createCapture();

      expect(await ask(capture)).toBeNull();
      expect(desktop.requests).toEqual([]);
      expect(logger.lines).toEqual([
        "warn [GameCapture] Refused a capture: only Windows captures the game window",
      ]);
    },
  );

  it("refuses while stash detection is off, and answers again once it is on", async () => {
    onPlatform("win32");
    const { desktop, logger, capture } = createCapture();
    capture.update(false, "Path of Exile 2");

    expect(await ask(capture)).toBeNull();
    expect(desktop.requests).toEqual([]);

    capture.update(true, "Path of Exile 2");
    expect(await ask(capture)).toEqual(GAME);
    expect(logger.lines).toEqual([
      "warn [GameCapture] Refused a capture: stash detection is off",
      'info [GameCapture] Captures the window "Path of Exile 2"',
    ]);
  });

  it.each([
    ["a web view in another process", { processId: 9, routingId: 1 }],
    ["another frame of the same process", { processId: 7, routingId: 2 }],
    ["a frame that is gone", null],
  ])("refuses a request from %s", async (_name, frame) => {
    onPlatform("win32");
    const { desktop, logger, capture } = createCapture();

    expect(await ask(capture, overlayRequest({ frame }))).toBeNull();
    expect(desktop.requests).toEqual([]);
    expect(logger.lines).toEqual([
      "warn [GameCapture] Refused a capture: the request is not from the overlay page",
    ]);
  });

  it("refuses every request while the overlay window has no page, as with --no-overlay", async () => {
    onPlatform("win32");
    const { capture } = createCapture(null);

    expect(await ask(capture)).toBeNull();
  });

  it.each([
    ["audio as well", { audioRequested: true }],
    ["no video", { videoRequested: false }],
  ])("refuses a request for %s", async (_name, changes) => {
    onPlatform("win32");
    const { logger, capture } = createCapture();

    expect(await ask(capture, overlayRequest(changes))).toBeNull();
    expect(logger.lines).toEqual([
      "warn [GameCapture] Refused a capture: the request must ask for video alone",
    ]);
  });

  it("refuses when no window has the title, and logs it once until something changes", async () => {
    onPlatform("win32");
    const { desktop, logger, capture } = createCapture();
    desktop.windows = desktop.windows.filter((source) => source !== GAME);

    expect(await ask(capture)).toBeNull();
    expect(await ask(capture)).toBeNull();
    desktop.windows.push(GAME);
    expect(await ask(capture)).toEqual(GAME);
    expect(await ask(capture)).toEqual(GAME);
    desktop.windows = [];
    expect(await ask(capture)).toBeNull();

    expect(logger.lines).toEqual([
      'warn [GameCapture] Found no window named "Path of Exile 2"',
      'info [GameCapture] Captures the window "Path of Exile 2"',
      'warn [GameCapture] Found no window named "Path of Exile 2"',
    ]);
  });

  it.each([
    ["an Error", new Error("Failed to get sources."), "Failed to get sources."],
    ["a string", "no access", "no access"],
  ])(
    "refuses and logs the message when listing the windows fails with %s",
    async (_name, failure, message) => {
      onPlatform("win32");
      const { desktop, logger, capture } = createCapture();
      desktop.failing = true;
      desktop.failure = failure;

      expect(await ask(capture)).toBeNull();
      expect(logger.lines).toEqual([
        `error [GameCapture] Cannot list the windows: ${message}`,
      ]);
    },
  );
});

describe("isSameFrame", () => {
  it("compares the process and the routing number of two frames", () => {
    expect(isSameFrame({ processId: 7, routingId: 1 }, OVERLAY_PAGE)).toBe(
      true,
    );
    expect(isSameFrame({ processId: 7, routingId: 3 }, OVERLAY_PAGE)).toBe(
      false,
    );
    expect(isSameFrame({ processId: 8, routingId: 1 }, OVERLAY_PAGE)).toBe(
      false,
    );
    expect(isSameFrame(null, OVERLAY_PAGE)).toBe(false);
    expect(isSameFrame(OVERLAY_PAGE, undefined)).toBe(false);
  });
});
