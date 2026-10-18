# Augments saved for martial weapons are never applied

**Status:** open
**Area:** renderer
**Origin:** [renderer/src/web/price-check/item-editor/AugmentEditor.vue](../../../../renderer/src/web/price-check/item-editor/AugmentEditor.vue)
**Verified:** 2026-10-18

The augment editor in the price check window saves a set of augments per item group in
`savedAugments`, a map in the price check widget config (`PriceCheckWidget` in
`renderer/src/web/overlay/widgets.ts`). For the martial weapon group, `getSaveType()` in
`AugmentEditor.vue` returns `"maritalWeapon"` (`AugmentSaveType.MaritalWeapon` in
`item-editor.ts`). `getSavedAugments()` in `renderer/src/parser/augment-builder.ts` reads
`lookup.martialWeapon`, so a set saved for that group is never used. The option label,
`item_editor.marital_weapon` in the English `app_i18n.json`, reads `Marital Weapons`.
[docs/price-check.md](../../../price-check.md) states the current behavior.

Two smaller points in the same files: `AugmentSaveType.Sceptre` is `"spectre"` and nothing uses it,
and `item_editor.sceptre` (`Sceptres`) exists while the editor offers no Sceptre group.

Done looks like: one save key, `martialWeapon`, in the editor and the reader; an upgrade step that
moves a saved `maritalWeapon` entry to `martialWeapon`, since `savedAugments` is part of the saved
config ([AGENTS.md](../../../../AGENTS.md#the-one-hard-rule)); the label `Martial Weapons`; a test
that a saved set is applied to a martial weapon; and the page updated in the same commit. The
unused `Sceptre` member and `item_editor.sceptre` key are removed, or given a Sceptre group, in a
commit of their own.

## History

- 2026-10-18: Found while docs/price-check.md was rewritten, by comparing the save key in
  `AugmentEditor.vue` with the key `getSavedAugments()` reads.
