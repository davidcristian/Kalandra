---
title: Item data
---

Item Data Collection is an experimental feature that adds the Library widget. While a session runs, each press of the
**Log item to csv** key copies the item under the cursor and writes one row about it to a CSV (comma-separated
values) file. Use it to record what each use of a crafting currency changed on an item. The feature is off by
default.

While Item Data Collection is on and **Allow reading of Client.txt file** is checked, Kalandra also writes the
entries it reads from the game log to `client-log.ndjson`, in the same folder as the CSV files.
[Client log file](/client-log-parser) describes that file.

## Turn it on

1. Press `Shift + Space`, the default overlay key, to open the overlay. Click the cog icon to open the settings.
2. On the **General** page, check **Enable experimental features**, then check **Item Data Collection** below it.

   ![The Enable experimental features checkbox on the General settings page](/reference-images/expFeatures.png)

3. Click **Save**.

A book icon then appears in the main button bar, the row of icons that starts with the cog icon. Click it to show the
Library widget. Turning Item Data Collection off ends a running session.

![The main button bar with the book icon of the Library widget circled](/reference-images/libraryWidgetIcon.png)

## Settings

Hover the Library widget and click **edit** to open its settings page, named **Library**. Click **Save** after a
change.

![The hide, edit and move buttons that show when you hover a widget](/reference-images/editWidget.png)

- **Log item to csv**: the key that logs the item under the cursor. It has no default.
- **Output Folder**: the folder for the CSV files. When it is empty, Kalandra uses the `apt-data\csv-data` folder of
  its data folder, which is `%APPDATA%\kalandra\apt-data\csv-data` on Windows. Kalandra creates the folder when a
  session starts. A new folder applies from the next session: a running session keeps writing to its file in the
  folder it started in.
- **Recording settings**: the checkboxes **keep explicit mods**, **keep implicit mods**, **keep enchant mods** and
  **keep augment mods** choose which kinds of modifiers the modifier columns include. Only **keep explicit mods** is
  checked by default. It keeps prefixes, suffixes, and mutated, fractured, desecrated and crafted modifiers.

Choose a log key that includes `Shift`. Kalandra does not release `Shift` while it copies the item, so you can keep
holding `Shift` and apply the same currency again.

## Record a session

![Library widget with the session name mySession, the play button, Session Rolls 0 and None added](/reference-images/SingleItemRollingUI.png)

1. Type a session name in the text box. The name is also the file name: the default name `mySession` writes
   `mySession.csv`. You can change the name only while no session runs.
2. Click the play button to start a session. Kalandra creates the file with a header row, or adds rows to the end of
   the file if it already exists. While a session runs, the widget stays on screen when you close the overlay.
3. Hover the item in the game and press the **Log item to csv** key. Kalandra copies the item and writes one row.
   Press the key again after each use of a currency on the item.
4. Click the stop button to end the session. Kalandra closes the file and resets the count. The key writes nothing
   until you start a session again.

**Session Rolls** counts the items logged in this session. Below it, the widget lists the names of the prefixes and
suffixes that the last logged item gained, or None added. When Kalandra cannot read the copied item, the widget shows
the error in an orange box and writes no row.

## CSV format

Each file starts with this header row, and each logged item adds one row:

```csv
base,ilvl,rarity,sockets,mods,addedMods,removedMods
```

| Column | Content |
| --- | --- |
| `base` | English name of the item from Kalandra's game data: the base type, or the unique name of an identified unique item |
| `ilvl` | Item level, empty when the item has none |
| `rarity` | `Normal`, `Magic`, `Rare` or `Unique`, empty when the item has none |
| `sockets` | Number of augment sockets on the item, `0` when it has none |
| `mods` | The modifiers on the item, of the kinds checked in the Recording settings |
| `addedMods` | The prefixes and suffixes this item has that the item in the previous row did not. In the first row of a session, and in the row after an item Kalandra could not read, all of them |
| `removedMods` | The prefixes and suffixes the item in the previous row had that this item does not. Empty in the first row of a session and in the row after an item Kalandra could not read |

