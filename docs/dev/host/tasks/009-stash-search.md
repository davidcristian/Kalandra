# Stash search and Find in Stash type into the game's search box

**Status:** never attempted
**Needs:** Path of Exile 2 on Windows
**Origin:** [docs/stash-search.md](../../../stash-search.md)
**Verified:** 2026-10-18

**Claims.** `stashSearch` in `main/src/shortcuts/text-box.ts` focuses the game, puts the text on the
clipboard, and presses Ctrl + F, Ctrl + V and Enter. With Restore clipboard ticked in Settings,
General, it puts the old clipboard text back 120 ms later (`restoreShortly` in
`main/src/shortcuts/HostClipboard.ts`). The game does the rest.
[docs/stash-search.md](../../../stash-search.md) and [docs/item-info.md](../../../item-info.md)
say:

- Ctrl + F selects the search box of the open stash, and also of an open vendor window, and the
  game highlights the items that match.
- Quotes make the game match the words as one phrase, and the regex guide on the Path of Exile 1
  wiki describes the syntax Path of Exile 2 accepts.
- Find in Stash types the item's name in quotes. The dollar sign button in Item info, shown only
  for an item with a price note, types the note in quotes. With Filter by set to Price and Item,
  the dollar sign also adds the name when the note and the name, with their quotes, are at most 50
  characters together (`note.length + name.length < 51` in
  `renderer/src/web/item-check/hotkeyable-actions.ts`, where both are `JSON.stringify` output).
  That is 46 characters without the four quotes. The open question is whether the game's search
  box has a length limit, and whether 50 is that limit.

**Do.** Open the stash and click a search in a Stash search widget. Set a key for Item info in
Settings, Hotkeys (it has no default), open Item info on an item, and click Find in Stash. Repeat
with a vendor window open. Try a search with quotes and one regular expression from the guide.
Click the dollar sign on items with a price note whose note and name, without quotes, have 46 and
47 characters together.

**Pass.** Each claim holds, and the game's own limit for the search box is noted.

**Record.** Any difference goes into the page that states it, in the same commit as this file's
History line.

## History

- 2026-10-18: Filed from the claims the writers of docs/stash-search.md and docs/item-info.md could
  not settle from the code, which only presses keys.
