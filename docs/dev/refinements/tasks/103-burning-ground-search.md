# The default Map rolling search "Burning Ground" names no Waystone modifier of the game data

**Status:** open
**Area:** renderer
**Origin:** [renderer/src/web/stash-search/WidgetStashSearch.vue](../../../../renderer/src/web/stash-search/WidgetStashSearch.vue)
**Verified:** 2026-10-26

`defaultInstances()` in `WidgetStashSearch.vue` gives the `Map rolling` widget the search
`"Burning Ground"`. No line of `renderer/public/data/en/stats.ndjson`, `items.ndjson` or
`client_strings.js` contains that text, and the Waystone stat of the game data is
`Area has patches of Ignited Ground`. [docs/stash-search.md](../../../stash-search.md) shows a
stash tab where the search highlights Waystones, which may come from an earlier game version.

Done looks like: the maintainer checks the search in the game
([host task 009](../../host/tasks/009-stash-search.md)) and, if it finds nothing, picks a default
that the game data has, with a config step that changes only the saved default text, under
[the one hard rule](../../../../AGENTS.md#the-one-hard-rule), and the page and its image updated.

## History

- 2026-10-26: Left by [072](072-stash-search-presets-in-english.md), whose game export of 25 Oct
  2026 has no text for this search in any language.
