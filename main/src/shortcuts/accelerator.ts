import { KeyToElectron } from "../../../ipc/KeyToCode";
import type { ShortcutAction } from "../../../ipc/types";
import type { Logger } from "../RemoteLogger";

const KEY_NAMES = new Set(Object.keys(KeyToElectron));

/** Returns the Electron accelerator for a hotkey such as `Ctrl + ArrowUp`. */
export function shortcutToElectron(shortcut: string) {
  return shortcut
    .split(" + ")
    .map((k) => KeyToElectron[k as keyof typeof KeyToElectron])
    .join("+");
}

/** Leaves out, with a log line, each action whose hotkey has a key name that `KeyToElectron` lacks. */
export function withKnownKeys(actions: ShortcutAction[], logger: Logger) {
  return actions.filter((action) => {
    const keys = action.shortcut.split(" + ");
    if (keys.every((key) => KEY_NAMES.has(key))) return true;

    logger.write(
      `error [Shortcuts] Hotkey "${action.shortcut}" has an unknown key name and will not be registered.`,
    );
    return false;
  });
}
