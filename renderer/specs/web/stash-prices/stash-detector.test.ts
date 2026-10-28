import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { StashListing } from "@/web/stash-prices/stash-listings";
import {
  createStashDetector,
  type DetectorSources,
  FRAME_MS,
  RETRY_MS,
} from "@/web/stash-prices/stash-detector";
import {
  type GridCorrection,
  stashGrid,
  type Viewport,
} from "@/web/stash-prices/stash-grid";
import { FakeScreen, placed } from "./fake-capture";
import { type SyntheticItem, SyntheticFrame } from "./synthetic-stash";

const VIEW: Viewport = { width: 1280, height: 720, dpr: 1 };
const NONE: GridCorrection = { unit: "px", left: 0, top: 0, cell: 0 };

const ITEMS: SyntheticItem[] = [
  { x: 0, y: 0, w: 2, h: 3 },
  { x: 0, y: 3, w: 1, h: 1, unusable: true },
  { x: 1, y: 3, w: 1, h: 1 },
  { x: 2, y: 0, w: 1, h: 4 },
];

let tabFrame: SyntheticFrame;
let sceneFrame: SyntheticFrame;
let quadFrame: SyntheticFrame;
let windowedFrame: SyntheticFrame;

beforeAll(() => {
  const normal = stashGrid(VIEW, false, NONE);
  const quad = stashGrid(VIEW, true, NONE);
  tabFrame = new SyntheticFrame(1280, 720).gameWorld().stash(normal, 12, ITEMS);
  sceneFrame = new SyntheticFrame(1280, 720, 2).gameWorld();
  quadFrame = new SyntheticFrame(1280, 720, 3)
    .gameWorld()
    .stash(quad, 24, ITEMS);
  // A windowed game: a 1 pixel border and a 31 pixel title bar around the client area
  const inWindow = { ...normal, left: normal.left + 1, top: normal.top + 32 };
  windowedFrame = new SyntheticFrame(1282, 753, 4)
    .gameWorld()
    .stash(inWindow, 12, ITEMS);
});

