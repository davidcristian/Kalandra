---
title: Client log file
---

The game writes a log file, `Client.txt`, with debug lines and chat messages. When reading this file is allowed,
Kalandra reads each line the game adds to it. With Item Data Collection also on, Kalandra writes each line that
matches one of the entry types below, as one entry, to a file of its own: `client-log.ndjson`. Use that file to
study a play session afterwards, for example to time a campaign run from its `load-zone` and `level-up` entries.

## Turn it on

1. Press `Shift + Space`, the default overlay key, to open the overlay. Click the cog icon to open the settings.
2. On the **General** page, check **Allow reading of Client.txt file** and **Enable experimental features**, then
   check **Item Data Collection** below it.
3. Click **Save**.

Kalandra writes `client-log.ndjson` to the **Output Folder** of the Library widget, which is
`%APPDATA%\kalandra\apt-data\csv-data` on Windows by default. [Item data](/item-data) describes that setting. The
folder must exist: Kalandra creates it when a Library session starts, but not for this file.

When **PoE log file** on the **General** settings page is empty, Kalandra looks for `Client.txt` in the default game
folders, which [Settings](/settings#general) lists for each operating system. When it finds the file in none of these
folders, or in more than one, it reads no log and shows the error on the **Debug** settings page. Enter the path of
the file in **PoE log file** to fix this.

## How Kalandra writes the file

- The file is NDJSON (newline-delimited JSON): each line is one JSON object, which holds one entry.
- Kalandra reads only the lines the game adds to `Client.txt` while Kalandra runs, not the lines already in it.
- Kalandra empties the file when the first entry arrives after Kalandra starts, so the file holds the entries of one
  run of Kalandra.
- Kalandra does not write the entries that arrive while it opens the file. This always includes the first entry
  after Kalandra starts.
- Lines can be out of order. Sort the entries by `ts`, then by `ms`, when you need them in order.
- Kalandra matches the `level-up` line in the language of the **Language** setting, and the lines of every other
  type in English.

## Sample

Each line below is the entry Kalandra writes for one line of a `Client.txt` file from a campaign run, read on a
computer set to UTC. The sample shows one entry for most types, not a whole file:

```jsonl
{"ts":1765541125000,"ms":1001119265,"type":"game-version","version":"4.4.0"}
{"ts":1765541125000,"ms":1001119984,"type":"game-start"}
{"ts":1765544490000,"ms":1004484500,"type":"load-zone","zone":"g1_1","areaLevel":1,"seed":3424458294}
{"ts":1765544491000,"ms":1004485140,"type":"map-nav","mapName":"The Riverbank"}
{"ts":1765544513000,"ms":1004507968,"type":"npc","npcName":"Wounded Man","message":"By the First Ones! You're alive!"}
{"ts":1765544616000,"ms":1004610062,"type":"level-up","level":2,"charName":"HolyMolyThisIsCharName","charClass":"Mercenary"}
{"ts":1765544687000,"ms":1004681234,"type":"passive-tree","allocate":true,"nodeId":"projectiles18","nodeName":"Projectile Damage"}
{"ts":1765544769000,"ms":1004763718,"type":"player-death","charName":": HolyMolyThisIsCharName"}
{"ts":1765544820000,"ms":1004814156,"type":"permanent-bonus","permanentBonus":"+10% to [Resistances|Cold Resistance].","charName":"HolyMolyThisIsCharName"}
{"ts":1765548394000,"ms":1008388109,"type":"afk","isAfk":true}
{"ts":1765550526000,"ms":1010520875,"type":"skill-point","points":2,"pointType":"passive"}
```

## Fields

Every entry has these fields, in this order, followed by the fields of its type:

| Field | Type | Content |
| --- | --- | --- |
| `ts` | number | Unix time (milliseconds since 1 January 1970 UTC) of the date and time at the start of the log line, read in the computer's time zone. The log has whole seconds, so the last three digits are `000`. |
| `ms` | number | The millisecond counter that the game writes after the date and time on each log line. It counts from when the computer started. |
| `type` | string | The entry type. The sections below list each type and the fields it adds. |

## Entry types

`ClientLogEvent` in [ipc/types.ts](https://github.com/davidcristian/Kalandra/blob/master/ipc/types.ts) defines the
types. It also has `log`, the type of a line that matches no other type, and `login`. Kalandra writes neither: it
skips `log` lines, and no line produces `login`.

### `game-start`

The game started, from the `[STARTUP] Game Start` line. This type adds no fields.

### `load-zone`

The game generated an area for a character to enter, from the
`Generating level <level> area "<id>" with seed <seed>` line.

| Field | Type | Content |
| --- | --- | --- |
| `zone` | string | Area ID in lowercase, such as `g1_1` or `g1_town` |
| `areaLevel` | number | Area level |
| `seed` | number | The number the game generated the area from. Entering the same area instance again gives the same seed. |

### `level-up`

A character gained a level, from the `: <name> (<class>) is now level <level>` line.

| Field | Type | Content |
| --- | --- | --- |
| `level` | number | The new level |
| `charName` | string | Character name |
| `charClass` | string | Character class, such as `Mercenary` |

### `game-version`

The game version, from the `[HTTP2] User agent: PoE poe2_production/tags/<version>` line.

| Field | Type | Content |
| --- | --- | --- |
| `version` | string | Game version as the log line writes it, such as `4.4.0` or `4.4.0j` |

### `alt-tab`

The game window gained or lost focus, from the `[WINDOW] Gained focus` and `[WINDOW] Lost focus` lines.

| Field | Type | Content |
| --- | --- | --- |
| `gameFocused` | boolean | `true` when the game window gained focus, `false` when it lost focus |

### `npc`

A line of dialog from an NPC (non-player character), from the `<NPC name>: <message>` line. Kalandra writes dialog
only from these NPCs: Renly, Ghostly Voice, The Rust King, Beira of the Rotten Pack, The Bloated Miller, Mortimer and
Wounded Man.

| Field | Type | Content |
| --- | --- | --- |
| `npcName` | string | NPC name |
| `message` | string | The dialog text |

### `player-death`

A character died, from the `: <name> has been slain.` line.

| Field | Type | Content |
| --- | --- | --- |
| `charName` | string | Character name. The value starts with `: `, the two characters before the name in the log line. |

### `passive-tree`

A passive skill node was allocated or refunded, from the
`Successfully allocated passive skill id: <id>, name: <name>` line and its `unallocated` form.

| Field | Type | Content |
| --- | --- | --- |
| `allocate` | boolean | `true` when the node was allocated, `false` when it was refunded |
| `nodeId` | string | Node ID, such as `projectiles18` |
| `nodeName` | string | Node name, such as `Projectile Damage` |

### `permanent-bonus`

A permanent bonus that a character received, from the `: <name> has received <bonus>` line. Campaign rewards grant
these bonuses, such as the ones from Beira and Candlemass. The bonus text keeps the game's markup and the final
period, such as `+10% to [Resistances|Cold Resistance].`

| Field | Type | Content |
| --- | --- | --- |
| `permanentBonus` | string | The bonus text as the log line writes it |
| `charName` | string | Character name |

### `skill-point`

Skill points that the character received, from the `: You have received <count> <kind> Skill Points.` line or its
`Skill Point.` form.

| Field | Type | Content |
| --- | --- | --- |
| `points` | number | Number of points. `a` or `an` in the log line counts as 1. |
| `pointType` | string | Kind of point, from the table below |

| Kind in the log line | `pointType` |
| --- | --- |
| Passive | `passive` |
| Weapon Set Passive | `weapon-set` |
| Atlas | `atlas` |
| Map Boss Atlas | `map-boss` |
| Arbiter Boss Atlas | `arbiter-boss` |
| Abyss Atlas | `abyss` |
| Ritual Atlas | `ritual` |
| Delirium Atlas | `delirium` |
| Expedition Atlas | `expedition` |
| Breach Atlas | `breach` |
| Any other text | `passive` |

### `map-nav`

The game changed the scene it shows, from the `[SCENE] Set Source [<name>]` line.

| Field | Type | Content |
| --- | --- | --- |
| `mapName` | string | Scene name, from the list below |

- The area name, such as `The Riverbank`, after an area loads.
- `(null)` while an area loads, and when the full-screen map or the Atlas closes.
- `(unknown)` when no area is shown, such as at startup.
- The act name, such as `Act 1` or `Interlude`, while the full-screen map of that act is open.
- `Atlas` while the Atlas is open.

### `afk`

AFK (away from keyboard) mode turned on or off, from the
`: AFK mode is now ON. Autoreply "This player is AFK."` and `: AFK mode is now OFF.` lines.

| Field | Type | Content |
| --- | --- | --- |
| `isAfk` | boolean | `true` when AFK mode turns on, `false` when it turns off |
