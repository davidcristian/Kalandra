import { describe, expect, it } from "vitest";
import type { PixelImage } from "@/web/stash-prices/cell-classifier";
import {
  type CaptureEnvironment,
  FRAME_RATE,
  type FrameContext,
  openGameCapture,
} from "@/web/stash-prices/frame-source";

class FakeTrack {
  readyState = "live";
  stop() {
    this.readyState = "ended";
  }
}

class FakeStream {
  readonly video = [new FakeTrack()];
  readonly audio = [new FakeTrack()];
  getVideoTracks = () => this.video;
  getTracks = () => [...this.video, ...this.audio];
}

class FakeVideo {
  videoWidth = 0;
  videoHeight = 0;
  constructor(readonly stream: FakeStream) {}
}

interface Draw {
  smoothing: boolean;
  args: number[];
}

/** A canvas context that keeps each draw and returns an image of its size. */
class FakeContext implements FrameContext<FakeVideo> {
  imageSmoothingEnabled = true;
  readonly draws: Draw[] = [];
  constructor(
    readonly width: number,
    readonly height: number,
  ) {}

  drawImage(_video: FakeVideo, ...args: number[]) {
    this.draws.push({ smoothing: this.imageSmoothingEnabled, args });
  }

  getImageData(x: number, y: number, w: number, h: number): PixelImage {
    return {
      width: w - x,
      height: h - y,
      data: new Uint8ClampedArray(w * h * 4),
    };
  }
}

function fakeEnvironment(playFailure: Error | null = null) {
  const requests: DisplayMediaStreamOptions[] = [];
  const streams: FakeStream[] = [];
  const contexts: FakeContext[] = [];
  const videos: FakeVideo[] = [];
  const env: CaptureEnvironment<FakeVideo, FakeStream> = {
    getDisplayMedia: async (options) => {
      requests.push(options);
      const stream = new FakeStream();
      streams.push(stream);
      return stream;
    },
    play: async (stream) => {
      if (playFailure) throw playFailure;
      const video = new FakeVideo(stream);
      videos.push(video);
      return video;
    },
    createContext: (width, height) => {
      const context = new FakeContext(width, height);
      contexts.push(context);
      return context;
    },
  };
  return { env, requests, streams, contexts, videos };
}

describe("openGameCapture", () => {
  it("asks for video alone at 2 frames per second", async () => {
    const { env, requests } = fakeEnvironment();

    await openGameCapture(env);

    expect(FRAME_RATE).toBe(2);
    expect(requests).toEqual([
      { video: { frameRate: { ideal: 2, max: 2 } }, audio: false },
    ]);
  });

  it("has no size before the first frame, and the video's size after it", async () => {
    const { env, videos } = fakeEnvironment();
    const capture = await openGameCapture(env);

    expect(capture.size()).toBeNull();
    videos[0].videoWidth = 1920;
    expect(capture.size()).toBeNull();
    videos[0].videoHeight = 1080;
    expect(capture.size()).toEqual({ width: 1920, height: 1080 });
  });

  it("draws the top left area at its scale without smoothing, on one canvas per size", async () => {
    const { env, contexts } = fakeEnvironment();
    const capture = await openGameCapture(env);

    const image = capture.read({ width: 700, height: 800, scale: 0.5 });
    capture.read({ width: 700, height: 800, scale: 0.5 });
    capture.read({ width: 640, height: 640, scale: 1 });

    expect(image).toMatchObject({ width: 350, height: 400 });
    expect(contexts.map((c) => [c.width, c.height])).toEqual([
      [350, 400],
      [640, 640],
    ]);
    expect(contexts[0].draws).toEqual([
      { smoothing: false, args: [0, 0, 700, 800, 0, 0, 350, 400] },
      { smoothing: false, args: [0, 0, 700, 800, 0, 0, 350, 400] },
    ]);
  });

  it("ends when the video track ends, and stops the audio track on close", async () => {
    const { env, streams } = fakeEnvironment();
    const capture = await openGameCapture(env);

    expect(capture.ended()).toBe(false);
    streams[0].video[0].readyState = "ended";
    expect(capture.ended()).toBe(true);
    capture.close();
    expect(streams[0].audio[0].readyState).toBe("ended");
  });

  it("stops the stream and rejects when the video does not play", async () => {
    const { env, streams } = fakeEnvironment(new Error("play() failed"));

    await expect(openGameCapture(env)).rejects.toThrow("play() failed");
    expect(streams[0].getTracks().map((t) => t.readyState)).toEqual([
      "ended",
      "ended",
    ]);
  });
});
