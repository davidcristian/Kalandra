# Copy the items whose parser cases are built by hand

**Status:** never attempted
**Needs:** Path of Exile 2 on Windows
**Origin:** [AGENTS.md](../../../../AGENTS.md#what-every-change-must-pass)
**Verified:** 2026-10-26

Rule 5 of AGENTS.md says a parser case is the item text copied from the game. Neither
`renderer/specs/` nor the git history holds a copy of the items below, so their cases in
`renderer/specs/Parser/items.ts` are built by hand from other copied items, and each says so in a
comment. No copied item text in the repo is in a language other than English, has a catalyst
quality line or is a jewel. Host tasks [013](013-map-check.md), [015](015-other-game-languages.md),
[018](018-catalyst-quality-lines.md) and [019](019-keystone-lines.md) ask for some of the same
copies, and one copy serves both tasks.

| Copy | Replaces in `items.ts` |
| --- | --- |
| A rare weapon with an implicit, a rune, elemental damage and modifier lines, once in German and once in Japanese ([015](015-other-game-languages.md)) | nothing: a new case per language, since every case in another language is a normal or unique item without modifier lines |
| A ring and an amulet with catalyst quality, such as `Quality (Attribute Modifiers)`, and a jewel with refined catalyst quality ([018](018-catalyst-quality-lines.md)) | `CatalysedRing` |
| A rare waystone with Magic Monsters, Item Rarity, Monster Rarity and Monster Effectiveness lines ([013](013-map-check.md)) | `RareMapFakeAllProps` |
| A rare jewel and a magic jewel | `RareJewel`, `MagicJewel` |
| A crossbow with an increased Reload Speed modifier | `ReloadSpeedCrossbow` |
| A Temple Tablet | `TempleTablet` |
| The boots or helmet with a keystone rune, and the Flesh Crucible, of [019](019-keystone-lines.md) | `KeystoneRuneLine`, `RandomKeystoneLine` |
| In Japanese: Arrayed Focus, Array Buckler, Vagabond Armour, Atziri's Disdain and Atziri's Contempt. In German: Plated Vestments, Plated Raiment, Couture of Crimson and Coat of Red | the case for the same item in the `SharedNameItems` region, such as `JaArrayedFocus` |

Some copied cases have lines that a later commit changed, and the commit does not say whether the
item was copied again. A new copy of the same kind of item confirms the format or replaces the case:

- `RareMap`: its `Waystone Tier: 14` line was removed and `Monster Pack Size` became `Pack Size`.
- `RareWithImplicit`, `HighDamageRareItem`, `TwoImplicitItem` and `TwoLineOneImplicitItem`: the
  ` (implicit)` suffix was removed from their implicit lines.
- `ItemAllTheModifierTypes`: its rune line `Gain 24 Mana per enemy killed` became 30 Mana.

These cases stay built by hand, because they test text that the game does not write or that the
item data lacks: `RequiresUnknownFormat`, `ModifierLineUnknownFormat`,
`ModifierIncreaseUnknownFormat`, `RuneLineWithoutRuneStat`, `UniqueOnUnknownBase`,
`NormalOnTradeOnlyBase`, `MagicNameWithHashOfAnotherItem`, `JaAtziriOnOtherBase` and
`HybridDefenceRing` ([refinement 061](../../refinements/tasks/061-carapace-catalyst-defences-tag.md)).

**Do.** Copy each item with the advanced descriptions key, as
[section 3 of the runbook](../../runbooks/in-game-check.md#3-clipboard-capture-with-the-advanced-descriptions-key)
says, and paste the text unchanged. For a German or Japanese copy, set the game to that language
first. Keep no account or character name in the text.

**Done looks like.** Each copy is a `TestItem` in `items.ts` in place of the case it replaces, with
its expected fields checked by hand against the text and without the comment that says it is built
by hand. Each runs through `parseClipboard` in the suite that read the case it replaces, or in
`whole-item.test.ts` for a new case, and `npx vitest run` in `renderer/` passes.

## History

- 2026-10-26: Filed when the parser cases were checked for text not copied from the game. The
  explicit modifier test in `modifiersParsers.test.ts` then took its sections from copied items in
  place of a section written by hand, and the copied waystone `RareMap` became a whole item case.
- 2026-10-26: `KeystoneUniqueLine` became a Mask of the Sanguimancer that a user copied for a bug
  report to Exiled Exchange 2, so the table no longer lists it.
