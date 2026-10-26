import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type * as IPC from "@/web/background/IPC";
import { useImageImport } from "@/web/overlay/image-import";

let Host: typeof IPC.Host;

// Vue reads document on import when window exists, so the stub comes after the import
beforeAll(async () => {
  ({ Host } = await vi.importActual<typeof IPC>("@/web/background/IPC"));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function addTo(config: { images: Array<{ id: number; url: string }> }) {
  return useImageImport(config, (file) => Host.importFile(file));
}

const strip = () => ({ images: [{ id: 1, url: "9b1c.png" }] });

describe("useImageImport", () => {
  it("adds the name main stores the file under, with the next id", async () => {
    vi.stubGlobal(
      "fetch",
      async () => new Response(JSON.stringify({ name: "0f3a.png" })),
    );
    const config = strip();
    const { failed, addImage } = addTo(config);

    await addImage(new File(["image"], "map.png"));

    expect(config.images).toEqual([
      { id: 1, url: "9b1c.png" },
      { id: 2, url: "0f3a.png" },
    ]);
    expect(failed.value).toBe(false);
  });

  it.each([
    [
      "main answers 415 for a file that is not an image",
      async () => new Response(null, { status: 415 }),
    ],
    // main ends the request of a file over 16 MB, which fails the fetch
    [
      "main ends the request",
      async () => Promise.reject(new TypeError("Failed to fetch")),
    ],
  ])("shows the failure and adds nothing when %s", async (_, fetch) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", fetch);
    const config = strip();
    const { failed, addImage } = addTo(config);

    await addImage(new File(["data"], "big.png"));

    expect(config.images).toEqual(strip().images);
    expect(failed.value).toBe(true);
  });

  it("hides the failure when the next file is added", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", async () => new Response(null, { status: 500 }));
    const config = strip();
    const { failed, addImage } = addTo(config);
    await addImage(new File(["data"], "map.png"));

    vi.stubGlobal(
      "fetch",
      async () => new Response(JSON.stringify({ name: "0f3a.png" })),
    );
    await addImage(new File(["data"], "map.png"));

    expect(failed.value).toBe(false);
    expect(config.images).toHaveLength(2);
  });
});
