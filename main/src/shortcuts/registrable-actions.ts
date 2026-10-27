import { mergeTwoHotkeys } from "../../../ipc/KeyToCode";
import type { ShortcutAction } from "../../../ipc/types";
import type { UnregisteredHotkey } from "../../../ipc/hotkeys";
import type { Logger } from "../RemoteLogger";
import { withKnownKeys } from "./accelerator";

export interface RegistrableActions {
  actions: ShortcutAction[];
  /** The hotkeys left out for their keys. A hotkey that two actions share is not listed. */
  unregistered: UnregisteredHotkey[];
}

/**
 * Returns the actions main registers. Leaves out, with a log line, a hotkey with an unknown key name, a hotkey the
 * game uses and a hotkey that two actions share, except for the `toggle-overlay` action.
 */
export function registrableActions(
  actions: ShortcutAction[],
  showModsKey: string,
  logger: Logger,
): RegistrableActions {
  const unregistered: UnregisteredHotkey[] = [];
  const copyItemShortcut = mergeTwoHotkeys("Ctrl + C", showModsKey);
  const known = withKnownKeys(actions, logger);
  for (const action of actions) {
    if (!known.includes(action)) {
      unregistered.push({ shortcut: action.shortcut, reason: "unknown-key" });
    }
  }
  actions = known;
  const allShortcuts = new Set([
    "Ctrl + C",
    "Ctrl + V",
    "Ctrl + A",
    "Ctrl + F",
    "Ctrl + Enter",
    "Home",
    "Delete",
    "Enter",
    "ArrowUp",
    "ArrowRight",
    "ArrowLeft",
    copyItemShortcut,
  ]);

  for (const action of actions) {
    if (allShortcuts.has(action.shortcut)) {
      logger.write(
        `error [Shortcuts] Hotkey "${action.shortcut}" reserved by the game will not be registered.`,
      );
      unregistered.push({ shortcut: action.shortcut, reason: "game-key" });
    }
  }
  actions = actions.filter((action) => !allShortcuts.has(action.shortcut));

  const duplicates = new Set<string>();
  for (const action of actions) {
    if (allShortcuts.has(action.shortcut)) {
      logger.write(
        `error [Shortcuts] It is not possible to use the same hotkey "${action.shortcut}" for multiple actions.`,
      );
      duplicates.add(action.shortcut);
    } else {
      allShortcuts.add(action.shortcut);
    }
  }
  return {
    actions: actions.filter(
      (action) =>
        !duplicates.has(action.shortcut) ||
        action.action.type === "toggle-overlay",
    ),
    unregistered,
  };
}
