import { shallowReactive } from "vue";
import type { FrameSource } from "./frame-source";
import {
  frameMapping,
  type Grid,
  type GridCorrection,
  gridInFrame,
  needsQuad,
  sampleArea,
  scaleGrid,
  sideOf,
  stashGrid,
  type Viewport,
} from "./stash-grid";
import type { StashListing } from "./stash-listings";
import {
  expectedCells,
  MIN_ITEM_CELLS,
  matchTab,
  type TabMatch,
} from "./tab-match";

/** The time between two frames that the detector reads, at the capture's frame rate. */
export const FRAME_MS = 500;

/** The wait before the detector asks for the capture again after it failed or ended. */
export const RETRY_MS = 30_000;

/** The frames in a row that must show the tab to open it, and that must miss it to close it. */
export const FRAMES_TO_CHANGE = 2;

/** Why the capture does not run, or what it does. */
export type CaptureStatus =
  | "browser"
  | "not-windows"
  | "off"
  | "setting-off"
  | "few-items"
  | "paused"
  | "starting"
  | "running"
  | "failed";

export interface DetectorState {
  /** Whether the stash shows the tab, as the capture saw it or the hotkey set it. */
  open: boolean;
  source: "capture" | "hotkey";
  quad: boolean;
  /** The tab's grid in CSS pixels of the overlay. */
  grid: Grid;
  capture: CaptureStatus;
  /** Why the last capture failed. */
  error: string | null;
  /** How the last frame matched the listings. */
  match: TabMatch | null;
}

export interface DetectorSettings {
  enabled: boolean;
  /** Whether the user lets Windows capture the game window. */
  capture: boolean;
  correction: GridCorrection;
}

export interface DetectorSources {
  settings: () => DetectorSettings;
  listings: () => readonly StashListing[];
  /** Why this page cannot capture the game window, or null when it can. */
  platform: () => "browser" | "not-windows" | null;
  gameActive: () => boolean;
  viewport: () => Viewport;
  openCapture: () => Promise<FrameSource>;
  /** Writes a line to main's log. */
  log: (message: string) => void;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function itemCells(listings: readonly StashListing[]): number {
  return expectedCells(listings, sideOf(needsQuad(listings))).filter(Boolean)
    .length;
}

/** Creates the detector of the open stash tab: the capture runs only while it can decide something. */
export function createStashDetector(sources: DetectorSources) {
  const state = shallowReactive<DetectorState>({
    open: false,
    source: "capture",
    quad: false,
    grid: { left: 0, top: 0, cell: 0 },
    capture: "off",
    error: null,
    match: null,
  });
  let frames: FrameSource | null = null;
  let opening = 0;
  let openings = 0;
  let frameTimer: ReturnType<typeof setInterval> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let captureOpen = false;
  let seenQuad: boolean | null = null;
  let run = 0;
  let lastLogged: string | null = null;

  function blocked(): CaptureStatus | null {
    const listings = sources.listings();
    const settings = sources.settings();
    if (!settings.enabled) return "off";
    const platform = sources.platform();
    if (platform !== null) return platform;
    if (!settings.capture) return "setting-off";
    if (itemCells(listings) < MIN_ITEM_CELLS) return "few-items";
    return sources.gameActive() ? null : "paused";
  }

  function placeGrid() {
    const { correction } = sources.settings();
    state.grid = stashGrid(sources.viewport(), state.quad, correction);
  }

  function stopCapture() {
    if (frameTimer !== null) clearInterval(frameTimer);
    frameTimer = null;
    frames?.close();
    frames = null;
    opening = 0;
    run = 0;
  }

  function stopRetry() {
    if (retryTimer !== null) clearTimeout(retryTimer);
    retryTimer = null;
  }

  function show(open: boolean) {
    state.open = open;
    state.source = "capture";
    if (open && seenQuad !== null) state.quad = seenQuad;
    placeGrid();
  }

  function fail(message: string) {
    stopCapture();
    state.capture = "failed";
    state.error = message;
    if (message !== lastLogged) {
      lastLogged = message;
      sources.log(`Stash detection cannot capture the game window: ${message}`);
    }
    retryTimer = setTimeout(() => {
      retryTimer = null;
      update();
    }, RETRY_MS);
  }

  function readFrame() {
    if (frames === null) return;
    if (frames.ended()) {
      fail("the capture ended");
      return;
    }
    const size = frames.size();
    if (size === null) return;
    const view = sources.viewport();
    const { correction } = sources.settings();
    const mapping = frameMapping(size, view);
    const area = sampleArea(
      size,
      gridInFrame(stashGrid(view, false, correction), mapping),
    );
    const gridOf = (quad: boolean) =>
      scaleGrid(
        gridInFrame(stashGrid(view, quad, correction), mapping),
        area.scale,
      );
    let match: TabMatch;
    try {
      match = matchTab(frames.read(area), gridOf, sources.listings());
    } catch (error) {
      fail(errorText(error));
      return;
    }
    state.match = match;
    if (match.seen) seenQuad = match.quad;
    // A run counts the frames in a row that disagree with what the capture shows now
    run = match.seen === captureOpen ? 0 : run + 1;
    if (run >= FRAMES_TO_CHANGE) {
      captureOpen = match.seen;
      run = 0;
      show(captureOpen);
    }
  }

  async function startCapture() {
    openings += 1;
    const attempt = openings;
    opening = attempt;
    state.capture = "starting";
    try {
      const opened = await sources.openCapture();
      if (opening !== attempt) {
        opened.close();
        return;
      }
      opening = 0;
      frames = opened;
      state.capture = "running";
      state.error = null;
      lastLogged = null;
      frameTimer = setInterval(readFrame, FRAME_MS);
    } catch (error) {
      if (opening !== attempt) return;
      fail(errorText(error));
    }
  }

  /** Starts or stops the capture for the current settings, listings, platform, game focus and window size. */
  function update() {
    const reason = blocked();
    placeGrid();
    if (reason !== null) {
      stopCapture();
      stopRetry();
      state.capture = reason;
      state.error = null;
      // A paused capture keeps what it saw, and the hotkey's choice stays until the feature is off
      if (reason !== "paused") captureOpen = false;
      if (
        reason === "off" ||
        (reason !== "paused" && state.source === "capture")
      ) {
        state.open = false;
        state.match = null;
      }
      return;
    }
    if (frames !== null || opening !== 0 || retryTimer !== null) return;
    void startCapture();
  }

  /** Shows or hides the tab by hand, until the capture sees it open or close. */
  function toggle() {
    if (!sources.settings().enabled) return;
    state.open = !state.open;
    state.source = "hotkey";
    state.quad = seenQuad ?? needsQuad(sources.listings());
    placeGrid();
  }

  function stop() {
    stopCapture();
    stopRetry();
    captureOpen = false;
    state.open = false;
    state.match = null;
  }

  return { state, update, toggle, stop };
}
