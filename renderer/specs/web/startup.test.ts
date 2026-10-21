import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataLoadError } from "@/assets/data/fetch-data";
import { startApp } from "@/web/startup";

describe("startApp", () => {
  let shown: string[];
  let logged: unknown[][];
  const show = (message: string) => {
    shown.push(message);
  };

  beforeEach(() => {
    shown = [];
    logged = [];
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      logged.push(args);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("runs the steps and shows nothing when they end", async () => {
    let started = false;

    await startApp(async () => {
      started = true;
    }, show);

    expect(started).toBe(true);
    expect(shown).toEqual([]);
    expect(logged).toEqual([]);
  });

  it("logs the error of a step that fails and shows it with what to do", async () => {
    const error = new DataLoadError("en/items.ndjson", 404);

    await startApp(async () => {
      throw error;
    }, show);

    expect(logged).toHaveLength(1);
    expect(logged[0]).toContain(error);
    expect(shown).toHaveLength(1);
    expect(shown[0]).toContain(
      "Kalandra cannot start: Cannot load data/en/items.ndjson (status 404)",
    );
    expect(shown[0]).toContain("install the latest version over this one");
  });

  it("shows a failure that is not an Error as text", async () => {
    // eslint-disable-next-line prefer-promise-reject-errors -- the test checks a reason that is not an Error
    await startApp(() => Promise.reject("no socket"), show);

    expect(shown[0]).toContain("Kalandra cannot start: no socket");
  });
});
