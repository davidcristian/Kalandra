# Stash prices reads, prices and marks the tab in the game as the pages say

**Status:** never attempted
**Needs:** Path of Exile 2 on Windows, a premium stash tab, items to put in it, and a trade account with listings
**Origin:** [docs/stash-prices.md](../../../stash-prices.md)
**Verified:** 2026-10-28

**Claims.** The user page says that with **Read the tab in the background** on, Kalandra reads the listings without a
price in one public tab from the trade site, prices each one, and on Windows captures the game window twice a second
while the game is active to see when the stash shows the tab, keeping no capture; that the hotkey marks the tab open or
closed everywhere; and that while the tab is open the overlay draws a mark on each item and a progress bar, takes no
click and keeps the overlay window shown. The reader, the pricer and the detector are tested with saved trade
responses, a fake trade site and drawn frames ([renderer-stash-prices.md](../../modules/renderer-stash-prices.md),
[stash-detection.md](../../modules/stash-detection.md)), and a fake game window was captured in Electron 44
([ADR-0013](../../adr/ADR-0013-game-capture.md)). The game, the live trade site with a real account, and the panels'
look were not checked. The grid of a normal tab is an estimate, at 17, 126.5 with 52.5 pixel cells at 1920 x 1080,
scaled with the window height (`stash-grid.ts`), and so are the cell colors (`cell-classifier.ts`).

**Do.** The steps below, at 1920 x 1080 and at one other resolution, in Windowed Fullscreen and in Windowed mode, with
a normal tab and, if one is at hand, a quad tab. [Section 8 of the runbook](../../runbooks/in-game-check.md#8-stash-prices)
has the setup and the log lines. **Pass.** Each step's result holds. **Record.** In the History: the build, the game
patch, the resolutions, the grid the tooltip names and the one a screenshot shows, the percentages on the open tab,
Kalandra's CPU use, and how long a moved item took to appear. A step that fails becomes a refinement with its log
lines; a constant that is off becomes one with the measured numbers.

## Steps

1. **Turning it on.** Before the setting is on, the main button bar has no tags icon. Check **Read the tab in the
   background** and Save. Pass: the tags icon appears; it shows the widget at the top left under the bar; the widget
   hides when the game gets the focus and shows again with the overlay key. The Stash prices page shows its three
   sections, Find the open tab, Marks over the stash and Set up the tab, without text cut off.
2. **Reading the tab.** Put at least 10 items without a price in the tab: a rare, a magic and a normal item, a unique,
   a stack of 20 or more of one currency, a gem, an uncut gem, a waystone and an Expedition Logbook. Restart Kalandra.
   Pass: within a minute of the league list loading, the widget says `The tab is read.`, `Items in the tab:` counts the
   items, and `Searches in the last 3 hours:` shows a number. Then move one item without a price from another public
   tab into this one and click **Check now** every minute: pass when it appears within two checks, and record the time.
   Move one out: it leaves at the next check. Settings, Debug has no `[stash-prices]` line.
3. **Pricing.** Pass: `Priced N of M, next search in S s.` counts down once a second and N grows by at most one
   search every 15 seconds. The unique, the currency stack and the gem get **estimate** prices for the whole stack;
   the Logbook counts as unreadable. **Most valuable** fits the widget. Price check three of the items with Ctrl + D
   in the stash: the price check's suggested price or estimate matches the widget's within what the listings changed
   in between. In the developer tools' Network tab, save the `/api/trade2/fetch/` response of the gem and of the
   currency stack for [refinement 119](../../refinements/tasks/119-stash-prices-gem-and-currency-fixtures.md).
4. **The capture.** Settings, Debug shows `info [GameCapture] Captures the window "Path of Exile 2"` once. Open the
   stash on the tab, then another tab, then close the stash. Pass: the marks appear about a second after the tab
   opens and go about a second after it closes or another tab shows. With the overlay key, the widget's line says
   `Stash tab seen.` or `not seen`, and with the tab open both percentages are 90 or more. Do it in Windowed mode too,
   and once with both programs run as administrator. Also check the tab with an item highlighted by the stash search,
   an item under the cursor, an item the character cannot use, and another brightness setting: still seen. Record
   Kalandra's CPU use in Task Manager with the stash open, closed, and with stash prices off.
5. **The hotkey.** Set **Hotkey that marks the tab open or closed** and Save. Press it in the game: the marks show
   and the line says `Stash tab shown with the hotkey.`; press it again: they go. Hold Ctrl and press it: it works,
   and Ctrl stays held in the game. With **Find the open tab in the game window (Windows)** off, only the hotkey
   shows and hides the marks.
6. **The marks and the bar.** With the tab open and some items priced, take a screenshot. Pass: each mark lies on its
   item's cells within 3 pixels; a yellow frame with a price on each valuable item, a red fill with a trash icon on
   each trash item, a dashed gray frame on the unreadable ones, and a thin blue one on the item a search prices.
   Turning **Valuable** or **Trash** off removes those marks; a **Trash threshold** of 1 Divine Orb makes more items
   trash. The bar under the grid reads `Priced N of M.`, covers no button you need, and grows when its text wraps.
   On a quad tab, the marks lie on the items; record whether the price of a 1 x 1 item fits its cell. Holding Alt
   hides the marks: record whether that is what you want in the stash.
7. **No click on a mark.** With the game active, click an item under a mark: the game picks it up. With the overlay
   active, click a mark: the overlay's background gets the click, never the mark.
8. **The window stays shown.** Tick "Fully hide overlay when it loses focus instead of making it transparent." in
   Settings, General, and Save. With the game active and the tab open, the marks show; with the stash closed and no
   widget shown, the overlay window hides.
9. **The grid alignment view.** Turn on **Grid alignment view**. Pass: the lines show over the game with the stash
   closed, and with the tab open they lie on the cell borders within 3 pixels, as does the widget line's tooltip
   against the screenshot. If not, set the **Grid correction** until they do, and record both and the resolution.
10. **A paused capture.** With the tab open, press the overlay key, press it again and close the stash at once.
    Record how long the marks stay after the game gets the focus back.

## History

- 2026-10-28: Filed with the detection of the open stash tab, whose grid and colors are estimates.
- 2026-10-28: Added the marks, the progress bar and the grid alignment view over the open tab.
- 2026-10-28: Widened to the whole feature, with steps for reading the tab, pricing, the hotkey and clicks.
