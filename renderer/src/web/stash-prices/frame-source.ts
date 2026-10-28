import type { PixelImage } from "./cell-classifier";
import type { Size } from "./stash-grid";

/** The frames per second the capture asks for: enough to follow the stash opening and closing. */
export const FRAME_RATE = 2;

/** The part of `MediaStream` that the capture uses. */
export interface StreamLike {
  getVideoTracks: () => ReadonlyArray<{ readonly readyState: string }>;
  getTracks: () => ReadonlyArray<{ stop: () => void }>;
}

/** The part of `HTMLVideoElement` that gives the size of the frames. */
export interface VideoLike {
  readonly videoWidth: number;
  readonly videoHeight: number;
}

/** The part of a canvas 2D context that reads a frame of the video. */
export interface FrameContext<Video> {
  imageSmoothingEnabled: boolean;
  drawImage(
    video: Video,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void;
  getImageData(x: number, y: number, w: number, h: number): PixelImage;
}

/** What the capture needs from the page: `getDisplayMedia()`, a video that plays a stream, and a canvas. */
export interface CaptureEnvironment<
  Video extends VideoLike,
  Stream extends StreamLike,
> {
  getDisplayMedia: (options: DisplayMediaStreamOptions) => Promise<Stream>;
  /** Plays the stream in a video element that the page never shows. */
  play: (stream: Stream) => Promise<Video>;
  createContext: (width: number, height: number) => FrameContext<Video>;
}

/** The game window's capture: the newest frame, read on request. */
export interface FrameSource {
  /** The size of the frames, or null before the first one. */
  size: () => Size | null;
  /** Returns the top left `width` by `height` pixels of the newest frame, drawn at `scale`. */
  read: (area: Size & { scale: number }) => PixelImage;
  /** Whether the capture ended, as when the game window closed. */
  ended: () => boolean;
  close: () => void;
}

/** Asks main for the game window's capture and plays it, video only, at `FRAME_RATE`. */
export async function openGameCapture<
  Video extends VideoLike,
  Stream extends StreamLike,
>(env: CaptureEnvironment<Video, Stream>): Promise<FrameSource> {
  const stream = await env.getDisplayMedia({
    video: { frameRate: { ideal: FRAME_RATE, max: FRAME_RATE } },
    audio: false,
  });
  const close = () => {
    for (const track of stream.getTracks()) track.stop();
  };
  let video: Video;
  try {
    video = await env.play(stream);
  } catch (error) {
    close();
    throw error;
  }
  let context: FrameContext<Video> | null = null;
  let contextSize = "";
  return {
    size: () =>
      video.videoWidth > 0 && video.videoHeight > 0
        ? { width: video.videoWidth, height: video.videoHeight }
        : null,
    read: (area) => {
      const width = Math.max(1, Math.round(area.width * area.scale));
      const height = Math.max(1, Math.round(area.height * area.scale));
      if (context === null || contextSize !== `${width}x${height}`) {
        context = env.createContext(width, height);
        contextSize = `${width}x${height}`;
      }
      // Nearest neighbor scaling reads whole pixels of the frame, so a sample never mixes a cell with its border
      context.imageSmoothingEnabled = false;
      context.drawImage(
        video,
        0,
        0,
        area.width,
        area.height,
        0,
        0,
        width,
        height,
      );
      return context.getImageData(0, 0, width, height);
    },
    ended: () =>
      stream.getVideoTracks().every((track) => track.readyState === "ended"),
    close,
  };
}
