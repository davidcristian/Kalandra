# The Map check remove button also clears the marks of later profiles

**Status:** open
**Area:** renderer
**Origin:** [renderer/src/web/map-check/SettingsMatcherEntry.vue](../../../../renderer/src/web/map-check/SettingsMatcherEntry.vue)
**Verified:** 2026-10-18

Map check keeps the marks of one modifier for its three profiles in one string, `decision`, with one
character per profile: `-` for no mark, and `w`, `d`, `g` or `s` (`decisionHasColor` in
`renderer/src/web/map-check/common.ts`). `remove()` in `SettingsMatcherEntry.vue`, the x button on a
marked row, sets `decision.value = "---"`. The setter passes that value to `decisionCreate()`, which
writes it into the one character of the current profile. A remove on `"wdg"` in profile I gives
`"---dg"`, which reads as no mark in all three profiles. In profile II it gives `"w---g"`, which
also clears profile III. Each result is five characters long.

[docs/map-check.md](../../../map-check.md) states this and gives a workaround.

Done looks like, in one `fix(renderer)` commit: `remove()` sets `decision.value = "-"`; a test in
`renderer/specs/` removes a mark in profile II and checks that profiles I and III keep theirs; the
sentence in docs/map-check.md is removed. The renderer has no library that mounts a Vue component,
so the remove logic moves into a function in `common.ts` that the test calls. Saved configs can
already hold five-character strings, so the commit also decides whether an upgrade step rewrites
them as three characters, under the hard rule in
[AGENTS.md](../../../../AGENTS.md#the-one-hard-rule).

## History

- 2026-10-18: Found while docs/map-check.md was rewritten, by reading `remove()` and
  `decisionCreate()` and computing the strings above by hand.
