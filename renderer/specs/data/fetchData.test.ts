import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setupTests } from "@specs/vitest.setup";
import { init } from "@/assets/data";
import { DataLoadError, fetchData } from "@/assets/data/fetch-data";

beforeEach(() => {
  setupTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchData", () => {
  it("returns a file of the data folder", async () => {
    const response = await fetchData("en/app_i18n.json");
    const messages = (await response.json()) as Record<string, unknown>;

    expect(messages).toHaveProperty("league");
  });

  it("fails with the file and the status when the server does not return it", async () => {
    const loading = fetchData("en/missing.json");

    await expect(loading).rejects.toBeInstanceOf(DataLoadError);
    await expect(loading).rejects.toThrow(
      "Cannot load data/en/missing.json (status 404)",
    );
  });
});

describe("init", () => {
  it("fails with the file's name when the server does not return an index file", async () => {
    const serveDataFolder = global.fetch;
    vi.stubGlobal("fetch", async (url: string, request?: RequestInit) =>
      url.endsWith("/items-ref.index.bin")
        ? new Response(null, { status: 404 })
        : await serveDataFolder(url, request),
    );

    await expect(init("en")).rejects.toThrow(
      "Cannot load data/en/items-ref.index.bin (status 404)",
    );
  });
});
