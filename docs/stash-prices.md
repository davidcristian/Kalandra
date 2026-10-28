---
title: Stash prices
---

Stash prices reads one public stash tab of yours from the official trade site while Kalandra runs, lists the items in
it that have no price, and prices each of them as a [price check](/price-check) would. You put items into that tab,
and Kalandra finds and prices them there without a key press. Its widget shows what it read and priced, when it
searches next and how many trade searches it may still use. It is off until you turn it on.

## Set up the tab

1. In Path of Exile 2, make a premium stash tab public and name it `kalandra-price-check`, or the name you set in
   **Stash tab name**.
2. Put the items in it without a price: set no price on the tab and none on the items. Kalandra reads only listings
   without a price.
3. Press the overlay key (`Shift + Space` by default), click the cog icon to open the Settings window, and enter your
   **Account name** with its number, such as `Name#1234`, on the **Price check** page.
4. On the **Stash prices** page, check **Read the tab in the background** and click **Save**.

The trade site lists an item some time after it reaches a public tab, so an item can first appear at a later check.

## The widget

Click the tags icon in the main button bar to show the widget. The button is there only while **Read the tab in the
background** is on. The widget shows:

- **Stash tab**: the name of the tab it reads.
- **Items in the tab**: the items without a price that the last check found in the tab.
- **Last check** and **Next check**: the time of the last check and of the next one.
- **Searches in the last 3 hours**: the trade searches that the trade site counted from your IP address in the last 3
  hours, of your **Search budget**. It shows `?` until the trade site has answered the first trade search since
  Kalandra started, a price check search included.
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
| Off. Turn it on in the settings. | **Read the tab in the background** is off. |
| Set your account name on the Price check page of the settings. | The **Account name** on the Price check page is empty. |
| Waiting for the league list. | Kalandra has not loaded the league list from the trade site yet. It tries again every 30 seconds. |
| Paused while the price check is open. | It checks 30 seconds after the price check window closes. |
| Paused while your own price checks wait for the rate limit. | Your price checks go first. It tries again 30 seconds later. |
| Paused: the searches of the last 3 hours reached the budget. | It tries again after the interval. |
| Paused by the trade site's rate limit. | The rate limit holds the next search, for example after a `Rate limit exceeded` error. It tries again 30 seconds later. |
| Reading the tab. | A check runs. |
| The tab is read. | The last check worked. |
| The trade site failed: | The last check ended with the trade site's error after the colon. It checks again after the interval, and the [Debug](/settings#debug) log has the same message. |

## How it uses the trade site

Each check sends one trade search for the listings of your account without a price, newest first, and then reads only
the items it has not read before, 10 at a time. The trade site allows 600 searches in 3 hours from one IP address,
for your price checks, the trade website and these checks together, and an address that sends more gets only rate
limit errors for up to an hour. So Kalandra checks the tab only:

- while **Read the tab in the background** is on and the account name is set,
- once per **Check the tab every** interval, or when you click **Check now**,
- while the count of searches in the last 3 hours is below your **Search budget**,
- while the price check window is closed and none of your own searches waits for the rate limit.

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
error, such as `Rate limit exceeded`, stops the pricing until the next check interval, and the item is priced again
after the others.

| Line | What it means |
| --- | --- |
| Pricing waits for the league list. | Kalandra has not loaded the league list yet. |
| Pricing waits for the price file of the league. | The prices of the league are not loaded, as in a private league. |
| Pricing waits while the tab is read. | A check of the tab runs. Pricing tries again 30 seconds later. |
| Pricing paused while the price check is open. | It tries again 30 seconds after the price check window closes. |
| Pricing paused while your own price checks wait for the rate limit. | Your price checks go first. |
| Pricing paused: the searches of the last 3 hours reached the budget less the 18 kept for the checks of the tab. | It tries again after the check interval. |
| Pricing paused by the trade site's rate limit. | It tries again 30 seconds later. |
| Pricing failed: | The trade site's error after the colon. The [Debug](/settings#debug) log has the same message. |

## Settings

The **Stash prices** page of the Settings window, which is also in the menu of the whole window under **Price
check**:

| Setting | Default | What it changes |
| --- | --- | --- |
| **Read the tab in the background** | Off | Turns the checks on, and adds the widget's button to the main button bar. |
| **Stash tab name** | `kalandra-price-check` | The name of the tab to read, as the game shows it. |
| **Check the tab every** | 10 minutes | The time between two checks, at least 5 minutes. |
| **Search budget for 3 hours** | 400 | Kalandra checks the tab only while the count of searches from your IP address in the last 3 hours is below this number, from 0 to 600, and prices its items only below this number less the searches of the checks. 0 stops both. |
