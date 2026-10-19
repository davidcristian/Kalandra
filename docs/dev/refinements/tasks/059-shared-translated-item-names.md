# The parser cannot distinguish items that share a translated name and defences

**Status:** open
**Area:** data
**Origin:** [renderer/src/parser/match-records.ts](../../../../renderer/src/parser/match-records.ts)
**Verified:** 2026-10-19

In the committed `items.ndjson` files, 76 names belong to more than one `refName` in the same
namespace: Traditional Chinese 5, German 11, Spanish 19, French 8, Japanese 10, Korean 8,
Portuguese 14 and Russian 1. The count groups each language's records by namespace and name.
`ITEM_BY_TRANSLATED` returns every record with the name, and `recordsMatchingItem()` in
`match-records.ts` keeps a unique by its base type and a base type by the armour, evasion and
energy shield lines the item shows. That distinguishes the 4 unique names and 6 pairs of base types,
such as the Japanese Array Buckler and Arrayed Focus. The parser takes the first record in file
order for the others:

- 54 pairs of base types with the same defences, or none, such as Taut Crossbow and Tense Crossbow
  in four languages, and the German Blacksmith Maul (a two hand mace) and Smithing Hammer (a one
  hand mace).
- 12 gem names, such as Despair (a skill gem) and Desperation (a support gem) in Traditional
  Chinese, Spanish and Portuguese, and the German Rearm I and Rearm II.

Many of these look like translation errors in the generated data, which is an assumption not
checked against the game: the Japanese Array Buckler has the name of Arrayed Focus and no icon,
and Spanish Runeforged bases such as Runeforged Garment have the name of their plain base. The
parser reads only the label of the item class line, and `client_strings.js` has no item class
names, so the parser cannot use the class line to distinguish them yet.

Done looks like: a `dataParser` run that writes the correct names where the game data has them,
which depends on [052](052-dataparser-older-than-committed-data.md); for names the game itself
shares, item class names in `client_strings.js` that `recordsMatchingItem()` compares with the
item class line; and a parser case for one such pair.

## History

- 2026-10-19: Found while the item lookup by a translated name was changed to return every item
  with that name, which fixed the uniques and the pairs above that differ in their defences.
