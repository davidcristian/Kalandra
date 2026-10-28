import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import type { IpcEvent } from "@ipc/types";
import { priceCheckWidgetMock, setupTests } from "@specs/vitest.setup";
import type { PixelImage } from "@/web/stash-prices/cell-classifier";
import { FRAME_MS } from "@/web/stash-prices/stash-detector";
import {
  type GridCorrection,
  stashGrid,
  type Viewport,
} from "@/web/stash-prices/stash-grid";
import type * as UseStashDetector from "@/web/stash-prices/use-stash-detector";
import {
  stashPricesDefault,
  type StashPricesWidget,
} from "@/web/stash-prices/widget";
import { drawScaled, placed } from "./fake-capture";
import { type SyntheticItem, SyntheticFrame } from "./synthetic-stash";

// PriceTrend.vue imports vue3-apexcharts, which reads window when it loads; no test draws a chart
vi.mock("vue3-apexcharts", () => ({ default: {} }));

vi.mock("@/web/background/Leagues", async () => {
  const { shallowRef } = await import("vue");
  return { useLeagues: () => ({ selectedId: shallowRef("Standard") }) };
});

const ITEMS: SyntheticItem[] = [
  { x: 0, y: 0, w: 2, h: 3 },
  { x: 2, y: 0, w: 1, h: 4 },
];
const WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Electron/44.9.3";
const VIEW: Viewport = { width: 1280, height: 720, dpr: 1 };
const NONE: GridCorrection = { unit: "px", left: 0, top: 0, cell: 0 };

class FakeTrack {
  readyState = "live";
  stop() {
    this.readyState = "ended";
  }
}

/** Stands in for the page: the window, its capture through getDisplayMedia(), a video element and a canvas. */
class FakePage {
  innerWidth = 1280;
  innerHeight = 720;
  devicePixelRatio = 1;
  frame: PixelImage = new SyntheticFrame(1280, 720).gameWorld();
  refusal: Error | null = null;
  canvas = true;
  readonly tracks: FakeTrack[] = [];
  readonly requests: unknown[] = [];
  private resized: () => void = () => {};

  window = {
    get innerWidth() {
      return page.innerWidth;
    },
    get innerHeight() {
      return page.innerHeight;
    },
    get devicePixelRatio() {
      return page.devicePixelRatio;
    },
    addEventListener: (_name: string, listener: () => void) => {
      this.resized = listener;
    },
  };

  navigator = {
    userAgent: WINDOWS,
    mediaDevices: {
      getDisplayMedia: async (options: unknown) => {
        this.requests.push(options);
        if (this.refusal) throw this.refusal;
        const track = new FakeTrack();
        this.tracks.push(track);
        return { getVideoTracks: () => [track], getTracks: () => [track] };
      },
    },
  };

  document = {
    documentElement: { lang: "" },
    createElement: () => ({
      muted: false,
      srcObject: null,
      videoWidth: 1280,
      videoHeight: 720,
      play: async () => {},
    }),
  };

  OffscreenCanvas = class {
    getContext() {
      if (!page.canvas) return null;
      let area = { width: 0, height: 0, scale: 1 };
      return {
        imageSmoothingEnabled: true,
        drawImage: (...args: [unknown, ...number[]]) => {
          const [, , , sw, sh, , , dw] = args;
          area = { width: sw, height: sh, scale: dw / sw };
        },
        getImageData: () => drawScaled(page.frame, area),
      };
    }
  };

  resize(height: number) {
    this.innerHeight = height;
    this.resized();
  }
}

let page: FakePage;

function enabledWidget(): StashPricesWidget {
  return { ...stashPricesDefault(), wmId: 3, enabled: true };
}

