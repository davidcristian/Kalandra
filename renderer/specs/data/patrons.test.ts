import { beforeAll, describe, expect, it } from "vitest";
import { setupTests } from "@specs/vitest.setup";
import { APP_PATRONS, init } from "@/assets/data";

// The Settings window shows one tier per style, with the classes rating-1 to rating-5
const STYLES = [1, 2, 3, 4, 5];

describe("patrons.json", () => {
  beforeAll(async () => {
    setupTests();
    await init("en");
  });

  it("lists patrons", () => {
    expect(APP_PATRONS.length).toBeGreaterThan(0);
  });

  it("gives each patron a name, a whole number of months and a style the Settings window shows", () => {
    const invalid = APP_PATRONS.filter(
      (row) =>
        typeof row.from !== "string" ||
        row.from.trim() === "" ||
        !Number.isInteger(row.months) ||
        row.months < 1 ||
        !STYLES.includes(row.style),
    );

    expect(invalid).toEqual([]);
  });

  it("names each patron once, since the name is the key of its row", () => {
    const names = APP_PATRONS.map((row) => row.from);

    expect(names.filter((name, i) => names.indexOf(name) !== i)).toEqual([]);
  });
});
