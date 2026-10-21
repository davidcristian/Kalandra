# The item check key opens Map check or Item info, and Map check marks modifiers

**Status:** never attempted
**Needs:** Path of Exile 2 on Windows
**Origin:** [docs/map-check.md](../../../map-check.md)
**Verified:** 2026-10-21

**Claims.** Map check and Item info in Settings, Hotkeys set one key, the `hotkey` of the item check
widget, which has no default. The widget shows Map check when `isMapLike` in
`renderer/src/web/item-check/WidgetItemCheck.vue` is true, and Item info otherwise. `isMapLike` is
true for a non-unique item of the category `Map`, which holds Waystones, and for the
`Expedition Logbook`. It also lists three categories the Path of Exile 2 data does not have
([refinement 022](../../refinements/tasks/022-category-checks-for-missing-item-kinds.md)).
[docs/map-check.md](../../../map-check.md) and [docs/item-info.md](../../../item-info.md) say:

- The key opens Map check for a Waystone that is not unique and for an Expedition Logbook, and Item
  info for any other item.
- The window opens next to the game's panel on the side of the item, and it closes when you return
  to the game.
- A mark set on a modifier colors that modifier on every Waystone checked later, in the profile
  that is selected, also after a change of the game's language and Kalandra's Language setting.

**Do.** Set the key on the Hotkeys tab. Copy several Waystones with different modifiers, an
Expedition Logbook and a weapon, and press the key on each, with items at the left and at the right
of the screen. Mark a modifier in profile I and check another Waystone that has it. Switch the game
and the Language setting to German, and check that Waystone again. If the weapon's
tooltip in the game shows a DPS value, compare it with Item info's Total DPS, which does not count
chaos damage.

**Pass.** Map check opens for the Waystones and the Logbook and Item info for the weapon, each
window opens beside the game's panel on the item's side, and each mark colors its modifier in both
languages.

**Record.** Any difference goes into the page that states it, in the same commit as this file's
History line. Paste one copied Waystone, the Logbook and the weapon into the History as real item
text for parser cases.

## History

- 2026-10-18: Filed from the claims of docs/map-check.md that need real copied Waystone and Logbook
  text.
- 2026-10-18: Checked against the code. Merged in the Item info check, which was filed as its
  own task, because it presses the same key. Removed the default marks, which
  [refinement 015](../../refinements/tasks/015-default-map-marks-outdated.md) settles from the
  code and data, and the DPS formula, which is arithmetic on the copied text.
- 2026-10-21: Added the language change, since marks now name a modifier by its stat ref.
