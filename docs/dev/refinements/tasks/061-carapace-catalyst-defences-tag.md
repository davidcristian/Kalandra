# The Carapace Catalyst matches no modifier tag that Path of Exile 2 copies

**Status:** open
**Area:** data
**Origin:** [renderer/src/assets/data/index.ts](../../../../renderer/src/assets/data/index.ts)
**Verified:** 2026-10-19

`loadUltraLateItems()` maps `defences_catalyst` in `CATALYST_TO_TAG` to `ARMOUR_TAG`,
`EVASION_TAG` and `ENERGY_SHIELD_TAG`. The copied item text under `renderer/specs/Parser/` tags
defence modifiers `Defences` instead, such as the `Vaporous` prefix of `RareWithImplicit` in
`items.ts`, and no case there has a modifier tagged `Armour`, `Evasion` or `Energy Shield`. So
`applyCatalyst()` in `item-editor.ts` increases no modifier for a Carapace Catalyst, and
`parseJewelleryQuality()` in `jewellery-quality.ts` sets no `qualityType` for Carapace quality
unless its quality line names one of those three tags. `client_strings.js` has no tag string for
`Defences`, and this copy of `dataParser` writes none of the `_TAG` strings, so the fix needs
[052](052-dataparser-older-than-committed-data.md) or a data tool change.

Done looks like: a `Defences` tag string in every `client_strings.js` from the data tool,
`defences_catalyst` mapped to it, and a parser case with a copied Carapace quality line from host
task [018](../../host/tasks/018-catalyst-quality-lines.md).

## History

- 2026-10-19: Found while the parser was changed to read the quality line of rings, amulets and
  jewels.
