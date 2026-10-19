import { beforeEach, describe, expect, it, vi } from "vitest";
import { Logger } from "../src/RemoteLogger";
import { logKeyPresses } from "../src/shortcuts/key-log";
import { hook, Key } from "./fake-hook";
import { FakeServer } from "./fake-server";

vi.mock("uiohook-napi", async () => {
  const { hook, Key } = await import("./fake-hook");
  return { uIOhook: hook, UiohookKey: Key };
});

function startLog(isOn: () => boolean, game = { isActive: true }) {
  const logger = new Logger(new FakeServer());
  logKeyPresses(logger, game, isOn);
  return logger;
}

function loggedLines(logger: Logger) {
  return logger.history
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => line.replace(/^\[[^\]]*\] /, ""));
}

beforeEach(() => {
  hook.removeAllListeners();
});

describe("logKeyPresses", () => {
  it("logs each key press with its modifiers and each release", () => {
    const logger = startLog(() => true);
    hook.press(Key.Ctrl, { ctrlKey: true });
    hook.press(Key.D, { ctrlKey: true });
    hook.release(Key.D);
    hook.release(Key.Ctrl);

    expect(loggedLines(logger)).toEqual([
      "debug [Shortcuts] Keydown Ctrl",
      "debug [Shortcuts] Keydown Ctrl + D",
      "debug [Shortcuts] Keyup D",
      "debug [Shortcuts] Keyup Ctrl",
    ]);
  });

  it.each([
    [{ ctrlKey: true, shiftKey: true, altKey: true }, "Ctrl + Shift + Alt + D"],
    [{ shiftKey: true, altKey: true }, "Shift + Alt + D"],
    [{ ctrlKey: true, shiftKey: true }, "Ctrl + Shift + D"],
    [{ ctrlKey: true, altKey: true }, "Ctrl + Alt + D"],
    [{ altKey: true }, "Alt + D"],
    [{ shiftKey: true }, "Shift + D"],
    [{}, "D"],
  ])("names the press %o as the hotkey %s", (modifiers, name) => {
    const logger = startLog(() => true);
    hook.press(Key.D, modifiers);
    expect(loggedLines(logger)).toEqual([`debug [Shortcuts] Keydown ${name}`]);
  });

  it("names a modifier key alone without the modifier flags", () => {
    const logger = startLog(() => true);
    hook.press(Key.Shift, { shiftKey: true, ctrlKey: true });
    hook.press(Key.Alt, { altKey: true });
    expect(loggedLines(logger)).toEqual([
      "debug [Shortcuts] Keydown Shift",
      "debug [Shortcuts] Keydown Alt",
    ]);
  });

  it("names a key the hook has no name for not_supported_key", () => {
    const logger = startLog(() => true);
    hook.press(0);
    hook.release(0);
    expect(loggedLines(logger)).toEqual([
      "debug [Shortcuts] Keydown not_supported_key",
      "debug [Shortcuts] Keyup not_supported_key",
    ]);
  });

  it("logs nothing while key logging is off", () => {
    let isOn = false;
    const logger = startLog(() => isOn);
    hook.press(Key.D);
    hook.release(Key.D);
    expect(loggedLines(logger)).toEqual([]);

    isOn = true;
    hook.press(Key.D);
    expect(loggedLines(logger)).toEqual(["debug [Shortcuts] Keydown D"]);
  });

  it("logs no key typed while another program is active", () => {
    const game = { isActive: false };
    const logger = startLog(() => true, game);
    hook.press(Key.D);
    hook.release(Key.D);
    expect(loggedLines(logger)).toEqual([]);

    game.isActive = true;
    hook.press(Key.D);
    hook.release(Key.D);
    expect(loggedLines(logger)).toEqual([
      "debug [Shortcuts] Keydown D",
      "debug [Shortcuts] Keyup D",
    ]);
  });
});
