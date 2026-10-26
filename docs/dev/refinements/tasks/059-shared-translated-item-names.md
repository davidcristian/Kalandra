# The parser cannot distinguish items that share a translated name and defences

**Status:** open
**Area:** data
**Origin:** [renderer/src/parser/match-records.ts](../../../../renderer/src/parser/match-records.ts)
**Verified:** 2026-10-26

In the committed `items.ndjson` files, 76 names belong to more than one `refName` in the same
namespace: Traditional Chinese 5, German 11, Spanish 19, French 8, Japanese 10, Korean 8,
Portuguese 14 and Russian 1. The count groups each language's records by namespace and name.
`ITEM_BY_TRANSLATED` returns every record with the name, and `recordsMatchingItem()` in
`match-records.ts` keeps a unique by its base type and a base type by the armour, evasion and
energy shield lines the item shows. That distinguishes the 4 unique names and 6 pairs of base types,
such as the Japanese Array Buckler and Arrayed Focus. The parser takes the first record in file
order for the other 66: 54 pairs of base types with the same defences, or none, and 12 gem names.

The game itself gives each of the 66 pairs one name. In the game export of 2026-10-25 under
`dataParser/data/vendor/`, each language's `BaseItemTypes.json` has the name of `items.ndjson` for
both items of every pair, and a local `dataParser` run writes the same 76 shared names. A new data
run cannot fix them. What tells the items apart:

- 7 pairs differ in item class: the German Blacksmith Maul (a two hand mace) and Smithing Hammer
  (a one hand mace), Despair (a skill gem) and Desperation (a support gem) in Traditional Chinese,
  Spanish and Portuguese, the Spanish Rupture and Snap, the Spanish Advancing Storm and Gathering
  Storm, and the Portuguese Firestorm and Stormfire. The item class line differs, but the parser
  reads only its label, because `client_strings.js` has no item class names. Each language's
  `ItemClasses.json` in the game export has them.
- 59 pairs share the item class too, such as Taut Crossbow and Tense Crossbow in four languages, the
  Spanish Garment and Runeforged Garment, and the German Rearm I and Rearm II. Their copied text
  differs only in values that `items.ndjson` does not contain, such as the level requirement and
  the weapon damage.

Done looks like: `dataParser` writes each language's item class names into `client_strings.js`, a
data commit adds them, and `recordsMatchingItem()` keeps the records whose category matches the
item class line, with a parser case for the Blacksmith Maul and Smithing Hammer. The data commit
waits for [052](052-dataparser-older-than-committed-data.md): on 2026-10-26 the `client_strings.js`
that this copy of `dataParser` writes lacks 19 keys that the committed files have, such as
`ARMOUR_TAG` and `WAYSTONE_MONSTER_RARITY`. The 59 pairs need data that `items.ndjson` does not
have, such as each base type's level requirement.

## History

- 2026-10-19: Found while the item lookup by a translated name was changed to return every item
  with that name, which fixed the uniques and the pairs above that differ in their defences.
- 2026-10-26: Checked the 66 names against the game export: the game shares them, so they are not
  translation errors in the generated data, and only the 7 pairs with different item classes can be
  told apart from the copied text with data the game export has.