describe("useStashDetector", () => {
  let useStashDetector: typeof UseStashDetector.useStashDetector;
  let sent: IpcEvent[];
  let focus: (payload: { game: boolean; overlay: boolean }) => void;
  let widgetAction: (payload: { target: string }) => void;

  async function start(isElectron = true) {
    const { Host } = await import("@/web/background/IPC");
    Object.defineProperty(Host, "isElectron", {
      value: isElectron,
      configurable: true,
    });
    vi.mocked(Host.sendEvent).mockImplementation((event) => {
      sent.push(event);
    });
    vi.mocked(Host.onEvent).mockImplementation((name, cb) => {
      if (name === "MAIN->OVERLAY::focus-change") {
        focus = cb as typeof focus;
      } else if (name === "MAIN->CLIENT::widget-action") {
        widgetAction = cb as typeof widgetAction;
      }
      return new AbortController();
    });
    const { useStashReader } = await import(
      "@/web/stash-prices/use-stash-reader"
    );
    useStashReader().state.listings = ITEMS.map(placed);
    ({ useStashDetector } = await import(
      "@/web/stash-prices/use-stash-detector"
    ));
    return useStashDetector();
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    sent = [];
    page = new FakePage();
    vi.stubGlobal("window", page.window);
    vi.stubGlobal("navigator", page.navigator);
    vi.stubGlobal("document", page.document);
    vi.stubGlobal("OffscreenCanvas", page.OffscreenCanvas);
    setupTests({
      widgets: [priceCheckWidgetMock(), enabledWidget()],
    });
  });

  afterEach(() => {
    useStashDetector().stop();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("captures the game window once it is active and sees the tab in its frames", async () => {
    const { state } = await start();
    expect(state.capture).toBe("paused");

    focus({ game: true, overlay: false });
    await nextTick();
    page.frame = new SyntheticFrame(1280, 720)
      .gameWorld()
      .stash(stashGrid(VIEW, false, NONE), 12, ITEMS);
    await vi.advanceTimersByTimeAsync(2 * FRAME_MS);

    expect(page.requests).toEqual([
      { video: { frameRate: { ideal: 2, max: 2 } }, audio: false },
    ]);
    expect(state).toMatchObject({ capture: "running", open: true });

    focus({ game: false, overlay: true });
    await nextTick();
    expect(page.tracks[0].readyState).toBe("ended");
    expect(state).toMatchObject({ capture: "paused", open: true });
  });

  it("moves the grid when the window changes size", async () => {
    const { state } = await start();

    page.resize(1080);
    await nextTick();

    expect(state.grid).toEqual({ left: 17, top: 126.5, cell: 52.5 });
  });

  it("marks the tab open and closed with the stash prices hotkey alone", async () => {
    const { state } = await start();

    widgetAction({ target: "stopwatch-start-stop:4" });
    expect(state.open).toBe(false);
    widgetAction({ target: "stash-prices-toggle" });
    expect(state).toMatchObject({ open: true, source: "hotkey" });
    widgetAction({ target: "stash-prices-toggle" });
    expect(state.open).toBe(false);
  });

  it("places the grid with the widget's correction, and captures nothing with the capture turned off", async () => {
    const widget: StashPricesWidget = {
      ...enabledWidget(),
      captureEnabled: false,
      gridCorrection: { unit: "%", left: 1, top: 0, cell: 0 },
    };
    setupTests({ widgets: [priceCheckWidgetMock(), widget] });
    const { state } = await start();

    focus({ game: true, overlay: false });
    await nextTick();

    expect(state.capture).toBe("setting-off");
    expect(state.grid.left).toBeCloseTo(720 * (17 / 1080) + 7.2);
    expect(page.requests).toEqual([]);
  });

  it("asks for no capture in a browser tab or outside Windows", async () => {
    expect((await start(false)).state.capture).toBe("browser");

    vi.resetModules();
    page.navigator.userAgent =
      "Mozilla/5.0 (X11; Linux x86_64) Electron/44.9.3";
    expect((await start()).state.capture).toBe("not-windows");
    expect(page.requests).toEqual([]);
  });

  it("logs a refused capture to main's log", async () => {
    page.refusal = new Error("Permission denied");
    const { state } = await start();

    focus({ game: true, overlay: false });
    await vi.advanceTimersByTimeAsync(0);

    expect(state).toMatchObject({
      capture: "failed",
      error: "Permission denied",
    });
    expect(sent).toContainEqual({
      name: "CLIENT->MAIN::log-entry",
      payload: {
        level: "warn",
        message:
          "Stash detection cannot capture the game window: Permission denied",
      },
    });
  });

  it("fails when the page has no 2D canvas", async () => {
    page.canvas = false;
    const { state } = await start();

    focus({ game: true, overlay: false });
    await vi.advanceTimersByTimeAsync(FRAME_MS);

    expect(state).toMatchObject({
      capture: "failed",
      error: "the page has no 2D canvas",
    });
  });
});
