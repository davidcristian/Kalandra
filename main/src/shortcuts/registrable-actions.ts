import { mergeTwoHotkeys } from "../../../ipc/KeyToCode";
import type { ShortcutAction } from "../../../ipc/types";
import type { Logger } from "../RemoteLogger";
import { withKnownKeys } from "./accelerator";

/**
 * Returns the actions main registers. Leaves out, with a log line, a hotkey with an unknown key name, a hotkey the
 * game uses and a hotkey that two actions share, except for the `toggle-overlay` action.
 */
export function registrableActions(
  actions: ShortcutAction[],
  showModsKey: string,
  logger: Logger,
): ShortcutAction[] {
  const copyItemShortcut = mergeTwoHotkeys("Ctrl + C", showModsKey);
  if (copyItemShortcut !== "Ctrl + C") {
    actions.push({
      shortcut: copyItemShortcut,
      action: { type: "test-only" },
    });
  }
  actions = withKnownKeys(actions, logger);
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
    if (
      allShortcuts.has(action.shortcut) &&
      action.action.type !== "test-only"
    ) {
      logger.write(
        `error [Shortcuts] Hotkey "${action.shortcut}" reserved by the game will not be registered.`,
      );
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
  return actions.filter(
    (action) =>
      !duplicates.has(action.shortcut) ||
      action.action.type === "toggle-overlay",
  );
}
