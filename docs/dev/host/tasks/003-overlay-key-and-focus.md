# The overlay key, focus and hiding behave as the pages say

**Status:** never attempted
**Needs:** Path of Exile 2 on Windows
**Origin:** [docs/widgets.md](../../../widgets.md)
**Verified:** 2026-10-18

**Claims.** [docs/quick-start.md](../../../quick-start.md), [docs/widgets.md](../../../widgets.md),
[docs/settings.md](../../../settings.md) and the developer docs
[architecture.md](../../architecture.md) and
[modules/renderer-widgets.md](../../modules/renderer-widgets.md) say:

- Hotkeys work only while the game window is active: main registers them when the game window
  becomes active and removes them when it loses focus (`main/src/shortcuts/Shortcuts.ts`).
- With Record all key presses ticked in Settings, Debug, main logs keys only while the game window
  is active, not while the overlay or another program is (`main/src/shortcuts/key-log.ts`).
- Shift + Space gives the overlay focus. Shift + Space again, Escape, Ctrl + W or a click on the
  background gives the game focus back. An overlay key with Ctrl, Shift and Alt does the same
  (`main/src/windowing/overlay-keys.ts`).
- Holding Alt alone hides the overlay after 275 ms, or 85 ms while it has focus
  (`main/src/windowing/OverlayVisibility.ts`).
- Widgets hide by their flags as focus moves (`renderer/src/web/overlay/OverlayWindow.vue`). The
  price check and Item info (`hide-on-blur`) close when the game gets focus. Widgets with
  `invisible-on-blur`, such as Stash search and Item search, are drawn only while the overlay has
  focus. The Settings window (`ignore-ui-visibility`) stays drawn while Alt hides the focused
  overlay.
- With "Fully hide overlay when it loses focus instead of making it transparent." in Settings,
  General ticked or not, `electron-overlay-window` 4.0.2 hides the overlay window while neither the
  game nor the overlay has the focus, and shows it when the game gets the focus back. This is read
  from the library's JavaScript, not from its native focus events. Ticked, main also hides the
  window while the game has the focus and no widget is shown (`syncWindowVisibility` in
  `main/src/windowing/OverlayWindow.ts`). Unticked, the window stays and draws nothing.
- In a packaged build, Ctrl + Shift + I with the overlay focused opens the developer tools: the
  overlay window's menu has the `toggleDevTools` role, which Electron binds to that key on Windows.
  The window is frameless, and the run shows whether the key works there.

**Do.** [Section 2 of the runbook](../../runbooks/in-game-check.md#2-the-overlay-key-and-focus),
including its Also check list. Open each widget named above and move focus between the game and
the overlay. Switch to another program with Alt + Tab, once with the setting ticked and once with
it unticked. Then press Ctrl + Shift + I in a packaged build.

**Pass.** Each item above happens as written, and the setting does what docs/settings.md says.
With another window focused, Ctrl + D reaches that window and not Kalandra.

**Record.** What the overlay window does when another program takes focus, with the setting
ticked and unticked. Any difference goes into the page or the runbook that states it, in the same
commit as this file's History line. A key that does not work is a bug: file a refinement with the
key log from Settings, Debug, with Record all key presses on.

## History

- 2026-10-18: Filed from the claims about focus that the writers of the user pages and of the
  developer docs could not settle without the overlay over the game.
