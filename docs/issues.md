---
title: Common issues
---

Try these steps in order when Kalandra does not work. The sections after them cover specific problems.

## First steps

1. **Check the [requirements](/download#requirements).** The game must run in Windowed or Windowed Fullscreen mode,
   not Fullscreen, in a language Kalandra supports. Check the display mode again after a graphics driver update.
2. **Check that Kalandra finds the game.** When it does, Kalandra shows a notification with the text "Is ready and
   running in background". If it never appears, read
   [Kalandra does not find the game](/nothing-happens#kalandra-does-not-find-the-game).
3. **Read the logs**, as [Where can I find the logs?](/faq#where-can-i-find-the-logs) describes. Each line starts
   with the time. A line with `error` or `warn` after the time names the problem.
4. **Update the graphics drivers** if Kalandra works with the DirectX 11 or DirectX 12 renderer of the game but not
   with the Vulkan renderer.
5. **Close every program you can**, in the system tray and in Task Manager. Then start them again one at a time.
   When Kalandra stops working after a program starts, close that program or change its shortcuts so that it does
   not use the same keys as Kalandra.
   [Another program takes the copy keys](/nothing-happens#another-program-takes-the-copy-keys) lists programs that
   players have reported.
6. **Restart Kalandra.** Quit it first with **Quit** in the tray icon menu or in the settings. Starting Kalandra
   while it runs does nothing, because the second copy exits at once.
7. **Reset the settings.** Quit Kalandra, then delete the folder `%APPDATA%\kalandra`. This resets every setting. To
   keep a copy of your settings, first copy the `apt-data` folder inside it, which holds `config.json`. The tray menu
   item **Open config folder** opens `apt-data`.
8. **Report the problem** if none of this helps: [open an issue](https://github.com/davidcristian/Kalandra/issues)
   on GitHub. Include what you did and what happened, the Kalandra version from the **About** settings page and the
   lines from the **Debug** settings page. If the problem is about an item, also include its text: hover over the item
   in the game, press `Ctrl + Alt + C` and paste. If you bound the game's advanced item descriptions key to another
   key, press that key in place of `Alt`.

## Price check

- [No stats to select](/no-item-mods)
- [Nothing happens](/nothing-happens)
- [Failed to load leagues](/failed-load-leagues)
- [Query is too complex](/complex-query)
- [Invalid JSON](/invalid-json)

### A price check sends an old whisper to chat again

Turn off **Restore clipboard** on the **General** settings page. It is off by default. When it is on, Kalandra writes
the previous clipboard text back after each price check, unless that text was item text. If that text is a whisper
copied from the trade site, a trade tool that watches the clipboard for whispers sends it again.

## Overlay and tray

### A stopwatch or another widget stays on the screen

Open the overlay with the overlay key (`Shift + Space` by default), hover over the widget, then press and hold
**delete** for one second. [Delete](/widgets#delete) on the Widgets page describes it.

### The tray menu does not open while the game is active

On Windows, the tray menu of Kalandra can open behind the game window. This is a bug in Electron, the framework
Kalandra is built on. Open another window first, for example File Explorer with `Win + E`, then click the tray icon.
You do not need the tray for the settings: in the game, press the overlay key and click the cog icon.

## Linux

### The tray icon is not shown

Some desktop environments do not show the tray icons of Electron apps. Open the settings in the game with the overlay
key and the cog icon instead. **Quit** is also in the settings.

### The screen is black

The overlay is a transparent window that covers the game window, so it needs compositing: the desktop feature that
draws transparent windows. Turn on compositing in your desktop settings. On KDE Plasma, players fixed the black screen
by turning off **Allow applications to block compositing** in the compositor settings. More reports from players with
other desktops are in [an Awakened PoE Trade issue](https://github.com/SnosMe/awakened-poe-trade/issues/185).

### The overlay does not show under Wayland

Players report these fixes:

- Remove `PROTON_ENABLE_WAYLAND=1` from the game's launch options in Steam.
- Start Kalandra through XWayland, the part of Wayland that runs X11 programs: add the Electron switch
  `--ozone-platform=x11`, or set the environment variable `XDG_SESSION_TYPE=x11`.
- Start Kalandra with `--no-overlay` and use it in a browser.

[Command-line options](/cmd-flags) describes how to add a switch or an option.

More reports are in [an Exiled Exchange 2 issue](https://github.com/Kvan7/Exiled-Exchange-2/issues/673). Report
Kalandra problems in [Kalandra's issues](https://github.com/davidcristian/Kalandra/issues), not there.
