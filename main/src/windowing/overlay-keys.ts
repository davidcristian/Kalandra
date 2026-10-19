import type { Input } from "electron";
import { hotkeyToString } from "../../../ipc/KeyToCode";

type KeyInput = Pick<Input, "type" | "code" | "control" | "shift" | "alt">;

export type OverlayKeyCommand = "focus-game" | "toggle-overlay";

/** Names a key press in the overlay window the way the Hotkeys settings write a hotkey. */
export function pressedHotkey(input: KeyInput): string {
  let { code } = input;
  if (code.startsWith("Key")) {
    code = code.slice("Key".length);
  } else if (code.startsWith("Digit")) {
    code = code.slice("Digit".length);
  }
  return hotkeyToString([code], input.control, input.shift, input.alt);
}

/** Returns what a key press does while the overlay has focus, or undefined when it does nothing. */
export function overlayKeyCommand(
  input: KeyInput,
  overlayKey: string,
): OverlayKeyCommand | undefined {
  if (input.type !== "keyDown") return undefined;

  const pressed = pressedHotkey(input);
  if (pressed === "Escape" || pressed === "Ctrl + W") return "focus-game";
  if (pressed === overlayKey) return "toggle-overlay";
  return undefined;
}
