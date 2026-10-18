---
title: Map check
---

Map check is a window that lists the modifiers of a Waystone and colours the ones you marked. It shows at once
whether a Waystone has a modifier you want to avoid or one you look for.

## Open it

Set a key in Settings, **Hotkeys** page, **Map check**. It has no key by default. **Map check** and **Item info** on
that page set the same key. Point at a Waystone that is not unique and press the key. The same key opens Map check for
an Expedition Logbook. Any other item opens [Item info](/item-info).

![Map check of a Waystone](/reference-images/MapCheck.png)

## The window

The title line shows the item's base type and the **Profile** buttons **I**, **II** and **III**. Each profile keeps its own
marks, so you can keep one set of marks per character. The current profile has a border.

Each modifier of the item is a row. Click a row to mark that modifier. Each click moves to the next mark:

1. danger: red, with a skull,
2. warning: orange, with a triangle,
3. good: green, with a check mark,
4. no mark, and the modifier counts as seen.

A mark belongs to the modifier text without its numbers, so it shows on every Waystone you check after that, in the
same profile. Kalandra saves the marks you set in this window when the window closes.

Other lines the window can show:

- **Not recognized modifier** and the text: a modifier that Kalandra cannot match to its game data.
- **Item has no modifiers.**
- **Wording of some stats has been changed.** and the rest of that message: the current profile has a mark for a
  modifier text that is not in the game data. Delete those marks in the settings to hide the message.

With **Show icon for new mods** on, a crossed eye icon shows at the end of each row that has no mark and is not
seen. Click the icon to mark the modifier as seen, which hides the icon. Click the same place again to undo it.

## Default marks

The default marks are English modifier text in profile **I**. `#% maximum Player Resistances` is a warning.
`Monsters reflect #% of Physical Damage` and `Monsters reflect #% of Elemental Damage` are danger, and
`Area contains two Unique Bosses` is good. Those last three are not in the game data of this version. While profile
**I** is selected, the settings list shows them as **outdated** and the window shows the wording message until you
delete them. Profiles **II** and **III** start with no marks.

## Settings

Settings, **Map check** page, lists every Waystone modifier in the game data, one row each. It edits the marks of the
current profile, which is the profile last selected in the Map check window. Changes apply when you click **Save**.

- **Search...** shows only the rows that contain every word you type.
- **Only selected** shows only the modifiers marked in the current profile.
- **Show icon for new mods** adds the crossed eye icon described above. It is off by default.
- **Stat (found: N)** heads the list, where N is the number of rows shown. Rows marked **outdated** come first.
- The three columns set the warning (orange triangle), danger (red skull) and good (green check) mark. On a row with
  no mark they show when you point at the row.
- The x button on a marked row removes its mark. In this version it also removes the marks of that modifier in the
  profiles after the current one. To remove a mark from one profile only, click the modifier in the Map check window
  until it has no mark.
- On an **outdated** row, the red trash button deletes the mark.