`addedMods` and `removedMods` also include only the kinds of modifiers checked in the Recording settings.

### Modifier cells

Each modifier column holds a JSON array of modifier objects, written with single quotes: Kalandra replaces each `"`
with `'` and writes each apostrophe in a value as `\'`. To read a cell as JSON, replace each `'` that has no
backslash before it with `"`, then replace each `\'` with `'`.

Each object has these keys, in this order. A key with no value for the modifier is left out.

| Key | Type | Content |
| --- | --- | --- |
| `name` | string | Modifier name from the copied item text, in the game language, such as `Collector's` |
| `tier` | number | Modifier tier from the copied item text |
| `roll` | number array | One rolled value per stat of the modifier, `-999` for a stat with no rolled value |
| `ref` | string array | English text of each stat, with `#` in place of each value |
| `type` | string | Kind of modifier, such as `explicit`, `implicit`, `crafted`, `fractured`, `desecrated`, `enchant` or `rune` (an augment) |
| `generation` | string | `prefix`, `suffix`, `mutated`, `corrupted` or `eldritch` |

## Example data

The rows in these samples have no `generation` key. A row that Kalandra writes has it after `type`, such as
`'type':'explicit','generation':'prefix'`.

This sample has eleven rows from one session on a Precursor Tablet:

```csv
base,ilvl,rarity,sockets,mods,addedMods,removedMods
Precursor Tablet,80,Rare,0,"[{'name':'Collector\'s','tier':1,'roll':[25],'ref':['#% increased Rarity of Items found in your Maps'],'type':'explicit'}]","[{'name':'Collector\'s','tier':1,'roll':[25],'ref':['#% increased Rarity of Items found in your Maps'],'type':'explicit'}]","[]"
Precursor Tablet,80,Rare,0,"[{'name':'Elevated','tier':1,'roll':[16],'ref':['#% increased Experience gain'],'type':'explicit'}]","[{'name':'Elevated','tier':1,'roll':[16],'ref':['#% increased Experience gain'],'type':'explicit'}]","[{'name':'Collector\'s','tier':1,'roll':[25],'ref':['#% increased Rarity of Items found in your Maps'],'type':'explicit'}]"
Precursor Tablet,80,Rare,0,"[{'name':'Bountiful','tier':1,'roll':[39],'ref':['#% increased Gold found in your Maps'],'type':'explicit'}]","[{'name':'Bountiful','tier':1,'roll':[39],'ref':['#% increased Gold found in your Maps'],'type':'explicit'}]","[{'name':'Elevated','tier':1,'roll':[16],'ref':['#% increased Experience gain'],'type':'explicit'}]"
Precursor Tablet,80,Rare,0,"[{'name':'Bountiful','tier':1,'roll':[33],'ref':['#% increased Gold found in your Maps'],'type':'explicit'}]","[{'name':'Bountiful','tier':1,'roll':[33],'ref':['#% increased Gold found in your Maps'],'type':'explicit'}]","[{'name':'Bountiful','tier':1,'roll':[39],'ref':['#% increased Gold found in your Maps'],'type':'explicit'}]"
Precursor Tablet,80,Rare,0,"[{'name':'of the Essence','tier':1,'roll':[92],'ref':['Your Maps have #% increased chance to contain Essences'],'type':'explicit'}]","[{'name':'of the Essence','tier':1,'roll':[92],'ref':['Your Maps have #% increased chance to contain Essences'],'type':'explicit'}]","[{'name':'Bountiful','tier':1,'roll':[33],'ref':['#% increased Gold found in your Maps'],'type':'explicit'}]"
Precursor Tablet,80,Rare,0,"[{'name':'Treasurer\'s','tier':1,'roll':[3],'ref':['Your Maps contain an additional Rare Chest'],'type':'explicit'}]","[{'name':'Treasurer\'s','tier':1,'roll':[3],'ref':['Your Maps contain an additional Rare Chest'],'type':'explicit'}]","[{'name':'of the Essence','tier':1,'roll':[92],'ref':['Your Maps have #% increased chance to contain Essences'],'type':'explicit'}]"
Precursor Tablet,80,Rare,0,"[{'name':'Collector\'s','tier':1,'roll':[26],'ref':['#% increased Rarity of Items found in your Maps'],'type':'explicit'}]","[{'name':'Collector\'s','tier':1,'roll':[26],'ref':['#% increased Rarity of Items found in your Maps'],'type':'explicit'}]","[{'name':'Treasurer\'s','tier':1,'roll':[3],'ref':['Your Maps contain an additional Rare Chest'],'type':'explicit'}]"
Precursor Tablet,80,Rare,0,"[{'name':'of the Cartographer','tier':1,'roll':[48],'ref':['#% increased Quantity of Waystones found in your Maps'],'type':'explicit'}]","[{'name':'of the Cartographer','tier':1,'roll':[48],'ref':['#% increased Quantity of Waystones found in your Maps'],'type':'explicit'}]","[{'name':'Collector\'s','tier':1,'roll':[26],'ref':['#% increased Rarity of Items found in your Maps'],'type':'explicit'}]"
Precursor Tablet,80,Rare,0,"[{'name':'of Undertaking','tier':1,'roll':[1],'ref':['Your Maps have # additional random Modifier'],'type':'explicit'}]","[{'name':'of Undertaking','tier':1,'roll':[1],'ref':['Your Maps have # additional random Modifier'],'type':'explicit'}]","[{'name':'of the Cartographer','tier':1,'roll':[48],'ref':['#% increased Quantity of Waystones found in your Maps'],'type':'explicit'}]"
Precursor Tablet,80,Rare,0,"[{'name':'Bountiful','tier':1,'roll':[35],'ref':['#% increased Gold found in your Maps'],'type':'explicit'}]","[{'name':'Bountiful','tier':1,'roll':[35],'ref':['#% increased Gold found in your Maps'],'type':'explicit'}]","[{'name':'of Undertaking','tier':1,'roll':[1],'ref':['Your Maps have # additional random Modifier'],'type':'explicit'}]"
Precursor Tablet,80,Rare,0,"[{'name':'Brimming','tier':1,'roll':[40],'ref':['#% increased number of Rare Monsters'],'type':'explicit'}]","[{'name':'Brimming','tier':1,'roll':[40],'ref':['#% increased number of Rare Monsters'],'type':'explicit'}]","[{'name':'Bountiful','tier':1,'roll':[35],'ref':['#% increased Gold found in your Maps'],'type':'explicit'}]"
```

