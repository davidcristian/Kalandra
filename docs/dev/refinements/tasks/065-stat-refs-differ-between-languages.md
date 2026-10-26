# The stats.ndjson files of the languages differ in their refs and stats

**Status:** done 2026-10-26
**Area:** data
**Origin:** [renderer/src/assets/data/index.ts](../../../../renderer/src/assets/data/index.ts)
**Verified:** 2026-10-26

A stat's `ref` is its English text, which code uses to name the stat in every language through
`STAT_BY_REF` and `stat()`. The committed `stats.ndjson` files are generated per language, and
comparing each file's refs and trade ids (`stat_<number>`) with the 2526 English stats shows:

- **Other refs for the same trade id.** The data tool merged the stats that share a text in that
  language and kept the ref of one, so `#% maximum Player Resistances` is
  `#% to all Maximum Resistances` in cmn-Hant, ja, es and fr, and `#% chance to cause Bleeding on
  Hit` and `Grants # Rage on Hit` are missing in seven languages. ru, ko, ja, de, es, fr and pt
  lack 2 to 9 English refs and cmn-Hant 98, and ru, cmn-Hant, ja, es and fr have 1 to 3 refs that
  English does not have.
- **Stats that Traditional Chinese does not have.** cmn-Hant has no stat with the ref or a trade id
  of 93 English stats, such as `Unblockable` and the `Bonded` rune stats, so the parser does not
  recognize their lines. `pathofexile.tw` does not list them, and the tool kept only the stats that
  the language's trade site lists.
- **An untranslated stat.** The random keystone stat `#(Ancestral Bond-Zealot's Oath)` has the
  English keystone names, such as `Vaal Pact`, as its matchers in all eight other languages, so
  its line in another language matches no stat.

Map check marks name a modifier by its ref, so a mark of a stat with another ref does not match in
that language, and shows as outdated there. The default mark `#% maximum Player Resistances` is one
of them.

The data tool now writes the English stat list in every language
([dataparser.md](../../modules/dataparser.md#outputs)), and `dataParser/tests/test_main.py` checks
it on the game export and trade data of 25 Oct 2026. Compared with a build of the same inputs
without that change, it changes these `stats.ndjson` lines, by ref:

- ru: adds `#% chance to cause Bleeding on Hit`, `Grants # Rage on Hit` and
  `Leeches #% of Physical Damage as Life` and `as Mana`; removes
  `#% increased Experience gain in Map` and `#% increased Rarity of Items found in Map`, whose
  matchers join `#% increased Experience gain` and `#% increased Rarity of Items found`.
- ko: adds `#% chance to cause Bleeding on Hit`, `Grants # Rage on Hit`, both `Leeches` stats,
  `Unblockable`, `Maximum Quality is #%`, `#% increased quantity of Relics dropped by Monsters`,
  `#% increased Stun Threshold if you haven't been Stunned Recently` and
  `Allies in your Presence Regenerate #% of your Maximum Life per second`.
- ja: adds the Bleeding and Rage stats, `#% maximum Player Resistances`, `Maximum Quality is #%`
  and `#% increased Energy Shield Recovery rate`; removes `#% to all Maximum Resistances`.
- de: adds the Bleeding and Rage stats and
  `Map has #% chance to contain three additional Breaches`.
- es: adds the Bleeding and Rage stats, `#% maximum Player Resistances` and
  `Causes #% increased Stun Buildup`; removes `#% to all Maximum Resistances` and
  `#% increased Experience gain in Map`.
- fr: adds the Bleeding and Rage stats, `#% maximum Player Resistances` and
  `#% increased Mana Recovery from Flasks`; removes `#% to all Maximum Resistances` and
  `#% increased Rarity of Items found in Map`.
- pt: adds both `Leeches` stats.
- cmn-Hant: adds 75 stats, 70 whose trade ids `pathofexile.tw` does not list and 5 that the tool
  merged into another stat; removes `#% to all Maximum Resistances`, `#% increased Experience gain in Map` and
  `Map contains an additional Azmeri Spirit`; and adds to 204 stats the trade ids of the types
  that `pathofexile.tw` does not list, such as `crafted`. 33 of the new stats, the 31 `Bonded:`
  stats and the two `Notable Passive Skills in Radius also grant` resistance stats, have no
  matchers, since the game has no description for them.
- In each language, the stats that share a text, such as `#% chance to inflict Bleeding on Hit`
  and the added `#% chance to cause Bleeding on Hit`, get the trade ids of both, so the search of
  such a line is unchanged.

Done looks like: the maintainer's go-ahead for a data update with these lines. A `--push` from this
copy also drops the stats that only the newer tool writes ([052](052-dataparser-older-than-committed-data.md)),
among them the random keystone stat, so the update waits for 052 or for the maintainer to accept
that loss. Then a renderer data test that each language has a stat for every English ref, and
translated matchers for the random keystone stat, which this copy of the tool does not write. See
also [064](064-shared-stat-texts.md) for stats that share a text.

## History

- 2026-10-20: Found while checking which stats share a matcher text in each language.
- 2026-10-21: Map check marks started to name modifiers by ref, which makes the first group matter
  for them.
- 2026-10-26: A build from the game export and trade data of 25 Oct 2026 showed the cause: the
  tool merged stats by the text of each language and dropped the stats that the language's trade
  site does not list. The tool now writes the English stat list in every language; the data
  update waits for the maintainer's go-ahead.
- 2026-10-26: Done by fix(data): use the english stat refs in every language. The records that
  differ between builds with and without the English stat list are now the tool's output, field by
  field: Traditional Chinese `Culling Strike` keeps its committed `id`, and four Traditional Chinese
  stats that the committed file lacks were not added. `stat-refs.test.ts` checks the refs. The rest
  is [102](102-stat-refs-left-after-english-stat-list.md).
