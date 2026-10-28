import { createGlobalState } from "@vueuse/core";
import { shallowRef, watch } from "vue";
import { AppConfig } from "@/web/Config";
import { Host } from "@/web/background/IPC";
import { logToMain } from "@/web/background/log-to-main";
import { requireWidget } from "@/web/settings/utils";
import { type CaptureEnvironment, openGameCapture } from "./frame-source";
import { createStashDetector } from "./stash-detector";
import type { GridCorrection, Viewport } from "./stash-grid";
import { useStashReader } from "./use-stash-reader";
import type { StashPricesWidget } from "./widget";

const NO_CORRECTION: GridCorrection = { unit: "px", left: 0, top: 0, cell: 0 };

/** Returns the page's way to capture: `getDisplayMedia()`, a video element and an offscreen canvas. */
export function browserCapture(): CaptureEnvironment<
  HTMLVideoElement,
  MediaStream
> {
  return {
    getDisplayMedia: async (options) =>
      await navigator.mediaDevices.getDisplayMedia(options),
    play: async (stream) => {
      const video = document.createElement("video");
      video.muted = true;
      video.srcObject = stream;
      await video.play();
      return video;
    },
    createContext: (width, height) => {
      const context = new OffscreenCanvas(width, height).getContext("2d", {
        willReadFrequently: true,
      });
      if (context === null) throw new Error("the page has no 2D canvas");
      return context;
    },
  };
}

function readViewport(): Viewport {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    dpr: window.devicePixelRatio,
  };
}

/** Returns the app's one detector of the open stash tab, which follows the widget, the listings and the game's focus. */
export const useStashDetector = createGlobalState(() => {
  const reader = useStashReader();
  const gameActive = shallowRef(false);
  const viewport = shallowRef(readViewport());
  const widget = () =>
    requireWidget<StashPricesWidget>("stash-prices", AppConfig());
  const detector = createStashDetector({
    settings: () => ({ enabled: widget().enabled, correction: NO_CORRECTION }),
    listings: () => reader.state.listings,
    platform: () => {
      if (!Host.isElectron) return "browser";
      return navigator.userAgent.includes("Windows") ? null : "not-windows";
    },
    gameActive: () => gameActive.value,
    viewport: () => viewport.value,
    openCapture: async () => await openGameCapture(browserCapture()),
    log: (message) => {
      logToMain("warn", message);
    },
  });
  Host.onEvent("MAIN->OVERLAY::focus-change", (focus) => {
    gameActive.value = focus.game;
  });
  window.addEventListener("resize", () => {
    viewport.value = readViewport();
  });
  watch(
    () => [
      widget().enabled,
      reader.state.listings,
      gameActive.value,
      viewport.value,
    ],
    () => {
      detector.update();
    },
    { immediate: true },
  );
  return detector;
});
