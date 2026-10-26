# Stash search and Find in Stash type into the game's search box

**Status:** never attempted
**Needs:** Path of Exile 2 on Windows
**Origin:** [docs/stash-search.md](../../../stash-search.md)
**Verified:** 2026-10-26

**Claims.** `stashSearch` in `main/src/shortcuts/text-box.ts` focuses the game, puts the text on the
clipboard, and presses Ctrl + F, Ctrl + V and Enter. When the game window does not have the focus
after that, `focusGameFor` in `main/src/windowing/OverlayWindow.ts` logs
`warn [Overlay] Skipped a stash search because the game window does not have the focus` and nothing
is pressed. With Restore clipboard ticked in Settings, General, it puts the old clipboard text back
120 ms later (`restoreShortly` in `main/src/shortcuts/HostClipboard.ts`). The game does the rest.
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
- The game matches a search against the item text in the language it runs in. So the English
  searches of `Map rolling` and `Dump sorting` match nothing with the game in another language,
  while the searches that follow Settings, General, Language match the items of a game in that
  language: the first search of a new widget, and `Currency`, `"Rarity: Normal"` and
  `"Number of Trials:"` of `Dump sorting` (`entrySearchText` in
  `renderer/src/web/stash-search/presets.ts`). In English, `"Number of Trials:"` finds the items
  that the earlier search `Trials:` found.

**Do.** Open the stash and click a search in a Stash search widget. Set a key for Item info in
Settings, Hotkeys (it has no default), open Item info on an item, and click Find in Stash. Repeat
with a vendor window open. Try a search with quotes and one regular expression from the guide.
Click the dollar sign on items with a price note whose note and name, without quotes, have 46 and
47 characters together. Open Kalandra's page with the tray's Open in Browser, click a search there,
and check that nothing is typed into the browser and that Settings, Debug shows the warning.
Set the game and the Language setting to German, add a Stash search widget, and click its search
and each search of `Dump sorting`.

**Pass.** Each claim holds, and the game's own limit for the search box is noted.

**Record.** Any difference goes into the page that states it, in the same commit as this file's
History line.

## History

- 2026-10-18: Filed from the claims the writers of docs/stash-search.md and docs/item-info.md could
  not settle from the code, which only presses keys.
- 2026-10-20: Added the claim that a search presses nothing while the game window does not have the
  focus, such as after a click in a browser tab.
- 2026-10-21: Added the claim that a search matches the item text in the game's language, which
  decides whether the English presets and the search of a new widget match in another language.
- 2026-10-26: Three `Dump sorting` searches now take their text from the game data of the Language
  setting, and the last one changed from `Trials:` to `"Number of Trials:"`.
