# Runbook: checking in-game behavior on Windows

An agent cannot run Path of Exile 2, so the behaviors below need the maintainer on Windows with
the game running ([AGENTS.md](../../../AGENTS.md#what-every-change-must-pass), rule 9). Each entry
says what to press, what you should see and where the logs are. The default keys come from
`defaultConfig()` in `renderer/src/web/Config.ts` and from each widget's `initInstance()`, not from
the user pages. A change that leaves an entry unchecked names it in its summary, and a check that
waits for the maintainer is a task in [docs/dev/host/](../host/index.md).

## Before you start

- **The game** runs in Windowed Fullscreen or Windowed mode, the modes the
  [download page](../../download.md) lists as supported.
- **The build under test** is a dev run ([DEVELOPING.md](../../../DEVELOPING.md)) or a packaged
  build. In a dev run main never writes `config.json` (`ConfigStore` in
  `main/src/host-files/ConfigStore.ts` returns before writing when `VITE_DEV_SERVER_URL` is set),
  so a setting changed during the check lasts only for that run.
- **The defaults** below are those of a new config. An existing config keeps its own keys. To check
  the defaults, quit Kalandra, move `%APPDATA%\kalandra\apt-data\config.json` aside and start it
  again. Put the file back afterwards.
- **The language** in Settings, General, Language matches the game's language, since the parser
  reads item text in the app's language.
- **The rights** of both programs match. When the game runs as administrator, start Kalandra as
  administrator too.

## Where the logs are

- **Settings, Debug** shows the last 1000 lines main has written since it started (`Logger` in
  `main/src/RemoteLogger.ts`), as `[<local time>] <level> [<area>] <message>`. A line the page
  sends to main has the area `renderer` (`main/src/renderer-log.ts`). To open Settings, press the
  overlay key (Shift + Space) and click the cog icon in the main button bar. The tray item
  Settings/League only shows a message that says this.
- **Record all key presses**, a checkbox in Settings, Debug, makes main log every key pressed
  while the game window is active as `debug [Shortcuts] Keydown <keys>` and
  `debug [Shortcuts] Keyup <key>`, and every hotkey it handles as
  `debug [Shortcuts] Action type: <type>`, where the type is `copy-item`, `toggle-overlay`,
  `paste-in-chat`, `stash-search` or `trigger-event`.
- **The renderer's console** holds what the page logs. A dev run opens the developer tools at
  start. In a packaged build, focus the overlay and press Ctrl + Shift + I: the overlay window's
  menu has the `toggleDevTools` role (`main/src/windowing/OverlayWindow.ts`), and Electron binds
  that role to Ctrl + Shift + I on Windows.
- **Console lines that Settings, Debug also shows** are sent with `logToMain()`
  (`renderer/src/web/background/log-to-main.ts`):
  - `warn [renderer] Loading prices failed: <reason>` ([section 4](#4-the-price-check-keys)).
  - `warn [renderer] Cannot load the trade leagues: <reason>` (`Leagues.ts`) and
    `warn [renderer] Cannot load the trade item and stat lists: <reason>` (`TradeData.ts`), such
    as a reason that starts with `The trade site sent a web page instead of data (status 503)`.
  - `error [renderer] Skipped a Client.txt line that failed: <reason>. Later failures go only to
    the renderer's console`, for the first such line of a run (`client-log.ts`).
  - `warn [renderer] Skipped rate limit rule "<rule>": limit header "<value>", state header
    "<value>"` and `warn [renderer] Ignored Retry-After header "<value>": not a number of
    seconds`, once a run for each rule and for `Retry-After` (`price-check/trade/common.ts`).
  - `Kalandra cannot start` is not sent: the page shows it before it connects to main.
- **The config folder** opens from the tray item Open config folder.

Four lines from `main/src/shortcuts/` apply to every key below:

- `error [Shortcuts] Failed to register a shortcut "<key>". It is already registered by another application.`
- `error [Shortcuts] Hotkey "<key>" reserved by the game will not be registered.`
- `error [Shortcuts] It is not possible to use the same hotkey "<key>" for multiple actions.`
- `error [Shortcuts] Hotkey "<key>" has an unknown key name and will not be registered.`

## 1. The overlay attaches to the game

- **Press:** nothing. Start the game while Kalandra runs.
- **See:** a banner with `Kalandra` and `Is ready and running in background` for 2.5 seconds
  (`renderer/src/web/overlay/LoadingAnimation.vue`). It shows when "Show a notification when the
  Overlay detects a PoE window" in Settings, General is ticked, as it is by default. When main
  could not read `config.json` at start, or moved it aside because it was not JSON, the banner also names the file and the reason for 20
  seconds, even with that setting off.
- **Logs:** when the game runs as administrator and Kalandra does not, main logs
  `error [Overlay] PoE2 is running with administrator rights` and shows a dialog titled
  `PoE2 window: no access`. Main attaches to the window titled `Path of Exile 2` ("PoE window
  title" in Settings, General). It reads the title once at start, so a change applies after a
  restart. Main writes no line while no such window exists.

## 2. The overlay key and focus

- **Press:** Shift + Space in the game.
- **See:** the overlay takes the mouse and the keyboard. The screen gets the background set in
  "Background when the Overlay is clickable" in Settings, General (default
  `rgba(129, 139, 149, 0.15)`, a light gray tint), and the main button bar can be clicked.
  Shift + Space again, Escape or Ctrl + W gives the game focus back, and so does a click on the
  background while "Clicking on the background focuses the game" is ticked, the default. Keys then
  reach the game again.
- **Also check:**
  - Set the Overlay key to one with Ctrl, Shift and Alt, such as Ctrl + Shift + Alt + Q. It gives the
    overlay focus in the game and gives the game focus back while the overlay has it.
  - Hold Alt alone: the overlay disappears after 275 ms, or 85 ms while it has focus, and comes
    back when Alt is released or another key is pressed. Moving the mouse while Alt is held does
    not bring it back (`main/src/windowing/OverlayVisibility.ts`).
  - Hotkeys work only while the game has focus: main registers them when the game window becomes
    active and removes them when it loses focus. With another window focused, Ctrl + D reaches that
    window.
  - Set a hotkey that another program has registered, Save, and give the game focus once. In
    Settings, Hotkeys the field has a red outline, and its tooltip says another program uses the key.
  - Switching to another window hides the overlay window, and returning to the game shows it
    again, whether "Fully hide overlay when it loses focus instead of making it transparent." in
    Settings, General is ticked or not: `electron-overlay-window` hides the window while neither
    the game nor the overlay has the focus. Ticked, main also hides the window while the game has
    the focus and no widget is shown (`syncWindowVisibility` in
    `main/src/windowing/OverlayWindow.ts`). Unticked, the default, the window stays open over
    the game and draws nothing.
  - With Record all key presses ticked, type in another program, such as a text editor, and in the
    overlay's Item search: Settings, Debug shows no `Keydown` line for those keys. Keys pressed in
    the game do show.
- **Logs:** `debug [Shortcuts] Action type: toggle-overlay` with key recording on. The overlay key
  is required, and main keeps it even when another action uses the same key.

## 3. Clipboard capture with the Advanced Descriptions key

Every key that reads an item makes main press Ctrl, the game's show advanced item descriptions key
and C, so the game copies the item with its advanced descriptions. Main reads that key from
`show_advanced_item_descriptions` under `[ACTION_KEYS]` in
`Documents\My Games\Path of Exile 2\poe2_production_Config.ini` ("PoE config file" in Settings,
General, sets another path), and uses Alt when the file does not set it
(`main/src/host-files/GameConfig.ts`). With the game's defaults the copy keys are Ctrl + Alt + C.

- **Press:** with the cursor on an item, press Ctrl + Alt + C yourself and paste into a text
  editor. Then press Ctrl + D on the same item.
- **See:** the pasted text starts with `Item Class: `, and each modifier has a line above it such
  as `{ Prefix Modifier "Crackling" (Tier: 7) — Damage, Elemental, Lightning, Attack }` (this line
  is from `renderer/specs/Parser/items.ts`). After Ctrl + D the clipboard holds the item's text.
  With "Restore clipboard" ticked in Settings, General, it is empty, since it held item text
  before Ctrl + D. Copy a word in the text editor and press Ctrl + D again: the clipboard then
  holds that word.
- **Logs:**
  - `warn [ClipboardPoller] No item text found.` when no item text reaches the clipboard within
    about half a second (`POLL_LIMIT` in `main/src/shortcuts/HostClipboard.ts`). Another program
    uses Ctrl + Alt + C, or the game did not copy: the user page
    [Nothing happens](../../nothing-happens.md) lists the usual causes.
  - `error [GameConfig] Failed to find game configuration file in the default location.`,
    `error [GameConfig] Found more than one game configuration file, enter one in settings: <paths>`,
    `error [GameConfig] Failed to read game configuration file: <reason>`,
    `error [GameConfig] Failed to read key: <value>.` or
    `error [GameConfig] Failed to read modifier key: <value>.` when main cannot read the key.
- **Setting:** main starts reading the clipboard 48 ms after the copy, "Initial clipboard check
  delay(after copy-item keybind is pressed)" in Settings, Price check.

## 4. The price check keys

- **Press** (Settings, Hotkeys, Price check):
  - Auto-hide Mode: hold Ctrl and press D.
  - Open without auto-hide: Ctrl + Alt + D.
- **See:** with Ctrl + D on an item, the price check window opens beside it with the item, its
  filters and the trade results. It searches at once for a normal, magic, rare or unique item.
  For an item the price file lists, such as a currency or a unique,
  it also shows the estimate from `https://kalandra.ashoal.com/prices/<league>.json`. How the
  league id becomes that file name is in [price-service.md](../modules/price-service.md#the-files).
  The file's categories are in `renderer/public/data/namespaceMap.json`. Above the listings, the
  line "Suggested price:" with its "Experimental" tag shows a price, a range and a reliability, or
  "too few listings" ([suggested-price.md](../../suggested-price.md)). Keep Ctrl held and move
  the cursor into the window: it takes focus, and Ctrl can be released. Release Ctrl and move the
  cursor away from the item instead: the window closes (`main/src/windowing/WidgetAreaTracker.ts`).
  With Ctrl + Alt + D the window opens with focus and stays until you press Escape or return to
  the game.
- **Other item keys** have no default: Map check / Item info in Settings, Hotkeys (one row that sets
  the `hotkey` of the item check widget), and "Open item on wiki", "Open item on PoEDB", "Open base
  item on Craft of Exile", "Find in Stash" and "Filter by" in Settings, Item info. Set one before
  checking it. With a key set for "Open item on wiki", that key on an item opens
  `https://www.poe2wiki.net/wiki/<English item name>` in the default browser (`openWiki` in
  `renderer/src/web/item-check/hotkeyable-actions.ts`).
- **Logs:** `debug [Shortcuts] Action type: copy-item` with key recording on.
  `error [proxy] <message> (<host>)` when main cannot reach a site.
  `warn [renderer] Loading prices failed: No price file for <league> (<status>)` when the price
  file is missing (`renderer/src/web/background/Prices.ts`), and
  `warn [renderer] Loading prices failed: <reason>` for any other failed load, such as one after an
  `error [proxy]` line for `kalandra.ashoal.com`. The renderer's console shows the same errors.

## 5. Chat commands

- **Defaults** (`commands` in `defaultConfig()`, Settings, Chat): F5 sends `/hideout` and F9 sends
  `/exit`, both with "press Enter" ticked. `@last ty`, `/invite @last`, `/tradewith @last` and
  `/hideout @last` have no key.
- **Press:** F5 in an area, then F9.
- **See:** with F5 the chat opens, the text appears, is sent, and the chat closes, and the
  character goes to the hideout. F9 exits to the character selection screen. Give `/invite @last`
  a key and press it after a whisper: main opens the chat with Ctrl + Enter, the game's key that
  replies to the last whisper, and the text sent is `/invite` and the name of the last whisper.
- **Keys main presses:** the keys for a command with and without `@last` are listed under
  `text-box.ts` in [main.md](../modules/main.md#public-contract). Main drops a second command
  pressed within 120 ms of the first.
- **Restore clipboard:** with it ticked, copy a word in another program and press F5, once in an
  area and once during a loading screen. The chat never shows the word, and a paste in another
  program afterwards gives `/hideout`.
- **Logs:** `debug [Shortcuts] Action type: paste-in-chat` with key recording on.

## 6. Stash tab scrolling

- **Setting:** "Stash tab scrolling" in Settings, Hotkeys: Ctrl + MouseWheel, the default, or
  Disabled. In the game, Mousewheel Zoom is off, as the app's tip says:
  `To enable Stash Tab Scrolling, disable "Mousewheel Zoom" in PoE settings (Options -> UI).`
- **Press:** open the stash, hold Ctrl and turn the mouse wheel with the cursor outside the stash
  grid, for example over the inventory.
- **See:** the stash moves one tab per wheel step. Main presses ArrowRight for one direction and
  ArrowLeft for the other. With the cursor over the stash grid, the left panel between 154/1600 and
  1192/1600 of the window height, main presses nothing (`isStashArea` in
  `main/src/shortcuts/Shortcuts.ts`).
- **Logs:** main writes no line for a wheel step.

## 7. Client.txt for the XP tracker

`Client.txt` is the log file the game writes. The XP tracker reads area changes and level ups from
it.

- **Setting:** "Allow reading of Client.txt file" in Settings, Leveling or Settings, General, off
  by default. With "PoE log file" empty, main looks in the Windows folders that
  [Settings](../../settings.md#general) lists (`main/src/host-files/GameLogWatcher.ts`). Save.
- **Press:** open the overlay and click XP in the main button bar. Enter a new area, then gain a level.
  Uncheck the setting, Save, check it again, Save, and enter another area. Then empty `Client.txt`
  in a text editor while the game runs, save it, and enter another area.
- **See:** the main button bar has no XP button until the setting is on and saved, and none after it
  is unchecked and saved. The widget shows the character level, `Exp` and `Over`. `Exp` and `Over` follow the
  area level, which changes when the game writes `Generating level <n> area "<id>" with seed <n>`
  for a new area. The character level changes when the game writes
  `<name> (<class>) is now level <n>`. Both patterns are `LOG_ZONE_GEN` and `LOG_LEVEL_UP` in
  `renderer/public/data/en/client_strings.js`. An area whose id contains `town` or `hideout`
  leaves the area level as it was (`renderer/src/web/client-log/client-log.ts`). Main reads only
  the lines written after it opened the file, and looks for new ones every 450 ms. The area level
  also follows the area entered after the setting was turned off and on again, and the area entered
  after `Client.txt` was emptied.
- **Logs:**
  - `info [GameLogWatcher] disabled` when the setting is off.
  - `error [GameLogWatcher] No log file found` when neither path exists.
  - `error [GameLogWatcher] Found 2 log files, please enter one into settings:` and both paths,
    when both exist. Enter one in "PoE log file".
  - `error [GameLogWatcher] Failed to watch file: <reason>` when main cannot open the file, with
    Node's error, such as `ENOENT` for a missing file.
  - `info [GameLogWatcher] The log file got shorter, reading it again from the start` after the
    file was emptied, or `info [GameLogWatcher] The log file was replaced, reading the new file
    from the start` when the editor saved a new file in its place.

## After the check

Write down which entries were checked, on which build, and the result, in the pull request or the
host task. An entry that fails is a bug report with the log lines it produced.