describe("createStashDetector", () => {
  let screen: FakeScreen;
  let settings: { enabled: boolean; correction: GridCorrection };
  let listings: StashListing[];
  let platform: ReturnType<DetectorSources["platform"]>;
  let gameActive: boolean;
  let logged: string[];

  function createDetector(view = VIEW) {
    return createStashDetector({
      settings: () => settings,
      listings: () => listings,
      platform: () => platform,
      gameActive: () => gameActive,
      viewport: () => view,
      openCapture: screen.openCapture,
      log: (message) => logged.push(message),
    });
  }

  /** Lets the capture open, then reads `count` frames. */
  async function frames(count: number) {
    await vi.advanceTimersByTimeAsync(count * FRAME_MS);
  }

  beforeEach(() => {
    vi.useFakeTimers();
    screen = new FakeScreen();
    screen.frame = sceneFrame;
    settings = { enabled: true, correction: NONE };
    listings = ITEMS.map(placed);
    platform = null;
    gameActive = true;
    logged = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("captures only while the feature is on, in the overlay on Windows, with items, and while the game is active", async () => {
    const detector = createDetector();
    const statusFor = async (change: () => void) => {
      change();
      detector.update();
      await frames(0);
      return detector.state.capture;
    };

    expect(await statusFor(() => (settings.enabled = false))).toBe("off");
    expect(
      await statusFor(() => {
        settings.enabled = true;
        platform = "browser";
      }),
    ).toBe("browser");
    expect(await statusFor(() => (platform = "not-windows"))).toBe(
      "not-windows",
    );
    expect(
      await statusFor(() => {
        platform = null;
        listings = [placed({ x: 0, y: 0, w: 1, h: 2 })];
      }),
    ).toBe("few-items");
    expect(
      await statusFor(() => {
        listings = ITEMS.map(placed);
        gameActive = false;
      }),
    ).toBe("paused");
    expect(screen.opened).toBe(0);

    expect(await statusFor(() => (gameActive = true))).toBe("running");
    expect(screen.opened).toBe(1);
    expect(await statusFor(() => (gameActive = false))).toBe("paused");
    expect(screen.closed).toBe(1);
  });

  it("opens the tab after two frames that show it, and closes it after two that miss it", async () => {
    const detector = createDetector();
    detector.update();
    screen.frame = tabFrame;

    await frames(1);
    expect(detector.state.open).toBe(false);
    expect(detector.state.match).toMatchObject({ seen: true, quad: false });
    await frames(1);
    expect(detector.state).toMatchObject({ open: true, source: "capture" });

    screen.frame = sceneFrame;
    await frames(1);
    expect(detector.state.open).toBe(true);
    screen.frame = tabFrame;
    await frames(1);
    screen.frame = sceneFrame;
    await frames(2);
    expect(detector.state.open).toBe(false);
  });

  it("finds the tab in a windowed game's frame and in a quad tab", async () => {
    const detector = createDetector();
    detector.update();
    screen.frame = windowedFrame;
    await frames(2);
    expect(detector.state).toMatchObject({ open: true, quad: false });

    screen.frame = sceneFrame;
    await frames(2);
    screen.frame = quadFrame;
    await frames(2);
    expect(detector.state).toMatchObject({ open: true, quad: true });
    expect(detector.state.grid).toEqual(stashGrid(VIEW, true, NONE));
  });

  it("reads a large frame at a smaller scale and finds a quad tab in it", async () => {
    const view: Viewport = { width: 1280, height: 720, dpr: 2 };
    const detector = createDetector(view);
    screen.frame = new SyntheticFrame(2560, 1440, 5)
      .gameWorld()
      .stash(
        stashGrid({ ...view, dpr: 1, height: 1440 }, true, NONE),
        24,
        ITEMS,
      );
    detector.update();

    await frames(2);

    expect(detector.state).toMatchObject({ open: true, quad: true });
    expect(detector.state.grid).toEqual(stashGrid(view, true, NONE));
  });

  it("reads no frame before the first one comes", async () => {
    const detector = createDetector();
    screen.frame = null;
    detector.update();

    await frames(3);

    expect(detector.state).toMatchObject({ capture: "running", match: null });
  });

  it("keeps what it saw while the game is not active, and forgets it when the tab has too few items", async () => {
    const detector = createDetector();
    detector.update();
    screen.frame = tabFrame;
    await frames(2);

    gameActive = false;
    detector.update();
    expect(detector.state).toMatchObject({ open: true, capture: "paused" });

    gameActive = true;
    listings = [];
    detector.update();
    expect(detector.state).toMatchObject({ open: false, capture: "few-items" });
  });

  it("logs a failed capture once, tries again after 30 seconds, and logs a new failure", async () => {
    screen.failure = new Error("Permission denied");
    const detector = createDetector();
    detector.update();
    await frames(0);

    expect(detector.state).toMatchObject({
      capture: "failed",
      error: "Permission denied",
    });
    await vi.advanceTimersByTimeAsync(RETRY_MS);
    expect(screen.opened).toBe(2);
    screen.failure = new Error("Invalid capture constraints");
    await vi.advanceTimersByTimeAsync(RETRY_MS);
    screen.failure = null;
    await vi.advanceTimersByTimeAsync(RETRY_MS);

    expect(detector.state).toMatchObject({ capture: "running", error: null });
    expect(logged).toEqual([
      "Stash detection cannot capture the game window: Permission denied",
      "Stash detection cannot capture the game window: Invalid capture constraints",
    ]);
  });

  it("asks again 30 seconds after the capture ends, as when the game closes", async () => {
    const detector = createDetector();
    detector.update();
    await frames(1);

    screen.ended = true;
    await frames(1);
    expect(detector.state).toMatchObject({
      capture: "failed",
      error: "the capture ended",
    });
    expect(screen.closed).toBe(1);

    screen.ended = false;
    await vi.advanceTimersByTimeAsync(RETRY_MS);
    expect(detector.state.capture).toBe("running");
  });

  it.each([
    [
      "an Error",
      new Error("the page has no 2D canvas"),
      "the page has no 2D canvas",
    ],
    ["a string", "out of memory", "out of memory"],
  ])(
    "fails when a frame cannot be read, with %s",
    async (_kind, failure, message) => {
      const detector = createDetector();
      detector.update();
      await frames(0);

      screen.readFailure = failure;
      await frames(1);

      expect(detector.state).toMatchObject({
        capture: "failed",
        error: message,
      });
      expect(screen.closed).toBe(1);
    },
  );

  it("closes a capture that main grants after the game lost the focus", async () => {
    screen.holdRequests = true;
    const detector = createDetector();
    detector.update();
    await frames(0);
    expect(detector.state.capture).toBe("starting");

    gameActive = false;
    detector.update();
    screen.answer();
    await frames(1);

    expect(screen.closed).toBe(1);
    expect(detector.state.capture).toBe("paused");
  });

  it("drops a failure of a request that was stopped", async () => {
    screen.holdRequests = true;
    screen.failure = new Error("Permission denied");
    const detector = createDetector();
    detector.update();
    detector.stop();
    screen.answer();
    await frames(1);

    expect(logged).toEqual([]);
  });

  it("shows and hides the tab with the hotkey until the capture sees it open or close", async () => {
    const detector = createDetector();
    platform = "not-windows";
    detector.update();

    detector.toggle();
    expect(detector.state).toMatchObject({ open: true, source: "hotkey" });
    expect(detector.state.grid).toEqual(stashGrid(VIEW, false, NONE));

    platform = null;
    detector.update();
    await frames(3);
    expect(detector.state).toMatchObject({ open: true, source: "hotkey" });

    screen.frame = tabFrame;
    await frames(2);
    expect(detector.state).toMatchObject({ open: true, source: "capture" });
    detector.toggle();
    await frames(2);
    expect(detector.state).toMatchObject({ open: false, source: "hotkey" });
  });

  it("closes the tab and stops the capture when the feature is turned off", async () => {
    const detector = createDetector();
    detector.update();
    screen.frame = tabFrame;
    await frames(2);

    settings.enabled = false;
    detector.update();
    detector.toggle();

    expect(detector.state).toMatchObject({ open: false, capture: "off" });
    expect(screen.closed).toBe(1);
  });

  it("places the grid with the correction and stops everything on stop()", async () => {
    settings.correction = { unit: "px", left: 4, top: -2, cell: 1 };
    const detector = createDetector();
    detector.update();
    await frames(1);

    expect(detector.state.grid).toEqual(
      stashGrid(VIEW, false, settings.correction),
    );
    detector.stop();
    await frames(2);
    expect(screen.closed).toBe(1);
    expect(detector.state.open).toBe(false);
  });
});
