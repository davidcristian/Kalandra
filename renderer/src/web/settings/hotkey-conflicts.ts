import { computed } from "vue";
import type { Config } from "@/web/Config";
import { shortcutActions } from "@/web/shortcut-actions";
import { settingsDraft } from "./draft";

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
