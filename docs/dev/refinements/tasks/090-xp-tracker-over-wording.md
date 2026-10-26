# The XP tracker page describes Over in words that differ from its formula at a safe zone step

**Status:** done 2026-10-26
**Area:** docs
**Origin:** [docs/xp-tracker.md](../../../xp-tracker.md)
**Verified:** 2026-10-26

[docs/xp-tracker.md](../../../xp-tracker.md) says that `Over` is how many levels you are above the
lowest level that still gets full experience in the area. The widget shows
`floor(P / 16) + 3 - (A - P)` (`getOverIdeal()` in `renderer/src/web/leveling/xp-formula.ts`), the
formula the same page gives. The two differ by one where the safe zone grows: at level 16 in a
level 19 area `Over` is 1, but level 15 does not get full experience there, so the words give 0.

By the formula, the area level plus `Over` is the highest area level that gives you full
experience. The safe zone image says the safe zone applies when your level is at most the area
level, and the code applies it only when the area is higher. At equal levels both give 100%, so the
numbers do not differ.

Done looks like: the sentence about `Over` in docs/xp-tracker.md matches the formula, and
`renderer/specs/web/xp-formula.test.ts` still passes.

## History

- 2026-10-25: Found while the XP formula moved into `xp-formula.ts` and its tests compared the
  page with the code.
- 2026-10-26: The page now says that the area level plus `Over` is the highest area level with
  full experience. The safe zone text, the image and its alt text apply the safe zone only when the
  area level is above the player's, as `getExpPenalty()` does.
