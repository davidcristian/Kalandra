---
title: Nothing happens
---

When you press the price check hotkey (`Ctrl + D` by default), Kalandra does three things:

1. It presses the game's copy keys, so the game copies the item under the mouse cursor to the clipboard as text.
2. It waits up to about half a second for item text to appear in the clipboard.
3. It opens the price check window for that item.

Nothing happens when one of these steps fails. Kalandra's hotkeys work only while the game window is the active
window: Kalandra registers them when the game window becomes active and removes them when another window does.

## Kalandra does not find the game

When Kalandra finds the game window, it shows a notification with the text "Is ready and running in background". If
it never appears:

- Check **PoE window title** on the **General** settings page. It must match the title of the game window, which is
  `Path of Exile 2` by default. A change takes effect after Kalandra restarts.
- If the game runs with administrator rights, Kalandra cannot reach its window and shows a message titled
  `PoE2 window - No access`. Quit Kalandra and start it as administrator.
- The notification itself is the setting **Show a notification when the Overlay detects a PoE window** in the
  **General** page. It is on by default.

## Read the logs

Open the logs as [Where can I find the logs?](/faq#where-can-i-find-the-logs) describes. Each line starts with the
time. These lines name a problem and its fix:

- `error [Shortcuts] Failed to register a shortcut "<keys>". It is already registered by another application.`

  Another program uses this key combination. Choose another hotkey on the **Hotkeys** settings page, or change the
  shortcut in the other program. When `<keys>` are the copy keys, such as `Ctrl + Alt + C`, read
  [Another program takes the copy keys](#another-program-takes-the-copy-keys).

- `error [Shortcuts] Hotkey "<keys>" reserved by the game will not be registered.`

  Kalandra presses this key combination in the game to do its work, for example `Ctrl + C` to copy an item, so it
  cannot be a hotkey. Choose another hotkey.

- `error [Shortcuts] It is not possible to use the same hotkey "<keys>" for multiple actions.`

  Two actions have the same hotkey. Give each action its own hotkey. The settings window outlines both hotkey fields
  in red.

- `error [Shortcuts] Hotkey "<keys>" has an unknown key name and will not be registered.`

  The hotkey in `config.json` names a key that Kalandra does not know, for example after the file was edited by
  hand. Kalandra still registers the other hotkeys. Choose this hotkey again in the settings.

- `error [GameConfig] Failed to find game configuration file in the default location.`

  Kalandra cannot find the game's config file, so it does not know the game's advanced item descriptions key. Read
  [No item text found](#no-item-text-found). The other lines that start with `error [GameConfig]` are explained in
  [Causes](/no-item-mods#causes) on the No stats to select page.

- `error [Overlay] PoE2 is running with administrator rights`

  Start Kalandra as administrator.

- `warn [ClipboardPoller] No item text found.`

  Read the next section.

## No item text found

```
warn [ClipboardPoller] No item text found.
```

This line means that Kalandra pressed the copy keys, but no item text reached the clipboard in time.

Kalandra copies an item with the game's advanced copy: it presses `Ctrl`, the game's advanced item descriptions key
and `C`. The advanced item descriptions key is the key bound to **Show Advanced Item Descriptions** in the game's key
bindings. Kalandra reads that key from the game's config file `poe2_production_Config.ini`, which is in
`Documents\My Games\Path of Exile 2` on Windows. When Kalandra cannot read the file or the key, it uses `Alt`, so the
copy keys are `Ctrl + Alt + C` by default. Kalandra reads the file when it starts, so restart Kalandra after you change
the key in the game. If the file is in another folder, set its path in **PoE config file** on the **General** settings
page.

Test the copy yourself. In the game, hover over an item and press `Ctrl + Alt + C`, with your advanced item
descriptions key in place of `Alt`. Paste the clipboard into a text editor. In English the text starts with
`Item Class:`, and each modifier has its own line in braces, like this:

```
{ Prefix Modifier "Crackling" (Tier: 7) — Damage, Elemental, Lightning, Attack }
Adds 1(1-4) to 50(46-66) Lightning Damage
```

If the paste shows the item with these lines, the game copies correctly and the problem is elsewhere: read the other
log lines. If the paste shows the item without the lines in braces, read
[No stats to select](/no-item-mods). If the paste shows nothing new, the game did not copy the item:
read the next section.

## Another program takes the copy keys

Many programs use `Ctrl + Alt + C` as a global shortcut. When one of them has it, the game does not receive the key
press and copies nothing. The log shows `Failed to register a shortcut "Ctrl + Alt + C"` only for a program that
registers the shortcut with the operating system. A program that reads the keyboard directly leaves no line in the
log.

Close programs one at a time until the copy works, then change that program's shortcut. Players have reported these
programs:

- ASUS GPU Tweak II
- Radeon™ Software
- Display Pilot (BenQ)
- AutoHotkey (AHK) scripts
- Discord, with its clip shortcut

You can also bind the advanced item descriptions key in the game to another key. Kalandra then presses `Ctrl`, that
key and `C` after it restarts.

## What a working price check logs

Turn on **Record all key presses** on the **Debug** settings page and price check an item with the default keys. The
log then shows lines like these, with your own times:

```
[10:31:23 AM] debug [Shortcuts] Keydown Ctrl
[10:31:23 AM] debug [Shortcuts] Keydown Ctrl + D
[10:31:23 AM] debug [Shortcuts] Action type: copy-item
[10:31:23 AM] debug [Shortcuts] Keyup D
[10:31:23 AM] debug [Shortcuts] Keydown Alt
[10:31:23 AM] debug [Shortcuts] Keydown Ctrl + Alt + C
[10:31:23 AM] debug [Shortcuts] Keyup C
[10:31:23 AM] debug [Shortcuts] Keyup Alt
[10:31:23 AM] debug [Shortcuts] Keyup D
[10:31:23 AM] debug [Shortcuts] Keyup Ctrl
```

The `Action type: copy-item` line shows that the hotkey reached Kalandra. The five lines after it are the keys
Kalandra presses: it releases `D`, then presses `Alt` and `C` while you hold `Ctrl`. The last two lines are you
releasing `D` and `Ctrl`. If the `Action type` line is missing, the hotkey did not reach Kalandra: check the sections
above. If a `warn [ClipboardPoller] No item text found.` line follows, the game did not copy the item.
