---
title: Settings
---

The settings window holds Kalandra's options. To open it, press the overlay key in Path of Exile 2 (`Shift + Space`
by default) and click the cog icon in the main button bar, the row of icons that the overlay shows for opening
its widgets. Click **Save** at the bottom of the window to apply your changes,
or **Cancel** to close the window without them. Kalandra stores the settings in `config.json`
([where it is](/download#where-kalandra-keeps-your-settings)).

The menu on the left lists the pages in this order: Hotkeys, Chat, General, Price check, Map check, Item info,
Leveling, Help, Debug and About. The **Quit** button under the menu closes Kalandra.

A bar under the window scrolls the names of Awakened PoE Trade's patrons, as thanks to the project that Kalandra is
built on. Move the mouse over the bar to see all the names at once.

## Hotkeys

A hotkey works only while the Path of Exile 2 window is active, so Kalandra does not take keys from other programs.
To set a hotkey, click its field and press the keys. Press Backspace in a hotkey field to clear it. **Overlay** is
marked with `*` because it is required, and it cannot be cleared. A cleared hotkey shows "Not Set". A hotkey field
does not accept a key combination that contains `F12`.

| Label | Default | What it does |
| --- | --- | --- |
| **Price check**: **Auto-hide Mode** | `Ctrl + D` | Opens the price check window for the item under the cursor. The window closes when you move the mouse away: [Price check](/price-check#start-a-price-check) explains how to keep it open. The hotkey is `Ctrl` or `Alt` plus one key. |
| **Price check**: **Open without auto-hide** | `Ctrl + Alt + D` | Opens the price check window and keeps it open until you close it. |
| **Overlay** | `Shift + Space` | Switches between the game and the overlay with its widgets. `Escape` also returns to the game. |
| **Map check** | Not Set | Opens Map check for a Waystone that is not unique and for the other items that [Map check](/map-check) lists, and Item info for any other item. |
| **Item info** | Not Set | The same key as **Map check**: changing one changes both. |
| **Grid for Delve Chart** | Not Set | Shows or hides a grid of 11 by 9 squares, centered horizontally near the top of the game window. [Extra widgets](/extra-widgets#delve-grid) documents it. |
| **Stash tab scrolling** | Ctrl + MouseWheel | While you hold `Ctrl` and the cursor is not over the stash grid, Kalandra presses the Right or Left arrow key for each step of the mouse wheel, which switches stash tabs. Turn off **Mousewheel Zoom** in the game's options (Options, UI) to use it. **Disabled** turns off Kalandra's stash tab scrolling. |

Kalandra does not register a key that the game uses: `Ctrl + C`, `Ctrl + V`, `Ctrl + A`, `Ctrl + F`,
`Ctrl + Enter`, `Home`, `Delete`, `Enter`, `ArrowUp`, `ArrowRight`, `ArrowLeft`, and `Ctrl + C` together with the
game's advanced item descriptions key (`Ctrl + Alt + C` with the game's default `Alt`). When two actions use the
same key, Kalandra registers neither of them, except the **Overlay** key. The settings window shows such a key in
red with a red outline, in the field of each action that uses it on any page, and the field's tooltip says that
another action uses the key. When another program already uses a key, Kalandra cannot register it. In each case
Kalandra writes an error to the [Debug](#debug) log.

More hotkeys are set on the Chat and Item info pages and in the settings of the Stash search, Stopwatch, Item search
and Library widgets.

## Chat

This page lists the chat commands that Kalandra types into the game chat, each with an optional hotkey.
[Chat commands](/chat-commands) documents this page.

## General

| Label | Default | What it changes |
| --- | --- | --- |
| **Language** | English | The language of Kalandra's text, including times such as "5 min. ago" on listings, and of the item text it reads. Set the language of your game: when they differ, a price check shows "POE2 language doesn't match Kalandra". The settings window switches to the new language when you pick it, and **Cancel** switches it back. |
| **Preferred trade site** | The site for the language | Shown when **Language** is not English. Chooses between the trade site for your language, such as `ru.pathofexile.com`, and `www.pathofexile.com`. |
| **Realm** | International | Shown when **Language** is 正體中文 (Traditional Chinese). The other choice, **Hotcool**, is the Taiwan realm, whose trade site is `pathofexile.tw`. |
| **Font size** | 16 px | The base text size of the overlay, from 10 to 40 px. A number outside that range is stored as the nearest limit, and text that is not a number leaves the size unchanged. |
| **Restore clipboard** | Off | When on, Kalandra puts back the text that was on the clipboard before it copied an item or ran a stash search. When that text was item text, such as an item you copied yourself, a key that copies an item leaves the clipboard empty instead. After a stash search, it puts the text back 120 ms after it presses the keys, and a game that takes longer to paste, for example while it stalls, pastes your previous text into the search box instead. After a [chat command](/chat-commands#how-kalandra-types-a-command), the clipboard keeps the command text even with this on, because a game that stalls would paste your previous text and send it to chat. |
| **PoE log file** | Empty | The path of the game's log file, `Client.txt`. When empty, Kalandra looks in the default install folders. |
| **PoE config file** | Empty | The path of the game's `poe2_production_Config.ini`, which Kalandra reads to learn the game's advanced item descriptions key. When empty, Kalandra looks in the default folder. |
| **Background when the Overlay is clickable** | `rgba(129, 139, 149, 0.15)` | The color behind the widgets while the overlay is active, as a CSS color. **Transparent** removes it. |
| **Clicking on the background focuses the game** | On | Shown when the background is not transparent. A click on the background returns to the game. |
| **Show a notification when the Overlay detects a PoE window** | On | Shows "Is ready and running in background" for a few seconds when Kalandra finds the game window. |
| **Always fully close the overlay instead of hiding it** | Off | When on, closing the price check window or clicking the background always returns to the game. When off, closing the price check window while it shows the [built-in browser](/quick-start#terms) closes only that window. |
| **Fully hide overlay when it loses focus instead of making it transparent.** | Off | When on, Kalandra hides the overlay window while the game is active and no widget is shown. When off, the window stays over the game and draws nothing. On or off, the overlay window hides while another program is active. The hint under it says this can improve performance on some systems and can cause flickering. |
| **PoE window title** (Restart required) | `Path of Exile 2` | The title of the game window that Kalandra attaches the overlay to. A change takes effect after Kalandra restarts. |
| **Allow reading of Client.txt file** | Off | Lets Kalandra read the game's log file to detect area changes and level ups. The [XP tracker](/xp-tracker) and the [Client log file](/client-log-parser) need it. Turning it on adds the XP tracker to the main button bar. Turning it off hides the XP tracker and removes it from the menu. |
| **Enable experimental features** | Off | Shows the **Item Data Collection** checkbox. Checking it adds the Library widget, which writes items to a CSV file, to the main button bar. [Item data](/item-data) documents it. |

When **PoE log file** or **PoE config file** is empty, Kalandra looks for the file in these folders:

- **Windows.** `Client.txt` in `C:\Program Files (x86)\Grinding Gear Games\Path of Exile 2\logs\` or
  `C:\Program Files (x86)\Steam\steamapps\common\Path of Exile 2\logs\`. The config file in
  `Documents\My Games\Path of Exile 2\`.
- **Linux.** `Client.txt` in `~/.wine/drive_c/Program Files (x86)/Grinding Gear Games/Path of Exile 2/logs/` or
  `~/.local/share/Steam/steamapps/common/Path of Exile 2/logs/`. The config file in
  `~/Documents/My Games/Path of Exile 2/` or in the same folder inside the game's Proton prefix,
  `~/.local/share/Steam/steamapps/compatdata/2694490/pfx/drive_c/users/steamuser/Documents/My Games/Path of Exile 2/`.
  Proton is the Steam tool that runs Windows games on Linux.
- **macOS.** `Client.txt` in `~/Library/Caches/com.GGG.PathOfExile/Logs/`. The config file in
  `~/Library/Application Support/Path of Exile 2/Preferences/`.

When a file exists in two of these folders, Kalandra uses neither and writes an error to the Debug log. Enter the
path of the one you play.

## Price check

This page sets the league, your account name, how stat filters are filled, how prices are shown, the built-in
browser and the timing of price checks. [Price check](/price-check#settings) documents this page.

## Map check

This page sets which map mods Map check marks with a warning, danger or good icon. It keeps the choices in profiles.
[Map check](/map-check#settings) documents this page.

## Item info

This page sets the hotkeys that open the item on the wiki, PoEDB or Craft of Exile, find it in the stash, and search
for items with the same price. [Item info](/item-info#settings) documents this page.

## Leveling

This page repeats the two Client.txt options from General and adds **Show experience gain percentage** for the XP
tracker widget. [XP tracker](/xp-tracker) documents this page.

## Help

| Label | Default | What it changes |
| --- | --- | --- |
| **How often to show tips when price checking** | Normal | How often the price check window shows a tip: **Always** for every item; **Often**, **Normal**, **Rarely** and **Very Rarely** about once every 7, 20, 50 and 100 items; **Never** not at all. |

Under **Cycle Through All Tips:**, the arrow buttons show each tip in turn.

## Debug

The page shows the last 1000 lines of Kalandra's log. Errors appear there, such as a hotkey that Kalandra could not
register or a game file it did not find. Add the log when you
[report a problem on GitHub](https://github.com/davidcristian/Kalandra/issues).

| Label | Default | What it changes |
| --- | --- | --- |
| **Record all key presses** | Off | When on, Kalandra writes each key press and release to the log while the game window is active, and the action of each hotkey it runs. It records no key while the overlay or another program is active. It does record the text you type in the game's chat, so read the log before you post it. While the overlay is not active, the last lines of the log show over the game. Use it to check which keys reach Kalandra. |

## About

The page shows the version of Kalandra and two links: **Release notes** opens the
[releases page](https://github.com/davidcristian/Kalandra/releases), and **Report a bug on GitHub** opens the
[issues page](https://github.com/davidcristian/Kalandra/issues). Below them is the update status:

- "Last checked: never" before the first check, or "You have the latest version" and the time of the last check,
  with **Check now**.
- "Checking for updates" while Kalandra checks.
- "Update available" with the version number, and "Downloading…" while the installer or the AppImage downloads the
  update.
- "It will be installed automatically on exit" once the download is done, with **Install now**.
- "You can download it from GitHub" or "You have disabled automatic updates download" when Kalandra does not
  download the update, with **Open the Downloads page**.
- "Error while checking for updates", with **Open the Downloads page**. The [Debug](#debug) log names the error.

[Updates](/download#updates) explains which downloads update themselves. The two links at the bottom of the page open
the Path of Exile 2 subreddit and the pathofexile Discord server. They are not Kalandra support.

## Settings of one widget

The **edit** button of these widgets opens the settings window with only that widget's page:

- **Stash search**: the widget title, the searches and their hotkeys. [Stash search](/stash-search) documents it.
- **Stopwatch**: the **Start and Pause** and **Reset** hotkeys. [Extra widgets](/extra-widgets#stopwatch)
  documents it.
- **Item search**: the hotkey that reads skill gem names with OCR, which reads text from a screenshot.
  [Extra widgets](/extra-widgets#item-search) documents it.
- **Library**: the hotkey that logs an item, the output folder and which mods a recording keeps.
  [Item data](/item-data) documents it.
- **XP tracker**: the **Leveling** page, with **PoE log file**, **Allow reading of Client.txt file** and
  **Show experience gain percentage**. [XP tracker](/xp-tracker) documents it.

The **edit** button of the Map check and Item info window opens the **Item info** and **Map check** pages. A click on
the title of the price check window opens the **Price check** page.

## Tray menu

Right-click the Kalandra icon in the system tray (the menu bar on macOS) for these items:

| Item | What it does |
| --- | --- |
| **Settings/League** | Shows a message that tells you to open Path of Exile 2, press the overlay key and click the button with the cog icon. |
| **Open in Browser** | Opens Kalandra's page in your default web browser, at `http://localhost` and the port of Kalandra's local server, or at the single network address that `--listen` sets as its host. See [Command-line options](/cmd-flags). The price check then opens in that page until the overlay has the focus again, as [The price check opens in a browser page](/nothing-happens#the-price-check-opens-in-a-browser-page) explains. |
| **Open config folder** | Opens the `apt-data` folder that holds `config.json`. |
| **Quit** | Closes Kalandra. |
