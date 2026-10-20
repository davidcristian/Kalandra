import { KeyToElectron } from "../../ipc/KeyToCode";

const ELECTRON_NAMES = new Set<string>(Object.values(KeyToElectron));

/** Stands in for Electron's globalShortcut: keeps the registered accelerators and throws on a key name it does not know. */
export class FakeGlobalShortcut {
  readonly registered = new Map<string, () => void>();

  register(accelerator: string, callback: () => void) {
    if (!accelerator.split("+").every((name) => ELECTRON_NAMES.has(name))) {
      throw new TypeError(`Cannot parse the accelerator ${accelerator}`);
    }
    this.registered.set(accelerator, callback);
    return true;
  }

  unregister(accelerator: string) {
    this.registered.delete(accelerator);
  }

  unregisterAll() {
    this.registered.clear();
  }
}

export const globalShortcut = new FakeGlobalShortcut();
