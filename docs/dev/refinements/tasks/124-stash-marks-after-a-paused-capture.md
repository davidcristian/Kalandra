# The stash marks stay for a moment after the stash closes when the capture was paused

**Status:** open
**Area:** renderer
**Origin:** [renderer/src/web/stash-prices/stash-detector.ts](../../../../renderer/src/web/stash-prices/stash-detector.ts)
**Verified:** 2026-10-28

While the game window is not active, the capture is `paused`, and `update()` in `stash-detector.ts`
keeps `open`, so the marks stay while the user works in the overlay. When the game gets the focus
back, the capture starts again and closes the tab only after 2 frames that miss it
(`FRAMES_TO_CHANGE`, `FRAME_MS` apart). A stash that the user closes right after returning keeps its
marks for about a second plus the time the capture takes to start.

Done looks like: the time step 10 of [host task 021](../../host/tasks/021-stash-detection.md)
records. If it is too long, the marks hide from the moment the game gets the focus back until the
first frame shows the tab again, with a test in `stash-detector.test.ts`.

## History

- 2026-10-28: Left for later by the stash marks, which keep the last state of a paused capture.
