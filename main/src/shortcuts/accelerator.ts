import { KeyToElectron } from "../../../ipc/KeyToCode";

/** Returns the Electron accelerator for a hotkey such as `Ctrl + ArrowUp`. */
export function shortcutToElectron(shortcut: string) {
  return shortcut
    .split(" + ")
    .map((k) => KeyToElectron[k as keyof typeof KeyToElectron])
    .join("+");
}
