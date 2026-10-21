# Three default Map check marks are not in the game data

**Status:** open
**Area:** renderer
**Origin:** [renderer/src/web/item-check/WidgetItemCheck.vue](../../../../renderer/src/web/item-check/WidgetItemCheck.vue)
**Verified:** 2026-10-21

`initInstance()` of the item check widget in `WidgetItemCheck.vue` marks four modifiers by stat ref
in profile I of a new config: `#% maximum Player Resistances` (`w--`),
`Monsters reflect #% of Physical Damage` (`d--`), `Monsters reflect #% of Elemental Damage` (`d--`)
and `Area contains two Unique Bosses` (`g--`). Only the first is a ref in
`renderer/public/data/en/stats.ndjson`. `isOutdated()` in `renderer/src/web/map-check/common.ts`
treats a marked ref with no stat as outdated. So a new user sees three outdated rows, and every Map
check in profile I shows the `map_check.has_outdated` message
(`Wording of some stats has been changed. ...`) until the user deletes them. The first is outdated
too in the languages whose data has another ref for it
([065](065-stat-refs-differ-between-languages.md)).

Done looks like: the maintainer picks default marks that exist in the Path of Exile 2 data, the
change follows the hard rule in [AGENTS.md](../../../../AGENTS.md#the-one-hard-rule) with an upgrade
step that removes only these three defaults from an existing config, and a test checks that every
default ref is in `stats.ndjson`. [013 on the host list](../../host/tasks/013-map-check.md)
checks the marks in the game.

## History

- 2026-10-18: Found while docs/map-check.md was rewritten: a search of the English `stats.ndjson`
  matchers finds only `#% maximum Player Resistances` of the four.
- 2026-10-21: Map check marks now name a modifier by stat ref, and the `< 37` config step names
  these four defaults of earlier configs by ref. The three marks are still outdated.
