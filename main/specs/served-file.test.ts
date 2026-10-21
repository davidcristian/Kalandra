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

  it("rejects backslash segments with Windows paths", () => {
    const windowsRoot = "C:\\served-root";
    expect(resolveInside(windowsRoot, "/assets/app.js", path.win32)).toBe(
      "C:\\served-root\\assets\\app.js",
    );
    expect(resolveInside(windowsRoot, "..\\x", path.win32)).toBeUndefined();
    expect(
      resolveInside(windowsRoot, "/a\\..\\..\\x", path.win32),
    ).toBeUndefined();
  });

  it("keeps a backslash in the file name with POSIX paths", () => {
    expect(resolveInside("/served-root", "..\\x", path.posix)).toBe(
      "/served-root/..\\x",
    );
  });
});
