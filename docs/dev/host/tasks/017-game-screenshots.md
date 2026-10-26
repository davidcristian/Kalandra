# Take Path of Exile 2 screenshots for the pages that lost theirs

**Status:** never attempted
**Needs:** Path of Exile 2 on Windows
**Origin:** [docs/nothing-happens.md](../../../nothing-happens.md)
**Verified:** 2026-10-26

The user pages used images that show Path of Exile 1 or an old version of the app. The docs rewrite
did not copy them into the repo or dropped them, and the pages describe each scene in text. A
screenshot of the game needs the game, so these are listed here. Screenshots of Kalandra alone are
[refinement 033](../../refinements/tasks/033-app-screenshots.md).

| Page | Screenshot to take |
| --- | --- |
| [nothing-happens.md](../../../nothing-happens.md) | The Show Advanced Item Descriptions binding in the game's key bindings |
| [failed-load-leagues.md](../../../failed-load-leagues.md) | The league list the built-in browser shows after the bot check |
| [no-item-mods.md](../../../no-item-mods.md) | A weapon's price check with no modifier filters, to replace `no-stats.png`, which shows the Path of Exile 1 wording `Critical Strike Chance` where the app shows `Critical Hit Chance` |
| [faq.md](../../../faq.md) | The Mousewheel Zoom option and the camera zoom bindings, if host task [008](008-stash-tab-scrolling.md) finds that `mousewheel-zoom.png` and `zoom-keybinds.png` show Path of Exile 1 |
| [extra-widgets.md](../../../extra-widgets.md) | The Image strip over the game with a Path of Exile 2 cheat sheet, to replace `HoverImageStrip.jpg`, which shows the Path of Exile 1 syndicate sheet that Kalandra no longer includes ([refinement 031](../../refinements/tasks/031-path-of-exile-1-features.md)) |

**Do.** Take each screenshot in the game with the current build. Crop it to the part the page
describes, and keep no account name, character name or chat line from other players in it.

**Done looks like.** Each image is in `docs/reference-images/`, under 2 MB, referenced from its page
with an alt text that says what it shows, and the page's text description of it is shortened to
match. The docs build passes ([runbooks/docs-site.md](../../runbooks/docs-site.md)).

## History

- 2026-10-18: Filed from the troubleshooting page rewrites, which did not copy the imgur images
  that showed Path of Exile 1.
- 2026-10-18: Checked against the pages. Removed the rows for the pasted item text and the Debug
  log on nothing-happens.md, which the page shows as text blocks that a screenshot would repeat.
  Named the image strip file to replace.
- 2026-10-26: Removed the row for `ocr-guide.md`, which was deleted with the Heist gem OCR
  ([refinement 031](../../refinements/tasks/031-path-of-exile-1-features.md)).
- 2026-10-26: The image strip row no longer waits for a decision: Kalandra removed its Path of
  Exile 1 syndicate sheet ([refinement 031](../../refinements/tasks/031-path-of-exile-1-features.md)).
