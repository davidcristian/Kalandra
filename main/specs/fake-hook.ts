import { EventEmitter } from "node:events";

// The keycodes of uiohook-napi's UiohookKey
export const Key = {
  Alt: 56,
  ArrowLeft: 57419,
  ArrowRight: 57421,
  C: 46,
  Ctrl: 29,
  D: 32,
  F5: 63,
  Shift: 42,
  Space: 57,
} as const;

const KEY_NAMES = new Map<number, string>(
  Object.entries(Key).map(([name, code]) => [code, name]),
);

interface Modifiers {
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
}

/** Stands in for the uiohook-napi global hook: a test sends the events the hook reports, and reads the keys main pressed. */
export class FakeHook extends EventEmitter {
  /** Each key main pressed through the hook, in order, such as `Ctrl up` or `ArrowLeft tap`. */
  readonly pressed: string[] = [];

  press(keycode: number, modifiers: Modifiers = {}) {
    this.emit("keydown", { ...keyEvent(keycode), ...modifiers });
  }

  release(keycode: number, modifiers: Modifiers = {}) {
    this.emit("keyup", { ...keyEvent(keycode), ...modifiers });
  }

  wheel(x: number, y: number, rotation: number, modifiers: Modifiers = {}) {
    this.emit("wheel", { ...mouseEvent(x, y, modifiers), rotation });
  }

  move(x: number, y: number, modifiers: Modifiers = {}) {
    this.emit("mousemove", mouseEvent(x, y, modifiers));
  }

  down(x: number, y: number) {
    this.emit("mousedown", mouseEvent(x, y, {}));
  }

  keyToggle(keycode: number | undefined, direction: "down" | "up") {
    this.pressed.push(`${keyName(keycode)} ${direction}`);
  }

  keyTap(keycode: number | undefined) {
    this.pressed.push(`${keyName(keycode)} tap`);
  }

  reset() {
    this.removeAllListeners();
    this.pressed.length = 0;
  }
}

function keyName(keycode: number | undefined) {
  return (keycode !== undefined && KEY_NAMES.get(keycode)) || String(keycode);
}

function keyEvent(keycode: number) {
  return { keycode, ctrlKey: false, altKey: false, shiftKey: false };
}

function mouseEvent(x: number, y: number, modifiers: Modifiers) {
  return { x, y, ctrlKey: false, altKey: false, shiftKey: false, ...modifiers };
}

export const hook = new FakeHook();
