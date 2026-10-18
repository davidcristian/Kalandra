import * as path from "path";
import { describe, expect, it } from "vitest";
import { resolveInside } from "../src/served-file";

const root = path.resolve("served-root");

describe("resolveInside", () => {
  it("returns a path inside the folder", () => {
    expect(resolveInside(root, "/assets/app.js")).toBe(
      path.join(root, "assets", "app.js"),
    );
    expect(resolveInside(root, "a/../b.txt")).toBe(path.join(root, "b.txt"));
    expect(resolveInside(root, "/..b.txt")).toBe(path.join(root, "..b.txt"));
  });

  it("rejects a path that leaves the folder", () => {
    for (const urlPath of ["/../x", "../x", "a/../../x", "/a/b/../../../x"]) {
      expect(resolveInside(root, urlPath)).toBeUndefined();
    }
  });

  it("rejects the folder itself and a null byte", () => {
    expect(resolveInside(root, "/")).toBeUndefined();
    expect(resolveInside(root, "/a\0.txt")).toBeUndefined();
  });

  it.runIf(process.platform === "win32")(
    "rejects backslash segments on Windows",
    () => {
      expect(resolveInside(root, "..\\x")).toBeUndefined();
      expect(resolveInside(root, "/a\\..\\..\\x")).toBeUndefined();
    },
  );
});
