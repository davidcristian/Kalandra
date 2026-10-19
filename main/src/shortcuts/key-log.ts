import { uIOhook, UiohookKey } from "uiohook-napi";
import type { Logger } from "../RemoteLogger";

const UiohookToName = Object.fromEntries(
  Object.entries(UiohookKey).map(([k, v]) => [v, k]),
);

/** Writes each key press and release to the log while `isOn()` returns true. */
export function logKeyPresses(logger: Logger, isOn: () => boolean) {
  uIOhook.on("keydown", (e) => {
    if (!isOn()) return;
    const pressed = eventToString(e);
    logger.write(`debug [Shortcuts] Keydown ${pressed}`);
  });
  uIOhook.on("keyup", (e) => {
    if (!isOn()) return;
    logger.write(
      `debug [Shortcuts] Keyup ${
        UiohookToName[e.keycode] || "not_supported_key"
      }`,
    );
  });
}

function eventToString(e: {
  keycode: number;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}) {
  const { ctrlKey, shiftKey, altKey } = e;

  let code = UiohookToName[e.keycode];
  if (!code) return "not_supported_key";

  if (code === "Shift" || code === "Alt" || code === "Ctrl") return code;

  if (ctrlKey && shiftKey && altKey) code = `Ctrl + Shift + Alt + ${code}`;
  else if (shiftKey && altKey) code = `Shift + Alt + ${code}`;
  else if (ctrlKey && shiftKey) code = `Ctrl + Shift + ${code}`;
  else if (ctrlKey && altKey) code = `Ctrl + Alt + ${code}`;
  else if (altKey) code = `Alt + ${code}`;
  else if (ctrlKey) code = `Ctrl + ${code}`;
  else if (shiftKey) code = `Shift + ${code}`;

  return code;
}
