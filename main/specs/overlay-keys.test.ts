import { describe, expect, it } from "vitest";
import {
  overlayKeyCommand,
  pressedHotkey,
} from "../src/windowing/overlay-keys";

interface Modifiers {
  control?: boolean;
  shift?: boolean;
  alt?: boolean;
}

function press(code: string, modifiers: Modifiers = {}, type = "keyDown") {
  return {
    type,
    code,
    control: modifiers.control ?? false,
    shift: modifiers.shift ?? false,
    alt: modifiers.alt ?? false,
  };
}

const everyModifierCombination: [Modifiers, string][] = [
  [{ control: true, shift: true, alt: true }, "Ctrl + Shift + Alt + X"],
  [{ shift: true, alt: true }, "Shift + Alt + X"],
  [{ control: true, shift: true }, "Ctrl + Shift + X"],
  [{ control: true, alt: true }, "Ctrl + Alt + X"],
  [{ alt: true }, "Alt + X"],
  [{ control: true }, "Ctrl + X"],
  [{ shift: true }, "Shift + X"],
  [{}, "X"],
];

describe("pressedHotkey", () => {
  it.each(everyModifierCombination)(
    "names the press %o as the hotkey %s",
    (modifiers, name) => {
      expect(pressedHotkey(press("KeyX", modifiers))).toBe(name);
    },
  );

  it("names digit keys without their prefix and other keys by their code", () => {
    expect(pressedHotkey(press("Digit5", { shift: true }))).toBe("Shift + 5");
    expect(pressedHotkey(press("Numpad1"))).toBe("Numpad1");
    expect(pressedHotkey(press("F5", { control: true }))).toBe("Ctrl + F5");
    expect(pressedHotkey(press("Space", { shift: true }))).toBe(
      "Shift + Space",
    );
  });
});

describe("overlayKeyCommand", () => {
  it.each(everyModifierCombination)(
    "toggles the overlay on the press %o when the overlay key is %s",
    (modifiers, overlayKey) => {
      expect(overlayKeyCommand(press("KeyX", modifiers), overlayKey)).toBe(
        "toggle-overlay",
      );
    },
  );

  it("does nothing on a press with more modifiers than the overlay key", () => {
    const allThree = press("KeyX", { control: true, shift: true, alt: true });
    expect(overlayKeyCommand(allThree, "Shift + Alt + X")).toBeUndefined();
    expect(overlayKeyCommand(allThree, "Ctrl + Shift + X")).toBeUndefined();
    expect(overlayKeyCommand(allThree, "Ctrl + Alt + X")).toBeUndefined();
  });

  it("gives the game focus on Escape and Ctrl + W", () => {
    expect(overlayKeyCommand(press("Escape"), "Shift + Space")).toBe(
      "focus-game",
    );
    expect(
      overlayKeyCommand(press("KeyW", { control: true }), "Shift + Space"),
    ).toBe("focus-game");
    expect(overlayKeyCommand(press("KeyW"), "Shift + Space")).toBeUndefined();
  });

  it("does nothing on a key release or on another key", () => {
    expect(
      overlayKeyCommand(
        press("Space", { shift: true }, "keyUp"),
        "Shift + Space",
      ),
    ).toBeUndefined();
    expect(
      overlayKeyCommand(press("Escape", {}, "keyUp"), "Shift + Space"),
    ).toBeUndefined();
    expect(overlayKeyCommand(press("Space"), "Shift + Space")).toBeUndefined();
  });
});
