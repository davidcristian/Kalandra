import { computed } from "vue";
import type { HotkeyFailure } from "@ipc/hotkeys";
import type { Config } from "@/web/Config";
import { Host } from "@/web/background/IPC";
import { shortcutActions } from "@/web/shortcut-actions";
import { settingsDraft } from "./draft";

const UNREGISTERED_HINTS: Record<HotkeyFailure, string> = {
  "unknown-key": "settings.hotkey_unknown_key",
  "game-key": "settings.hotkey_game_key",
  "taken": "settings.hotkey_taken",
};

/** Returns each hotkey that more than one action of the config uses. */
export function duplicateHotkeys(config: Config): Set<string> {
  const used = new Set<string>();
  const duplicates = new Set<string>();
  for (const { shortcut } of shortcutActions(config)) {
    if (used.has(shortcut)) duplicates.add(shortcut);
    used.add(shortcut);
  }
  return duplicates;
}

const draftDuplicates = computed(() => {
  const draft = settingsDraft.copy.value;
  return draft ? duplicateHotkeys(draft) : new Set<string>();
});

/**
 * Returns whether another action in the config the Settings window edits has the hotkey of a field.
 * `shortcut` is the hotkey main registers for the field when it is more than the field's value.
 */
export function isDuplicateInDraft(
  value: string | null,
  shortcut: string | null = value,
): boolean {
  if (value === null || shortcut === null) return false;
  return draftDuplicates.value.has(shortcut);
}

/**
 * Returns the UI text key of the hint for a hotkey field that main cannot register, or undefined for a usable field.
 * Takes `shortcut` as `isDuplicateInDraft()` does.
 */
export function hotkeyHint(
  value: string | null,
  shortcut: string | null = value,
): string | undefined {
  if (value === null || shortcut === null) return undefined;
  if (isDuplicateInDraft(value, shortcut)) return "settings.hotkey_duplicate";
  const unregistered = Host.unregisteredHotkeys.value.find(
    (hotkey) => hotkey.shortcut === shortcut,
  );
  return unregistered && UNREGISTERED_HINTS[unregistered.reason];
}
