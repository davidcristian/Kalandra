# OverlayWindow.vue has tests only for the render-state of the stash layer

**Status:** open
**Area:** renderer
**Origin:** [renderer/src/web/overlay/OverlayWindow.vue](../../../../renderer/src/web/overlay/OverlayWindow.vue)
**Verified:** 2026-10-28

`stash-highlights.test.ts` renders `OverlayWindow.vue` with no widgets and checks that
`OVERLAY->MAIN::render-state` follows the open tab. No test renders it with widgets, so
`isOverlayVisible` for shown, `invisible-on-blur` and `hide-on-blur` widgets, the layer hidden while
Alt hides the overlay, and the config save when the window loses focus have no test. The file has
404 lines and is in `scripts/long-files.txt`.

Done looks like: a spec for `OverlayWindow.vue` with a stub registry and a fake `Host` that checks
each of these through the events the page sends, and a higher coverage floor if the share rises.

## History

- 2026-10-28: Left for later by the stash marks, whose test is the first to render the overlay
  window.
