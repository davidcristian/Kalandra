import { uIOhook, UiohookKey as Key } from "uiohook-napi";
import process from "process";
import type { HostClipboard } from "./HostClipboard";
import type { OverlayWindow } from "../windowing/OverlayWindow";

const PLACEHOLDER_LAST = "@last";
const AUTO_CLEAR = [
  "#", // Global
  "%", // Party
  "@", // Whisper
  "$", // Trade
  "&", // Guild
  "/", // Command
];

export async function typeInChat(
  text: string,
  send: boolean,
  clipboard: HostClipboard,
) {
  // No restore: main cannot see when the game pastes, and a game that pastes after a restore
  // pastes the previous text, which an Enter then sends to chat
  await clipboard.throttle(async (clipboard) => {
    const modifiers = process.platform === "darwin" ? [Key.Meta] : [Key.Ctrl];

    if (text === PLACEHOLDER_LAST || text.startsWith(`${PLACEHOLDER_LAST} `)) {
      text = text.slice(`${PLACEHOLDER_LAST} `.length);
      await clipboard.writeText(text);
      uIOhook.keyTap(Key.Enter, modifiers);
    } else if (text.endsWith(PLACEHOLDER_LAST)) {
      text = text.slice(0, -PLACEHOLDER_LAST.length);
      await clipboard.writeText(text);
      uIOhook.keyTap(Key.Enter, modifiers);
      uIOhook.keyTap(Key.Home);
      // press twice to focus input when using controller
      uIOhook.keyTap(Key.Home);
      uIOhook.keyTap(Key.Delete);
    } else {
      await clipboard.writeText(text);
      uIOhook.keyTap(Key.Enter);
      if (!AUTO_CLEAR.includes(text[0])) {
        uIOhook.keyTap(Key.A, modifiers);
      }
    }

    uIOhook.keyTap(Key.V, modifiers);

    if (send) {
      uIOhook.keyTap(Key.Enter);
      // restore the last chat
      uIOhook.keyTap(Key.Enter);
      uIOhook.keyTap(Key.ArrowUp);
      uIOhook.keyTap(Key.ArrowUp);
      uIOhook.keyTap(Key.Escape);
    }
  });
}

export async function stashSearch(
  text: string,
  clipboard: HostClipboard,
  overlay: OverlayWindow,
) {
  // No restore, as for a chat command: a game that pastes after a restore pastes the previous text
  await clipboard.throttle(async (clipboard) => {
    if (!overlay.focusGameFor("a stash search")) return;
    await clipboard.writeText(text);
    uIOhook.keyTap(Key.F, [Key.Ctrl]);

    uIOhook.keyTap(Key.V, [
      process.platform === "darwin" ? Key.Meta : Key.Ctrl,
    ]);
    uIOhook.keyTap(Key.Enter);
  });
}
