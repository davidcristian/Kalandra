---
title: FAQ
---

## Settings and logs

### Where can I change the settings and the league?

In Path of Exile 2, press the overlay key (`Shift + Space` by default) and click the cog icon. The league is on the
**Price check** page. A click on the title bar of the price check window opens that page directly.
[Settings](/settings) describes every page.

![The main button bar of the overlay, with the cog icon at its left end](/reference-images/overlay-keybind.png)

### Where can I find the logs?

On the **Debug** page of the settings. Kalandra keeps the last 1000 lines of the log in memory only, so the log starts
empty each time Kalandra starts. Reproduce the problem, then copy the log before you quit Kalandra. Turn on **Record all key presses**
on the same page to log each key you press while the game window is active and the action each hotkey starts.
[Settings](/settings#debug) describes the **Debug** page.

When the overlay stays empty, open Kalandra in your browser with the tray menu item **Open in Browser** and read the
**Debug** page there. Kalandra logs an overlay page that failed to load or stopped, and reloads a stopped overlay page
up to 3 times while it runs.

When the page cannot start, for example because one of its data files is missing, the overlay stays empty and the
page that **Open in Browser** opens shows a box that starts with **Kalandra cannot start** and names the reason.
Restart Kalandra. If the box shows again, install the latest version over the current one, which keeps your
settings. If that does not help, [open an issue](https://github.com/davidcristian/Kalandra/issues) with the text of
the box.

### Where is the settings file?

On Windows it is `%APPDATA%\kalandra\apt-data\config.json`. The tray menu item **Open config folder** opens its
folder. [Where Kalandra keeps your settings](/download#where-kalandra-keeps-your-settings) describes this folder and
the other files in it.

## Safety and sources

### Is Kalandra approved by Grinding Gear Games? Can I get banned for using it?

Grinding Gear Games, the developer of Path of Exile 2, does not approve community tools. Kalandra does not read or
change the game's memory and does not change the game's files. It reads the item text that the game copies to the
clipboard. With **Allow reading of Client.txt file** on, it also reads the game's log file. When you press the
[OCR](/ocr-guide) key, it reads a screenshot of the game window.

Kalandra sends key presses to the game only after you press a key, click or turn the mouse wheel. For example, it
presses `Ctrl + Alt + C` to copy an item when you press the price check hotkey, and an arrow key for each mouse wheel
step when stash tab scrolling is on. Read the [terms of use](https://www.pathofexile.com/legal/terms-of-use-and-privacy-policy)
to decide.

If your account is banned, contact [Path of Exile support](https://www.pathofexile.com/support).

### Which websites are official?

The official site is <https://davidcristian.github.io/Kalandra/> and the official repository is
<https://github.com/davidcristian/Kalandra>. Download Kalandra only from the [Download](/download) page or the
[releases page on GitHub](https://github.com/davidcristian/Kalandra/releases). A copy from anywhere else can contain
harmful code.

### Where do prices come from?

The price estimate comes from Kalandra's own price service at `kalandra.ashoal.com`. Once an hour, the service reads
poe.ninja's economy data and builds one price file per league. Kalandra downloads that file and never contacts
poe.ninja itself, so an estimate can be more than an hour old. The price check shows "Getting price from poe.ninja …"
before the estimate appears, because the numbers are poe.ninja's. [Price check](/price-check) describes the estimate
and lists when none shows.

## Price check

### Do private leagues work?

Yes. Type the league's name into the **or Private League** field on the **Price check** settings page, in the form
the trade site uses, such as `My League (PL12345)`. Then sign in to the trade site in the built-in browser, as
[Private leagues](/private-leagues) shows. A private league has trade results but no price estimate.

### What does the colored dot next to the listing time mean?

It shows the seller's status: pink is online, orange is away and red is offline.
[Price check](/price-check#trade-results) lists every mark in the results.

### What does the question mark next to the price mean?

The price comes from the name of the seller's stash tab, not from a note on this item.
[Price check](/price-check#trade-results) lists every mark in the results.

### Why can Kalandra not check an item in some places of the game?

Kalandra reads only the item text that the game copies to the clipboard, as [Quick start](/quick-start#how-it-works)
describes. When the game copies no text for an item, Kalandra has nothing to check. To test whether the game copies
the item, follow [No item text found](/nothing-happens#no-item-text-found).

### Why does a sound play when I price check an item?

Discord's clip shortcut reacts to the keys Kalandra presses to copy an item: `Ctrl`, the game's advanced item
descriptions key (`Alt` by default) and `C`. In Discord, change the clip shortcut to keys that do not include
`Alt + C`.

## Game and language

### Can I switch stash tabs with Ctrl and the mouse wheel without zooming the camera?

Yes. Turn off **Mousewheel Zoom** in the game's options, in the **UI** tab. The **Stash tab scrolling** row in
[Settings](/settings#hotkeys) describes how Kalandra switches stash tabs on `Ctrl + MouseWheel`.

![The Mousewheel Zoom option in the game's options](/reference-images/mousewheel-zoom.png)

The camera zoom key bindings still work:

![The game's key bindings Zoom the camera in, Control and Page Up, and Zoom the camera out, Control and Page Down](/reference-images/zoom-keybinds.png)

### Will my language be supported?

Kalandra reads item text in the game languages listed in [Requirements](/download#requirements) on the Download
page. Its **Language** setting must match the game's language. Another game language needs Kalandra's game data for
that language before Kalandra can read its items. A translation of the interface alone is not enough.

The interface text of each language is in
[`renderer/public/data`](https://github.com/davidcristian/Kalandra/tree/master/renderer/public/data), one
`app_i18n.json` per language. Text missing from a language shows in English.

### Why does the price check show another item with the same name?

In some game languages, the game gives two items the same name. Kalandra picks a unique by its base type
and a base type by the defences the item shows: armour, evasion and energy shield. When those match too, it takes
the first of the two in its data, which can be the wrong one. Check the item the price check shows before you use
its prices.

### Why does a stat filter search for another modifier?

In some game languages, Kalandra's game data gives two stats the same text, such as two Sanctum relic stats in
Spanish. Kalandra picks the stat that the trade site has for the kind of modifier, such as a rune modifier. When both
stats fit, it takes the first of the two in its data, which can be the wrong one. Check that the listings the search
finds have the modifier your item has.

## Updates and downloads

### How do I turn off automatic updates?

Start Kalandra with the `--no-updates` flag ([Command-line options](/cmd-flags)). Kalandra then still checks for
updates and shows when one is available, but does not download it. [Updates](/download#updates) describes how each
version of Kalandra updates.

### I downloaded a zip with many files but no .exe inside

That zip is the source code. Download Kalandra from the [Download](/download) page instead.

All pages of this site are listed on the [home page](/).
