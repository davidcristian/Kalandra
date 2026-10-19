# The price check reads the catalyst quality of rings, amulets and jewels

**Status:** never attempted
**Needs:** Path of Exile 2 on Windows
**Origin:** [docs/price-check.md](../../../price-check.md)
**Verified:** 2026-10-19

**Claims.** [docs/price-check.md](../../../price-check.md#item-editor) and
[modules/renderer-parser.md](../../modules/renderer-parser.md) say:

- The game copies the quality of a catalysed ring or amulet as one line such as
  `Quality (Attribute Modifiers): +20% (augmented)`, and a jewel with a refined catalyst the same
  way. `parseJewelleryQuality()` in `renderer/src/parser/jewellery-quality.ts` reads the number after
  the colon and finds the catalyst by a modifier tag from `CATALYST_TO_TAG` in the text before it.
  The only parser case with the line, `CatalysedRing` in `renderer/specs/Parser/items.ts`, is built
  from another ring, not copied.
- The item editor square shows the item's catalyst, and the catalyst picked in the editor replaces
  that quality. [Refinement 061](../../refinements/tasks/061-carapace-catalyst-defences-tag.md)
  expects this to fail for the Carapace Catalyst.

**Do.** [Section 4 of the runbook](../../runbooks/in-game-check.md#4-the-price-check-keys) on a ring
or amulet with each catalyst's quality, and on a jewel with a refined catalyst's quality. Pick
another catalyst in the item editor of one of them.

**Pass.** Each square shows the catalyst the item has, and the modifier filters change only by the
picked catalyst's quality.

**Record.** The copied text of each item as parser cases, replacing `CatalysedRing`. A quality line
the parser does not read goes into a refinement.

## History

- 2026-10-19: Filed when the parser began to read the catalyst quality line, whose format no copied
  item text in the repo shows.
