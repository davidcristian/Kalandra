import { describe, expect, it } from "vitest";
import {
  CodeToKey,
  KeyToCode,
  KeyToElectron,
  hotkeyToString,
  isModKey,
  mergeTwoHotkeys,
} from "../../ipc/KeyToCode";
import { shortcutToElectron } from "../src/shortcuts/accelerator";

describe("hotkeyToString", () => {
  it("writes the modifiers in the keys first, in the order Ctrl, Shift, Alt", () => {
    expect(hotkeyToString(["Alt", "F5", "Ctrl"])).toBe("Ctrl + Alt + F5");
    expect(hotkeyToString(["Shift", "Alt", "Ctrl", "A"])).toBe(
      "Ctrl + Shift + Alt + A",
    );
  });

  it("writes modifiers alone without a separator after them", () => {
    expect(hotkeyToString(["Shift"])).toBe("Shift");
    expect(hotkeyToString([], true, false, true)).toBe("Ctrl + Alt");
  });

  it("joins keys that are not modifiers in their order", () => {
    expect(hotkeyToString(["G", "H"], false, true)).toBe("Shift + G + H");
  });
});

describe("mergeTwoHotkeys", () => {
  it.each([
    ["Ctrl + C", "Alt", "Ctrl + Alt + C"],
    ["Ctrl + C", "Ctrl", "Ctrl + C"],
    ["Ctrl + C", "C", "Ctrl + C"],
    ["Ctrl + C", "Shift + Alt", "Ctrl + Shift + Alt + C"],
  ])("merges %s and %s into %s", (first, second, merged) => {
    expect(mergeTwoHotkeys(first, second)).toBe(merged);
  });
});

describe("isModKey", () => {
  it("is true for Ctrl, Shift and Alt only", () => {
    const names = ["Ctrl", "Shift", "Alt", "A", "Space", "Meta", "ctrl"];
    expect(names.filter((name) => isModKey(name))).toEqual([
      "Ctrl",
      "Shift",
      "Alt",
    ]);
  });
});

describe("the key tables", () => {
  it("give each key a code of its own, so CodeToKey returns the key of each code", () => {
    for (const [key, code] of Object.entries(KeyToCode)) {
      expect(CodeToKey[code]).toBe(key);
    }
  });

  it("have an Electron accelerator for each key the Hotkeys settings accept", () => {
    const missing = Object.keys(KeyToCode).filter(
      (key) => !(key in KeyToElectron),
    );
    expect(missing).toEqual([]);
  });
});

describe("shortcutToElectron", () => {
  it.each([
    ["F12", "F12"],
    ["Ctrl + Shift + ArrowUp", "Ctrl+Shift+Up"],
    ["Alt + Numpad5", "Alt+num5"],
    ["Shift + NumpadMultiply", "Shift+nummult"],
    ["Ctrl + Backquote", "Ctrl+`"],
  ])("writes %s as %s", (shortcut, accelerator) => {
    expect(shortcutToElectron(shortcut)).toBe(accelerator);
  });
});
