import type { PixelImage } from "@/web/stash-prices/cell-classifier";
import type { FrameSource } from "@/web/stash-prices/frame-source";
import type { StashListing } from "@/web/stash-prices/stash-listings";
import type { Size } from "@/web/stash-prices/stash-grid";
import type { SyntheticItem } from "./synthetic-stash";

/** Returns the top left part of an image scaled as a canvas without smoothing scales it: each pixel from the nearest one. */
export function drawScaled(
  image: PixelImage,
  area: Size & { scale: number },
): PixelImage {
  const width = Math.max(1, Math.round(area.width * area.scale));
  const height = Math.max(1, Math.round(area.height * area.scale));
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const from = Math.min(
      image.height - 1,
      Math.floor(((y + 0.5) * area.height) / height),
    );
    for (let x = 0; x < width; x++) {
      const across = Math.min(
        image.width - 1,
        Math.floor(((x + 0.5) * area.width) / width),
      );
      const source = (from * image.width + across) * 4;
      for (let channel = 0; channel < 4; channel++) {
        data[(y * width + x) * 4 + channel] = image.data[source + channel];
      }
    }
  }
  return { width, height, data };
}

/** Stands in for the game window's capture: shows `frame`, fails with `failure`, and counts what was opened and closed. */
export class FakeScreen {
  frame: PixelImage | null = null;
  ended = false;
  failure: Error | null = null;
  readFailure: unknown = null;
  opened = 0;
  closed = 0;
  /** While set, a request for the capture waits until `answer()`. */
  holdRequests = false;
  private waiting: Array<() => void> = [];

  openCapture = async (): Promise<FrameSource> => {
    this.opened += 1;
    if (this.holdRequests) {
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }
    if (this.failure) throw this.failure;
    let open = true;
    return {
      size: () =>
        this.frame
          ? { width: this.frame.width, height: this.frame.height }
          : null,
      read: (area) => {
        if (this.readFailure) throw this.readFailure;
        if (!this.frame) throw new Error("read before the first frame");
        return drawScaled(this.frame, area);
      },
      ended: () => this.ended,
      close: () => {
        if (open) this.closed += 1;
        open = false;
      },
    };
  };

  /** Lets the held requests go on. */
  answer(): void {
    for (const resolve of this.waiting.splice(0)) resolve();
  }
}

/** A listing of the tab at a place, with only the fields a listing needs. */
export function placed(item: SyntheticItem): StashListing {
  const id = `item-${item.x}-${item.y}`;
  const stash = { name: "kalandra-price-check", x: item.x, y: item.y };
  return {
    id,
    itemId: id,
    name: "",
    typeLine: "Sapphire Ring",
    baseType: "Sapphire Ring",
    rarity: "Rare",
    stashName: stash.name,
    ...item,
    indexed: "2026-10-28T02:00:00Z",
    raw: {
      id,
      item: { id, w: item.w, h: item.h },
      listing: { indexed: "2026-10-28T02:00:00Z", stash },
    },
  };
}
