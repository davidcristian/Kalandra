# The stats.ndjson files of the languages differ in their refs and stats

**Status:** open
**Area:** data
**Origin:** [renderer/src/assets/data/index.ts](../../../../renderer/src/assets/data/index.ts)
**Verified:** 2026-10-20

A stat's `ref` is its English text, which code uses to name the stat in every language through
`STAT_BY_REF` and `stat()`. The committed `stats.ndjson` files are generated per language, and
comparing each file's refs and trade ids (`stat_<number>`) with the 2526 English stats shows:

- **Other refs for the same trade id.** These stats exist under another ref:
  - `#% maximum Player Resistances` (`stat_3376488707`) is `#% to all Maximum Resistances` in
    cmn-Hant, ja, es and fr.
  - `#% chance to cause Bleeding on Hit` and `Grants # Rage on Hit`: ru, cmn-Hant, ko, ja, de, es
    and fr.
  - `Leeches #% of Physical Damage as Life` and `Leeches #% of Physical Damage as Mana`: ru, ko
    and pt.
  - `Allies in your Presence Regenerate #% of your Maximum Life per second`: cmn-Hant and ko.
  - `Causes #% increased Stun Buildup`: cmn-Hant and es. `Maximum Quality is #%`: ko and ja.
  - `Unblockable`, `#% increased quantity of Relics dropped by Monsters` and
    `#% increased Stun Threshold if you haven't been Stunned Recently`: ko.
  - `#% increased Energy Shield Recovery rate`: ja. `#% increased Mana Recovery from Flasks`: fr.
    `Map has #% chance to contain three additional Breaches`: de.
  - Refs that English does not have: `#% increased Experience gain in Map` (ru, cmn-Hant, es),
    `#% increased Rarity of Items found in Map` (ru, fr), `#% to all Maximum Resistances`
    (cmn-Hant, ja, es, fr) and `Map contains an additional Azmeri Spirit` (cmn-Hant).
- **Stats that Traditional Chinese does not have.** cmn-Hant has no stat with the ref or a trade id
  of 93 English stats: 59 with only a `rune` id (32 of them `Bonded` stats), 18 with only an
  `explicit` id, 4 with only an `implicit` id (`#% increased Damage taken`,
  `Breaks # Armour on Critical Hit`, `Has no Accuracy Penalty from Range` and `Unblockable`), and
  12 with several types. Many are Expedition, Verisium and Runic Ward stats. The parser does not
  recognize their lines in Traditional Chinese.
- **An untranslated stat.** The random keystone stat `#(Ancestral Bond-Zealot's Oath)` has the
  English keystone names, such as `Vaal Pact`, as its matchers in all eight other languages, so
  its line in another language matches no stat.

No code names a ref of the first group through `STAT_BY_REF` or `stat()`, so those differences
have no effect yet. Whether the cmn-Hant gap comes from the generator or from a Traditional Chinese
source that lags is not known.

Done looks like: a `dataParser` run that writes every language from the same English stat list,
which depends on [052](052-dataparser-older-than-committed-data.md); a data test that each language
has a stat for every English trade id; and translated matchers for the random keystone stat. See
also [064](064-shared-stat-texts.md) for stats that share a text.

## History

- 2026-10-20: Found while checking which stats share a matcher text in each language.
