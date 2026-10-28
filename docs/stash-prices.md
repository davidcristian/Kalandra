---
title: Stash prices
---

Stash prices reads one public stash tab of yours from the official trade site while Kalandra runs, lists the items in
it that have no price, and prices each of them as a [price check](/price-check) would. You put items into that tab,
and Kalandra finds and prices them there without a key press. When you open the tab in the game, Kalandra marks each
item over the stash with its price or as trash. Its widget shows what it read and priced, when it searches next and how
many trade searches it may still use. It is off until you turn it on, and it needs the
[suggested price](/suggested-price), which prices its items.

## Set up the tab

1. In Path of Exile 2, make a premium stash tab public and name it `kalandra-price-check`, or the name you set in
   **Stash tab name**.
2. Put the items in it without a price: set no price on the tab and none on the items. Kalandra reads only listings
   without a price.
3. Press the overlay key (`Shift + Space` by default), click the cog icon to open the Settings window, and enter your
   **Account name** with its number, such as `Name#1234`, on the **Price check** page.
4. On the same page, under **Show a suggested price (experimental)**, check **Price a stash tab in the background**
   and click **Save**. The **Stash prices** page holds its other settings.

Kalandra checks the tab once it has loaded the league list from the trade site, and again after each **Check the tab
every** interval. The trade site lists an item some time after it reaches a public tab, so an item can first appear at
a later check. Click **Check now** in the widget to check at once.

## The widget

Click the tags icon in the main button bar to show the widget. The button is there only while **Price a stash tab in
the background** is on. The widget shows:

- **Stash tab**: the name of the tab it reads.
- **Items in the tab**: the items without a price that the last check found in the tab.
- **Last check** and **Next check**: the time of the last check and of the next one.
- **Searches in the last 3 hours**: the trade searches that the trade site counted from your IP address in the last 3
  hours, of your **Search budget**. It shows `?` until the first trade search since Kalandra started has
  returned, a price check search included.
- A line that says what it does or why it waits, from the table below.
- **Priced 23 of 60, next search in 12 s.**: the items priced so far, and when the next pricing search goes out.
- **Not priced:** the items with too few listings to price, the items Kalandra cannot read, and the searches that
  failed, which it tries again later.
