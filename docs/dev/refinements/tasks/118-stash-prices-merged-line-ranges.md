# Merged modifier lines of the newer trade format get no roll range

**Status:** open
**Area:** trade
**Origin:** [renderer/src/web/stash-prices/mod-text.ts](../../../../renderer/src/web/stash-prices/mod-text.ts)
**Verified:** 2026-10-28

The trade site writes two modifiers of one stat as one line. In the older fetch format, whose lines
are strings, `extended.hashes` names the modifiers of each line, and `kindBlocks()` in `mod-text.ts`
writes the line with the sum of their ranges. In the newer format, whose lines are objects that list
their own `mods`, the magnitudes have no hash, so a line made by several modifiers gets no range.
The parser then reads the roll without a range, and the price check's default filter for that stat
can differ from the one of a copied item.

Done looks like: a saved fetch result of the newer format with such a line, and the line's range
from the magnitudes when their order can be matched to the line's values. If it cannot, the comment
in `kindBlocks()` keeps the reason and this task is declined.

## History

- 2026-10-28: Left for later by the stash prices pricer, which writes no range for such a line.
