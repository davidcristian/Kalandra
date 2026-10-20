# The price check matches keystone lines to the stat the item has

**Status:** never attempted
**Needs:** Path of Exile 2 on Windows
**Origin:** [docs/dev/modules/renderer-parser.md](../../modules/renderer-parser.md)
**Verified:** 2026-10-20

**Claims.** In `renderer/public/data/en/stats.ndjson`, nine keystone names, such as
`Iron Reflexes` and `Pain Attunement`, are each a stat of their own and a matcher of the random
keystone stat `#(Ancestral Bond-Zealot's Oath)`. The data gives that stat the advanced text
`<keystone>(Ancestral Bond-Zealot's Oath)`. `statMatchForLine()` in
`renderer/src/parser/match-stats.ts` picks between them by the rule that
[modules/renderer-parser.md](../../modules/renderer-parser.md) gives, which expects:

- The rune lines of Legacy of The Knight-errant on boots and Legacy of Crown of Thorns on a helmet,
  `Iron Reflexes (rune)` and `Pain Attunement (rune)`, match the keystone's own stat, the one with
  a `rune` trade id.
- With the advanced descriptions key, the game copies the keystone line of the Flesh Crucible
  unique jewel as the advanced text, such as `Eldritch Battery(Ancestral Bond-Zealot's Oath)`, and
  the line matches the random keystone stat. A line with only the keystone name, outside a rune
  line, matches the keystone's own stat.

The parser cases `KeystoneRuneLine`, `KeystoneUniqueLine` and `RandomKeystoneLine` in
`renderer/specs/Parser/items.ts` are built from other items, not copied.

**Do.** [Section 4 of the runbook](../../runbooks/in-game-check.md#4-the-price-check-keys) on boots
with Legacy of The Knight-errant, a helmet with Legacy of Crown of Thorns, and a Flesh Crucible.

**Pass.** No keystone line shows as **Not recognized modifier**. The rune lines search the rune
stat, and the Flesh Crucible line searches the random keystone stat with the keystone as its option.

**Record.** The copied text of each item as parser cases, replacing the built ones. A line that
matches another stat goes into a refinement.

## History

- 2026-10-20: Filed when the parser began to pick among the stats that share a keystone name,
  since no copied item text in the repo has such a line.