- A line that says why pricing waits, from the [pricing table](#how-kalandra-prices-the-items).
- **Most valuable:** the 8 items with the highest price, each with its price after `~`, written as the
  [suggested price](/suggested-price) writes it, and its reliability, or **estimate** for a price from the price file.
- **Check now**: checks at once. The budget and the pauses below still apply.

Its **edit** button opens the **Stash prices** page of the Settings window.

| Line | What it means |
| --- | --- |
| Off. Turn it on under Show a suggested price on the Price check page. | **Price a stash tab in the background** is off. |
| Set your account name on the Price check page of the settings. | The **Account name** on the Price check page is empty. |
| Waiting for the league list. | Kalandra has not loaded the league list from the trade site yet. It tries again every 30 seconds. |
| Paused while the price check is open. | It tries again every 30 seconds, and checks once the price check window is closed. |
| Paused while your own price checks wait for the rate limit. | Your price checks go first. It tries again 30 seconds later. |
| Paused: the searches of the last 3 hours reached the budget. | It tries again after the interval. |
| Paused by the trade site's rate limit. | The rate limit holds the next search, for example after a `Rate limit exceeded` error. It tries again 30 seconds later. |
| Reading the tab. | A check runs. |
| The tab is read. | The last check worked. |
| The trade site failed: | The last check ended with the trade site's error after the colon. It checks again after the interval, and the [Debug](/settings#debug) log has the same message. |

## How Kalandra sees the open tab

To mark the items in the game, Kalandra must detect when the stash shows this tab. On Windows it looks at the game
window: while **Price a stash tab in the background** is on, the game window is active and the tab holds items on 3
cells or more, the overlay captures the game window twice a second. It reads 4 pixels near the corners of each stash
cell: a cell under an item has a navy background, or a red one for an item your character cannot use, and an empty cell
is dark gray. When at least 90% of the cells under the items it read from the trade site look filled, and 90% of all
cells look as those items say, in 2 captures in a row, the tab counts as open. After 2 captures that do not match, it
counts as closed.

- Kalandra captures the game window alone, the window named as **PoE window title** on the General page says, not
  your screen, other windows or its own overlay.
- The captures stay in memory, Kalandra reads a few pixels of each and keeps none: nothing is stored, logged or sent.
- Kalandra never presses a key or clicks for this.
- Items you put in the tab after the last check, and items with a price, count against the match: up to 14 such
  cells of a normal tab still match. Click **Check now** after you add many items.
- Linux and macOS have no capture: there, and when you turn the capture off, use the hotkey below.

**Hotkey that marks the tab open or closed**: press it when you open the tab and again when you close it. On Windows
it also changes what the capture saw, until the capture sees the tab open or close. It has no key by default; set one
on the **Stash prices** page. It works only while **Price a stash tab in the background** is on.

**Grid correction**: Kalandra places the grid of the tab from the height of the game window. When the widget's
percentages stay low with the tab open, point at that line: its tooltip says where the grid starts and how wide a cell
is, in pixels of the game window. Compare that with a screenshot of the game, and set the difference on the **Stash
prices** page, in pixels of the game window or in percent of its height, which stays right when you change the
resolution. **Cell size** is added to the width of a cell of a normal tab.

**Grid alignment view**: turn it on, under the grid correction, to see where Kalandra places the grid. While stash
prices is on, Kalandra draws the line of every cell over the game, even when it has not seen the tab, since a grid in
the wrong place keeps the capture from seeing it. Open the tab, compare the lines with the cells of the stash, change
the grid correction until they match, and turn the view off.

The widget's line under the status says what Kalandra sees, and what the capture does:

| Line | What it means |
| --- | --- |
| Stash tab seen. / Stash tab not seen. | Whether the stash shows the tab now. |
| Capture: 96% of the item cells and 98% of all cells match. | The last capture: the share of the cells under the items that look filled, and of all cells that look as the items say. Both must be 90% or more. |
| Capture paused while the game window is not active. | The capture runs again when you return to the game. The widget shows only while the overlay is active, so it also names the shares of the last capture. |
| Capture off: the tab needs items on 3 cells or more. | Too few items to tell the tab from an empty one. |
| Capture off: it works only on Windows, so use the hotkey. | Linux and macOS. |
| Capture off: turned off in the settings, so use the hotkey. | **Find the open tab in the game window (Windows)** is off. |
| Stash tab shown with the hotkey. / Stash tab hidden with the hotkey. | You pressed the hotkey last. |
| Capture off: | Any other reason after the colon, such as a game window that Kalandra cannot find. It tries again every 30 seconds, and the [Debug](/settings#debug) log has the reason. |

**When the capture does not see the tab:**

- The line says `Capture off:` with a reason: open the [Debug](/settings#debug) page. `Found no window named` means
  that **PoE window title** on the General page is not the title of the game window, `Path of Exile 2` by default.
  When the game runs as administrator, start Kalandra as administrator too.
- The capture runs, but the percentages stay low with the tab open: the grid is in the wrong place. Turn on **Grid
  alignment view** and set the **Grid correction**, as above.
- Nothing helps: turn off **Find the open tab in the game window (Windows)** and use the hotkey, as on Linux and macOS.

## The marks over the stash

While the stash shows the tab, Kalandra draws over it:

- A bar under the grid, filled by the share of the items done, that says **Priced 14 of 40.** and why pricing waits,
  as the [pricing table](#how-kalandra-prices-the-items) says.
- On a **valuable** item, whose whole stack is worth the trash threshold or more: a yellow frame with its price,
  written as the [suggested price](/suggested-price) writes it.
- On a **trash** item, whose whole stack is worth less than the threshold: a red fill with a trash icon.
- On an item without a price, with too few listings, unreadable or after a failed search: a dashed gray frame, so you
  know Kalandra tried it.
- On the item that a search prices now: a thin blue frame. An item that waits for its search has no mark.

**Highlight** on the **Stash prices** page has two buttons, **Valuable** and **Trash**, each on by default: turn one
off to leave out its marks. The other marks stay. The **Trash threshold** is 1 Chaos Orb by default, and can be an
amount of Chaos Orbs, Exalted Orbs or Divine Orbs. It is compared with the value of the whole stack, not of one item: a
stack of 20 Chaos Orbs is worth 20 Chaos Orbs. Kalandra converts it with the price of that currency in the price file,
and when the price file has none, no item is trash.

The marks show while the game window is active, and stay while you use the overlay, since the capture then pauses.
They go about a second after the tab or the stash closes, or when you press the hotkey. Holding `Alt` hides them with
the rest of the overlay. They never take a click.

## How it uses the trade site

Each check sends one trade search for the listings of your account without a price, newest first, and then reads only
the items it has not read before, 10 at a time. The trade site allows 600 searches in 3 hours from one IP address,
for your price checks, the trade website and these checks together, and an address that sends more gets only rate
limit errors for up to an hour. So Kalandra checks the tab only:

- while **Price a stash tab in the background** is on and the account name is set,
- once per **Check the tab every** interval, or when you click **Check now**,
- while the count of searches in the last 3 hours is below your **Search budget**,
- while the price check window is closed and none of your own searches waits for the rate limit.

The count is the trade site's count for your IP address, so your own price checks and the trade website fill it too.
The budget is where Kalandra stops its own searches, and the rest up to 600 stays for you: 200 with the default 400.
When you price check a lot, the count reaches the budget sooner, and the checks wait until it falls below the budget
again. A longer interval and a lower budget leave more searches for your price checks.

A search returns the newest 100 listings. When your account has more listings without a price, for example in other
public tabs, the widget says `Only the newest 100 of your N listings without a price are read`, and an item in the tab
that is older than those 100 is not found. Set a price on the items in your other public tabs to keep the count
under 100.

## How Kalandra prices the items

Kalandra prices the newest item first, and keeps each price while the item stays in the tab.

- An item that has a [price estimate](/price-check#price-estimate) in a price check, such as a unique, a currency
  stack or a gem, gets that estimate, for the whole stack, without a trade search.
- Every other item, such as a normal, magic, rare or unidentified item, gets one trade search with the filters a price
  check starts with, and the valuable stats of a rare turned on, as with the [suggested price](/suggested-price). Its
  price is the suggested price of the 20 cheapest listings, with its range and reliability, or **too few listings**.
- Kalandra cannot read some items from the trade site, such as an Expedition Logbook, and does not price an item that
  the trade site lists only for a bulk exchange when the price file has no price for it.

Kalandra sends at most one pricing search every 15 seconds, so 60 items that need a search take at least 15 minutes.
It prices the items only while the count of searches in the last 3 hours is below your **Search budget** less the
searches the checks of the tab need in 3 hours: 18 when it checks every 10 minutes, 36 every 5 minutes. A trade site
error, such as `Rate limit exceeded`, stops the pricing for one check interval, and the item is priced again after
the others.

| Line | What it means |
| --- | --- |
| Pricing waits for the league list. | Kalandra has not loaded the league list yet. |
| Pricing waits for the price file of the league. | The prices of the league are not loaded, as in a private league. |
| Pricing waits while the tab is read. | A check of the tab runs. Pricing tries again 30 seconds later. |
| Pricing paused while the price check is open. | It tries again every 30 seconds, and prices once the price check window is closed. |
| Pricing paused while your own price checks wait for the rate limit. | Your price checks go first. |
| Pricing paused: the searches of the last 3 hours reached the budget less the 18 kept for the checks of the tab. | It tries again after the check interval. |
| Pricing paused by the trade site's rate limit. | It tries again 30 seconds later. |
| Pricing Hunter Hood. | A search prices this item now. |
| Pricing failed: | The trade site's error after the colon. The [Debug](/settings#debug) log has the same message. |

## What it does not do yet

- It reads only the newest 100 listings of your account without a price, as
  [above](#how-it-uses-the-trade-site).
- It cannot read an Expedition Logbook or an item with mutated modifiers from the trade site, so these count as
  unreadable.
- With an app **Language** other than English, the items come from the trade site in the language of
  **Preferred trade site** on the General page. Keep it on the site for your language: from `www.pathofexile.com`
  the items come in English, and Kalandra cannot read them.
- The capture works only on Windows. Linux and macOS use the hotkey.
- Kalandra places the grid from screenshots of the game at 16:9, such as 1920 x 1080. At another aspect ratio, or
  when the grid is off, set the **Grid correction**.
- The text of the widget, the marks and the settings page is in English in every app language.

## Settings

**Price a stash tab in the background**, under **Show a suggested price (experimental)** on the **Price check** page,
turns stash prices on and adds the widget's button to the main button bar. It is off by default, and unchecking the
suggested price turns it off too. The **Stash prices** page of the Settings window, which the menu lists after
**Price check**, says whether it is on and holds the other settings:

| Setting | Default | What it changes |
| --- | --- | --- |
| **Stash tab name** | `kalandra-price-check` | The name of the tab to read, as the game shows it. |
| **Check the tab every** | 10 minutes | The time between two checks, at least 5 minutes. |
| **Search budget for 3 hours** | 400 | Kalandra checks the tab only while the count of searches from your IP address in the last 3 hours is below this number, from 0 to 600, and prices its items only below this number less the searches of the checks. 0 stops both. |
| **Find the open tab in the game window (Windows)** | On | Captures the game window to see when the stash shows the tab ([how](#how-kalandra-sees-the-open-tab)). |
| **Hotkey that marks the tab open or closed** | None | Marks the tab open or closed by hand. |
| **Grid correction** | 0 pixels | Moves the grid that Kalandra reads: its left edge, its top edge and the width of a cell, in pixels of the game window or in percent of its height. |
| **Grid alignment view** | Off | Draws every cell of the grid over the game, to check the grid correction ([how](#how-kalandra-sees-the-open-tab)). |
| **Highlight** | Valuable and Trash | Marks valuable items with their price and trash items with a trash icon over the open tab ([marks](#the-marks-over-the-stash)). |
| **Trash threshold** | 1 Chaos Orb | An item whose whole stack is worth less than this is trash. |