This sample includes a row with no modifiers, rows where several modifiers changed at once, and an item logged again
with no change. It has no row where the logged item changes to a different item.

```csv
base,ilvl,rarity,sockets,mods,addedMods,removedMods
Precursor Tablet,80,Rare,0,"[{'name':'of Shrines','tier':1,'roll':[94],'ref':['Your Maps have #% increased chance to contain Shrines'],'type':'explicit'}]","[{'name':'of Shrines','tier':1,'roll':[94],'ref':['Your Maps have #% increased chance to contain Shrines'],'type':'explicit'}]","[]"
Precursor Tablet,80,Rare,0,"[{'name':'Challenger\'s','tier':1,'roll':[7],'ref':['#% increased Effectiveness of Monsters in your Maps'],'type':'explicit'}]","[{'name':'Challenger\'s','tier':1,'roll':[7],'ref':['#% increased Effectiveness of Monsters in your Maps'],'type':'explicit'}]","[{'name':'of Shrines','tier':1,'roll':[94],'ref':['Your Maps have #% increased chance to contain Shrines'],'type':'explicit'}]"
Precursor Tablet,80,Rare,0,"[{'name':'Elevated','tier':1,'roll':[20],'ref':['#% increased Experience gain'],'type':'explicit'}]","[{'name':'Elevated','tier':1,'roll':[20],'ref':['#% increased Experience gain'],'type':'explicit'}]","[{'name':'Challenger\'s','tier':1,'roll':[7],'ref':['#% increased Effectiveness of Monsters in your Maps'],'type':'explicit'}]"
Precursor Tablet,80,Rare,0,"[{'name':'Brimming','tier':1,'roll':[33],'ref':['#% increased number of Rare Monsters'],'type':'explicit'}]","[{'name':'Brimming','tier':1,'roll':[33],'ref':['#% increased number of Rare Monsters'],'type':'explicit'}]","[{'name':'Elevated','tier':1,'roll':[20],'ref':['#% increased Experience gain'],'type':'explicit'}]"
Precursor Tablet,80,Rare,0,"[{'name':'Bountiful','tier':1,'roll':[34],'ref':['#% increased Gold found in your Maps'],'type':'explicit'}]","[{'name':'Bountiful','tier':1,'roll':[34],'ref':['#% increased Gold found in your Maps'],'type':'explicit'}]","[{'name':'Brimming','tier':1,'roll':[33],'ref':['#% increased number of Rare Monsters'],'type':'explicit'}]"
Precursor Tablet,80,Rare,0,"[{'name':'Bountiful','tier':1,'roll':[28],'ref':['#% increased Gold found in your Maps'],'type':'explicit'}]","[{'name':'Bountiful','tier':1,'roll':[28],'ref':['#% increased Gold found in your Maps'],'type':'explicit'}]","[{'name':'Bountiful','tier':1,'roll':[34],'ref':['#% increased Gold found in your Maps'],'type':'explicit'}]"
Precursor Tablet,80,Rare,0,"[{'name':'Bountiful','tier':1,'roll':[30],'ref':['#% increased Gold found in your Maps'],'type':'explicit'}]","[{'name':'Bountiful','tier':1,'roll':[30],'ref':['#% increased Gold found in your Maps'],'type':'explicit'}]","[{'name':'Bountiful','tier':1,'roll':[28],'ref':['#% increased Gold found in your Maps'],'type':'explicit'}]"
Precursor Tablet,80,Rare,0,"[{'name':'of the Cartographer','tier':1,'roll':[50],'ref':['#% increased Quantity of Waystones found in your Maps'],'type':'explicit'}]","[{'name':'of the Cartographer','tier':1,'roll':[50],'ref':['#% increased Quantity of Waystones found in your Maps'],'type':'explicit'}]","[{'name':'Bountiful','tier':1,'roll':[30],'ref':['#% increased Gold found in your Maps'],'type':'explicit'}]"
Precursor Tablet,80,Rare,0,"[{'name':'Collector\'s','tier':1,'roll':[30],'ref':['#% increased Rarity of Items found in your Maps'],'type':'explicit'}]","[{'name':'Collector\'s','tier':1,'roll':[30],'ref':['#% increased Rarity of Items found in your Maps'],'type':'explicit'}]","[{'name':'of the Cartographer','tier':1,'roll':[50],'ref':['#% increased Quantity of Waystones found in your Maps'],'type':'explicit'}]"
Precursor Tablet,80,Rare,0,"[{'name':'Treasurer\'s','tier':1,'roll':[3],'ref':['Your Maps contain an additional Rare Chest'],'type':'explicit'}]","[{'name':'Treasurer\'s','tier':1,'roll':[3],'ref':['Your Maps contain an additional Rare Chest'],'type':'explicit'}]","[{'name':'Collector\'s','tier':1,'roll':[30],'ref':['#% increased Rarity of Items found in your Maps'],'type':'explicit'}]"
Precursor Tablet,80,Rare,0,"[{'name':'Elevated','tier':1,'roll':[20],'ref':['#% increased Experience gain'],'type':'explicit'}]","[{'name':'Elevated','tier':1,'roll':[20],'ref':['#% increased Experience gain'],'type':'explicit'}]","[{'name':'Treasurer\'s','tier':1,'roll':[3],'ref':['Your Maps contain an additional Rare Chest'],'type':'explicit'}]"
Precursor Tablet,80,Rare,0,"[{'name':'Elevated','tier':1,'roll':[20],'ref':['#% increased Experience gain'],'type':'explicit'},{'name':'Challenger\'s','tier':1,'roll':[10],'ref':['#% increased Effectiveness of Monsters in your Maps'],'type':'explicit'}]","[{'name':'Challenger\'s','tier':1,'roll':[10],'ref':['#% increased Effectiveness of Monsters in your Maps'],'type':'explicit'}]","[]"
Precursor Tablet,80,Rare,0,"[{'name':'Breeding','tier':1,'roll':[8],'ref':['#% increased Pack Size in your Maps'],'type':'explicit'},{'name':'Challenger\'s','tier':1,'roll':[8],'ref':['#% increased Effectiveness of Monsters in your Maps'],'type':'explicit'}]","[{'name':'Breeding','tier':1,'roll':[8],'ref':['#% increased Pack Size in your Maps'],'type':'explicit'},{'name':'Challenger\'s','tier':1,'roll':[8],'ref':['#% increased Effectiveness of Monsters in your Maps'],'type':'explicit'}]","[{'name':'Elevated','tier':1,'roll':[20],'ref':['#% increased Experience gain'],'type':'explicit'},{'name':'Challenger\'s','tier':1,'roll':[10],'ref':['#% increased Effectiveness of Monsters in your Maps'],'type':'explicit'}]"
Precursor Tablet,80,Rare,0,"[{'name':'Bountiful','tier':1,'roll':[28],'ref':['#% increased Gold found in your Maps'],'type':'explicit'},{'name':'Teeming','tier':1,'roll':[57],'ref':['#% increased Magic Monsters'],'type':'explicit'}]","[{'name':'Bountiful','tier':1,'roll':[28],'ref':['#% increased Gold found in your Maps'],'type':'explicit'},{'name':'Teeming','tier':1,'roll':[57],'ref':['#% increased Magic Monsters'],'type':'explicit'}]","[{'name':'Breeding','tier':1,'roll':[8],'ref':['#% increased Pack Size in your Maps'],'type':'explicit'},{'name':'Challenger\'s','tier':1,'roll':[8],'ref':['#% increased Effectiveness of Monsters in your Maps'],'type':'explicit'}]"
Precursor Tablet,80,Rare,0,"[{'name':'Teeming','tier':1,'roll':[70],'ref':['#% increased Magic Monsters'],'type':'explicit'},{'name':'of the Antiquarian','tier':1,'roll':[1],'ref':['Your Maps contain # additional Strongboxes'],'type':'explicit'}]","[{'name':'Teeming','tier':1,'roll':[70],'ref':['#% increased Magic Monsters'],'type':'explicit'},{'name':'of the Antiquarian','tier':1,'roll':[1],'ref':['Your Maps contain # additional Strongboxes'],'type':'explicit'}]","[{'name':'Bountiful','tier':1,'roll':[28],'ref':['#% increased Gold found in your Maps'],'type':'explicit'},{'name':'Teeming','tier':1,'roll':[57],'ref':['#% increased Magic Monsters'],'type':'explicit'}]"
Precursor Tablet,80,Rare,0,"[{'name':'of the Antiquarian','tier':1,'roll':[1],'ref':['Your Maps contain # additional Strongboxes'],'type':'explicit'}]","[]","[{'name':'Teeming','tier':1,'roll':[70],'ref':['#% increased Magic Monsters'],'type':'explicit'}]"
Precursor Tablet,80,Rare,0,"[{'name':'Challenger\'s','tier':1,'roll':[11],'ref':['#% increased Effectiveness of Monsters in your Maps'],'type':'explicit'}]","[{'name':'Challenger\'s','tier':1,'roll':[11],'ref':['#% increased Effectiveness of Monsters in your Maps'],'type':'explicit'}]","[{'name':'of the Antiquarian','tier':1,'roll':[1],'ref':['Your Maps contain # additional Strongboxes'],'type':'explicit'}]"
Precursor Tablet,80,Rare,0,"[{'name':'of the Summoning','tier':1,'roll':[49],'ref':['Area has #% increased chance to contain a Summoning Circle'],'type':'explicit'}]","[{'name':'of the Summoning','tier':1,'roll':[49],'ref':['Area has #% increased chance to contain a Summoning Circle'],'type':'explicit'}]","[{'name':'Challenger\'s','tier':1,'roll':[11],'ref':['#% increased Effectiveness of Monsters in your Maps'],'type':'explicit'}]"
Precursor Tablet,80,Rare,0,"[{'name':'of the Summoning','tier':1,'roll':[42],'ref':['Area has #% increased chance to contain a Summoning Circle'],'type':'explicit'}]","[{'name':'of the Summoning','tier':1,'roll':[42],'ref':['Area has #% increased chance to contain a Summoning Circle'],'type':'explicit'}]","[{'name':'of the Summoning','tier':1,'roll':[49],'ref':['Area has #% increased chance to contain a Summoning Circle'],'type':'explicit'}]"
Precursor Tablet,80,Rare,0,"[{'name':'Challenger\'s','tier':1,'roll':[9],'ref':['#% increased Effectiveness of Monsters in your Maps'],'type':'explicit'},{'name':'Collector\'s','tier':1,'roll':[23],'ref':['#% increased Rarity of Items found in your Maps'],'type':'explicit'},{'name':'of the Summoning','tier':1,'roll':[42],'ref':['Area has #% increased chance to contain a Summoning Circle'],'type':'explicit'},{'name':'of the Cartographer','tier':1,'roll':[44],'ref':['#% increased Quantity of Waystones found in your Maps'],'type':'explicit'}]","[{'name':'Challenger\'s','tier':1,'roll':[9],'ref':['#% increased Effectiveness of Monsters in your Maps'],'type':'explicit'},{'name':'Collector\'s','tier':1,'roll':[23],'ref':['#% increased Rarity of Items found in your Maps'],'type':'explicit'},{'name':'of the Cartographer','tier':1,'roll':[44],'ref':['#% increased Quantity of Waystones found in your Maps'],'type':'explicit'}]","[]"
Precursor Tablet,80,Rare,0,"[]","[]","[{'name':'Challenger\'s','tier':1,'roll':[9],'ref':['#% increased Effectiveness of Monsters in your Maps'],'type':'explicit'},{'name':'Collector\'s','tier':1,'roll':[23],'ref':['#% increased Rarity of Items found in your Maps'],'type':'explicit'},{'name':'of the Summoning','tier':1,'roll':[42],'ref':['Area has #% increased chance to contain a Summoning Circle'],'type':'explicit'},{'name':'of the Cartographer','tier':1,'roll':[44],'ref':['#% increased Quantity of Waystones found in your Maps'],'type':'explicit'}]"
Precursor Tablet,80,Rare,0,"[{'name':'of the Devoted','tier':1,'roll':[1],'ref':['Your Maps contain an additional Shrine'],'type':'explicit'}]","[{'name':'of the Devoted','tier':1,'roll':[1],'ref':['Your Maps contain an additional Shrine'],'type':'explicit'}]","[]"
Precursor Tablet,80,Rare,0,"[{'name':'Collector\'s','tier':1,'roll':[25],'ref':['#% increased Rarity of Items found in your Maps'],'type':'explicit'}]","[{'name':'Collector\'s','tier':1,'roll':[25],'ref':['#% increased Rarity of Items found in your Maps'],'type':'explicit'}]","[{'name':'of the Devoted','tier':1,'roll':[1],'ref':['Your Maps contain an additional Shrine'],'type':'explicit'}]"
Precursor Tablet,80,Rare,0,"[{'name':'Collector\'s','tier':1,'roll':[25],'ref':['#% increased Rarity of Items found in your Maps'],'type':'explicit'}]","[]","[]"
Precursor Tablet,80,Rare,0,"[{'name':'Collector\'s','tier':1,'roll':[25],'ref':['#% increased Rarity of Items found in your Maps'],'type':'explicit'}]","[]","[]"
```

[LargeDemo.csv](/LargeDemo.csv) has a header row and 1,000 rows on Precursor Tablets in the same format, also without
the `generation` key.
