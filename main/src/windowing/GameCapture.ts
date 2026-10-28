import type { Logger } from "../RemoteLogger";

/** The frame of a page, by the two numbers Electron gives each frame. */
export interface PageFrame {
  processId: number;
  routingId: number;
}

/** The fields of Electron's display media request that `GameCapture` reads. */
export interface CaptureRequest {
  frame: PageFrame | null;
  videoRequested: boolean;
  audioRequested: boolean;
}

/** A window that `desktopCapturer.getSources()` lists. */
export interface WindowSource {
  id: string;
  name: string;
}

export type CaptureAnswer = (streams: { video: WindowSource } | null) => void;

/** The part of Electron's `desktopCapturer` that lists the windows. */
export interface WindowLister {
  getSources: (options: {
    types: Array<"window">;
    thumbnailSize: { width: number; height: number };
  }) => Promise<WindowSource[]>;
}

/** Returns whether `frame` is the main frame of the overlay page. */
export function isSameFrame(
  frame: PageFrame | null,
  page: PageFrame | undefined,
): boolean {
  return (
    frame !== null &&
    page !== undefined &&
    frame.processId === page.processId &&
    frame.routingId === page.routingId
  );
}

/** Handles the page's requests to capture the game window, and grants one on Windows while stash detection is on. */
export class GameCapture {
  private enabled = false;
  private windowTitle = "";
  private lastLine: string | null = null;

  constructor(
    private readonly logger: Pick<Logger, "write">,
    private readonly overlay: { readonly pageFrame: PageFrame | undefined },
    private readonly windows: WindowLister,
  ) {}

  update(enabled: boolean, windowTitle: string): void {
    this.enabled = enabled;
    this.windowTitle = windowTitle;
  }

  handleRequest = (request: CaptureRequest, answer: CaptureAnswer): void => {
    const refusal = this.refusal(request);
    if (refusal) {
      this.log(`warn [GameCapture] Refused a capture: ${refusal}`);
      answer(null);
      return;
    }
    const title = this.windowTitle;
    // A thumbnail size of 0 lists the windows without capturing each of them
    this.windows
      .getSources({ types: ["window"], thumbnailSize: { width: 0, height: 0 } })
      .then((windows) => {
        const game = windows.find((source) => source.name === title);
        if (!game) {
          this.log(`warn [GameCapture] Found no window named "${title}"`);
          answer(null);
          return;
        }
        this.log(`info [GameCapture] Captures the window "${title}"`);
        answer({ video: game });
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.log(`error [GameCapture] Cannot list the windows: ${message}`);
        answer(null);
      });
  };

  private refusal(request: CaptureRequest): string | null {
    if (process.platform !== "win32") {
      return "only Windows captures the game window";
    }
    if (!this.enabled) return "stash detection is off";
    if (!isSameFrame(request.frame, this.overlay.pageFrame)) {
      return "the request is not from the overlay page";
    }
    if (request.audioRequested || !request.videoRequested) {
      return "the request must ask for video alone";
    }
    return null;
  }

  // Each focus change of the game starts a new capture, so a line repeats only after another one
  private log(line: string): void {
    if (line === this.lastLine) return;
    this.lastLine = line;
    this.logger.write(line);
  }
}
