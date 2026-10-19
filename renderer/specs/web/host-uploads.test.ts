import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type * as IPC from "@/web/background/IPC";

// Answers with the path main's /uploads route reads, as the browser sends it
async function pathFetch(input: RequestInfo | URL) {
  const { pathname } = new URL(String(input), "http://localhost");
  return new Response(JSON.stringify({ name: pathname }));
}

let Host: typeof IPC.Host;

// Vue reads document on import when window exists, so the stub comes after the import
beforeAll(async () => {
  ({ Host } = await vi.importActual<typeof IPC>("@/web/background/IPC"));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Host.importFile", () => {
  it("sends a file name with # and spaces whole, so main reads its extension", async () => {
    vi.stubGlobal("fetch", pathFetch);
    const name = await Host.importFile(new File(["image"], "map #2.png"));

    expect(decodeURIComponent(name)).toBe("/uploads/map #2.png");
  });

  it("rejects with the status when main does not store the file", async () => {
    vi.stubGlobal("fetch", async () => new Response(null, { status: 415 }));

    await expect(
      Host.importFile(new File(["text"], "notes.html")),
    ).rejects.toThrow("Storing notes.html failed (415)");
  });
});
