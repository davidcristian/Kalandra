# The parser cannot distinguish some stats that share a text

**Status:** open
**Area:** data
**Origin:** [renderer/src/parser/match-stats.ts](../../../../renderer/src/parser/match-stats.ts)
**Verified:** 2026-10-20

`STAT_BY_MATCH_STR` returns every stat with a matcher text, and `statMatchForLine()` in
`match-stats.ts` picks one by the modifier type's trade id, then by the advanced text. That
distinguishes the nine keystone names in English, such as `Iron Reflexes`, which are matchers of
both their own stat and the random keystone stat `#(Ancestral Bond-Zealot's Oath)`. In the committed
`stats.ndjson` files these texts are still shared by stats that the type and the advanced text do
not distinguish, so the parser takes the first in file order:

- Spanish `# al nivel de todas las habilidades de Desesperación`, `... de Debilitar`,
  `... de Cadenas temporales` and `... de Vulnerabilidad`: the explicit stats
  `# to Level of Despair Skills`, `# to Level of Enfeeble Skills`,
  `# to Level of Temporal Chains Skills` and `# to Level of Vulnerability Skills` (picked), and the
  option stat `# to Level of all # Skills`, whose English texts differ by the word `all`.
- Spanish `Tiene Esquirla de cristal`: the Sanctum stats `Has Crystal Shard` (picked) and
  `Has Glass Shard`.
- German `+# gesamt zu allen Attributen`, and Traditional Chinese `+# 全能力 ` and `#% 元素抗性 `:
  the pseudo stats `+# total to Attributes` and `+# total to all Attributes`, and
  `#% total Elemental Resistance` and `#% total to all Elemental Resistances`. The price check
  builds pseudo filters by ref, not by text.

The Spanish texts may be translation errors in the generated data, which is an assumption not
checked against the game.

Done looks like: a `dataParser` run that writes distinct texts where the game data has them, which
depends on [052](052-dataparser-older-than-committed-data.md); for texts the game itself shares, a
rule in `statMatchForLine()` that reads more of the item, such as its unique name; and a parser case
for one such line.

## History

- 2026-10-20: Found while the stat lookup by a matcher text was changed to return every stat with
  that text, which fixed the keystone rune lines and the keystone lines without a range.
