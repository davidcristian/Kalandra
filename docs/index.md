---
title: Kalandra
---

Kalandra is an overlay for Path of Exile 2: an app that shows its own windows on top of the game. Hover an item in the
game and press `Ctrl + D`: Kalandra builds a search for the official trade site from the item's stats and lists the
matching items with their prices. Its widgets also check waystone mods, search your stash, track experience and more.

Kalandra continues [Exiled Exchange 2](https://github.com/Kvan7/Exiled-Exchange-2) by Kvan7, which is a fork of
[Awakened PoE Trade](https://github.com/SnosMe/awakened-poe-trade) by SnosMe.

![The Kalandra price check window for a rare pair of boots, next to the game's inventory](/reference-images/RareCheck.png){:.rounded}

## Start here

1. [Download](/download): install Kalandra.
2. [Quick start](/quick-start): the default hotkeys and your first price check.
3. [Features](/features): what else Kalandra does.
4. [FAQ](/faq) and [Common issues](/issues): what to try when something does not work.

Download Kalandra only from the [Download](/download) page or the
[GitHub releases](https://github.com/davidcristian/Kalandra/releases). To report a bug or ask a question, open an
issue on [GitHub](https://github.com/davidcristian/Kalandra/issues).

## All pages

### Get started

- [Download](/download): the download links, the game settings Kalandra needs, and how to move your settings from Exiled
  Exchange 2 or Awakened PoE Trade.
- [Quick start](/quick-start): the terms these pages use, how Kalandra reads an item, the default hotkeys and how to
  read the price check window.
- [Features](/features): one short section per feature, each with a link to its page.

### Price check

- [Price check](/price-check): the price check window, its filters and trade search, and where its price estimates come
  from.
- [Item info](/item-info): a summary of an item, such as weapon DPS, with buttons that open it on the wiki, PoEDB or
  Craft of Exile.
- [Map check](/map-check): marks the waystone mods you set as dangerous, warning or good.
- [Private leagues](/private-leagues): price checking in a private league through the built-in browser.

### Widgets

- [Widgets](/widgets): the main button bar of the overlay, and how to move, edit, hide and delete widgets.
- [Stash search](/stash-search): saved search texts that Kalandra types into the game's search box.
- [XP tracker](/xp-tracker): a widget that shows your level, your experience multiplier in the current area and how
  far you are from the level penalty.
- [Extra widgets](/extra-widgets): the Image strip, Stopwatch, Notepad and Item search widgets and the Delve grid.
- [Chat commands](/chat-commands): send a chat command, such as `/hideout`, with one key.
- [OCR guide](/ocr-guide): set up OCR (text recognition) on Windows, which reads Heist gem names from the screen into
  the Item search widget.
- [Item data](/item-data): an experimental widget that records crafting results to a CSV file.
- [Client log file](/client-log-parser): the format of `client-log.ndjson`, the file in which Kalandra stores the
  entries it reads from the game's log file.

### Settings

- [Settings](/settings): every page of the Settings window, such as Hotkeys, General and Debug, and the tray menu.
- [Command-line options](/cmd-flags): options that change how Kalandra starts, such as `--no-overlay`.

### Problems

- [Common issues](/issues): steps to try, in order, when Kalandra does not work.
- [FAQ](/faq): short answers, such as where to find the settings and the logs.
- [Nothing happens](/nothing-happens): what to do when the price check hotkey opens nothing.
- [No stats to select](/no-item-mods): what to do when the price check window shows no mods.
- [Query is too complex](/complex-query): what to do when the trade site rejects a search as too complex.
- [Failed to load leagues](/failed-load-leagues): what to do when Kalandra cannot load the league list.
- [Invalid JSON](/invalid-json): what the error about a web page instead of data, which older versions call invalid
  JSON, means and what to check before reporting it.
