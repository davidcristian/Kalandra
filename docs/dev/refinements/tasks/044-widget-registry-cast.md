# Adding a widget needs a cast that AGENTS.md rule 7 forbids

**Status:** open
**Area:** rules
**Origin:** [renderer/src/web/overlay/widget-registry.ts](../../../../renderer/src/web/overlay/widget-registry.ts)
**Verified:** 2026-10-21

The widget rule in [AGENTS.md](../../../../AGENTS.md#architecture-rules) says a widget is added by
one `registry.widgets.push` line in `widget-registry.ts`. All 12 such lines there cast the component
with `as unknown as WidgetComponent`. Rule 7 of
[AGENTS.md](../../../../AGENTS.md#what-every-change-must-pass) says new code adds no
`as unknown as` cast. So a new widget cannot follow both rules as written.

A single `as WidgetComponent` does not compile. Under `tsc --noemit`, a `.vue` import has the type
`DefineComponent<{}, {}, any>` from `renderer/src/shims-vue.d.ts`, which has no `widget` property,
and TypeScript rejects the conversion with error TS2352.

Done looks like: a typed helper that registers a widget without the cast, such as a type guard
that checks the `widget` property, used by every existing line in a `refactor(renderer):` commit.
Or an exception for this one cast, written in AGENTS.md and in
[modules/renderer-widgets.md](../../modules/renderer-widgets.md).

## History

- 2026-10-18: Found while the renderer widgets module doc was written, by counting the casts in
  `widget-registry.ts`.
- 2026-10-21: ESLint now reports a cast through `unknown`. `renderer/eslint-suppressions.json`
  exempts the 12 in `widget-registry.ts`, so a 13th fails `npm run lint` until this task is done
  ([071](071-type-and-catch-rules-in-existing-code.md)).
