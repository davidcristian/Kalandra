import { EventEmitter } from "node:events";

export const Key = {
  Alt: 56,
  Ctrl: 29,
  D: 32,
  Shift: 42,
} as const;

interface Modifiers {
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
}

/** Stands in for the uiohook-napi global hook: a test sends the key events the hook reports. */
export class FakeHook extends EventEmitter {
  press(keycode: number, modifiers: Modifiers = {}) {
    this.emit("keydown", { ...keyEvent(keycode), ...modifiers });
  }

  release(keycode: number) {
    this.emit("keyup", keyEvent(keycode));
  }
}

function keyEvent(keycode: number) {
  return { keycode, ctrlKey: false, altKey: false, shiftKey: false };
}

export const hook = new FakeHook();
