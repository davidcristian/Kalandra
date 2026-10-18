# The game copies item text with the advanced item descriptions key

**Status:** never attempted
**Needs:** Path of Exile 2 on Windows
**Origin:** [docs/nothing-happens.md](../../../nothing-happens.md)
**Verified:** 2026-10-18

**Claims.** Every key that reads an item makes main press Ctrl, the game's advanced item
descriptions key and C (`pressKeysToCopyItemText` in `main/src/shortcuts/Shortcuts.ts`). The pages
[quick-start.md](../../../quick-start.md), [price-check.md](../../../price-check.md),
[nothing-happens.md](../../../nothing-happens.md), [no-item-mods.md](../../../no-item-mods.md),
[settings.md](../../../settings.md) and [download.md](../../../download.md), and the developer docs
[architecture.md](../../architecture.md), [modules/ipc.md](../../modules/ipc.md) and
[ADR-0007](../../adr/ADR-0007-game-text-from-game-data.md), say:

- With the advanced descriptions key held, the game copies the item text with a `{ ... }` line
  above each modifier that names its type, tier and tags.
- The key is bound under **Show Advanced Item Descriptions** in the game's key bindings, `Alt` by
  default, so the copy keys are Ctrl + Alt + C.
- The game writes the binding as `show_advanced_item_descriptions` under `[ACTION_KEYS]` in
  `Documents\My Games\Path of Exile 2\poe2_production_Config.ini`, and writes that file at its
  first start. Main reads the value as a key code, then an optional modifier code: 1 for Shift,
  2 for Ctrl, 3 for Alt (`parseConfigHotkey` in `main/src/host-files/GameConfig.ts`).
- A mouse button has no code in `CodeToKey` (`ipc/KeyToCode.ts`). With the key bound to one, main
  logs `error [GameConfig] Failed to read key: <value>.` and presses Alt, so the game copies the
  item without the brace lines.
- With default settings, Ctrl + D logs this order with Record all key presses on: Keydown Ctrl,
  Keydown Ctrl + D, Action type: copy-item, Keyup D, Keydown Alt, Keydown Ctrl + Alt + C, Keyup C,
  Keyup Alt, then the user's own key releases.

**Do.** [Section 3 of the runbook](../../runbooks/in-game-check.md#3-clipboard-capture-with-the-advanced-descriptions-key).
Then read the binding's label in the game's options, open `poe2_production_Config.ini` and find the
line. Bind the key to a mouse button, restart Kalandra, which reads the file only at start, and
price check. Bind the key back and restart Kalandra again. Compare the key log with the list above.

**Pass.** Each claim holds. Paste one copied item, with its brace lines, into this file's History:
it is real item text for a parser case ([AGENTS.md](../../../../AGENTS.md#what-every-change-must-pass),
rule 5).

**Record.** The label exactly as the game writes it, the line from the file, and any difference,
fixed on the page that states it in the same commit.

## History

- 2026-10-18: Filed from the copy claims that the pages and developer docs above make and the code
  can only press keys for.
