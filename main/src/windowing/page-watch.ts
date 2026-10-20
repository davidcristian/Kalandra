import type { Logger } from "../RemoteLogger";

/** The most times one run reloads the page after its renderer process exits, so a page that exits at each load stops. */
export const MAX_RELOADS = 3;

// Chromium's net::ERR_ABORTED, which a new navigation such as a reload causes
const ERR_ABORTED = -3;

/** The parts of the overlay window's `webContents` that `watchPage()` uses. */
export interface WatchedPage {
  on: {
    (
      event: "did-fail-load",
      listener: (
        event: unknown,
        errorCode: number,
        errorDescription: string,
        validatedURL: string,
        isMainFrame: boolean,
      ) => void,
    ): unknown;
    (
      event: "render-process-gone",
      listener: (
        event: unknown,
        details: { reason: string; exitCode: number },
      ) => void,
    ): unknown;
  };
  isDestroyed: () => boolean;
  reload: () => void;
}

/** Logs a failed load of the overlay page and an exit of its renderer process, and reloads the page after an exit. */
export function watchPage(page: WatchedPage, logger: Logger) {
  let reloads = 0;

  page.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, _url, isMainFrame) => {
      if (!isMainFrame || errorCode === ERR_ABORTED) return;
      logger.write(
        `error [Overlay] The page failed to load: ${errorDescription} (${errorCode})`,
      );
    },
  );

  page.on("render-process-gone", (_event, details) => {
    logger.write(
      `error [Overlay] The page's renderer process exited: ${details.reason} (exit code ${details.exitCode})`,
    );
    if (details.reason === "clean-exit" || page.isDestroyed()) return;
    if (reloads === MAX_RELOADS) {
      logger.write(
        `error [Overlay] The page is not reloaded again after ${MAX_RELOADS} reloads`,
      );
      return;
    }
    reloads++;
    logger.write(
      `info [Overlay] Reloading the page (${reloads} of ${MAX_RELOADS})`,
    );
    page.reload();
  });
}
