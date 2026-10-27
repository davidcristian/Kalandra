# The Library widget saves mod options that nothing reads

**Status:** open
**Area:** config
**Origin:** [renderer/src/web/library/widget.ts](../../../../renderer/src/web/library/widget.ts)
**Verified:** 2026-10-22

Each profile of the Library widget config has a `modOpts` object (`ColumnOpts` in
`renderer/src/web/library/widget.ts`): `name`, `tier`, `roll`, `ref`, `type` and `generation`.
`initInstance()` in `WidgetLibrary.vue` sets them all to `true`, and the step for versions below 33
in `upgradeConfig()` in `renderer/src/web/Config.ts` sets `generation`. No code reads them:
`modToShortMod()` writes every field of a mod to the CSV, and `ProfileSettings.vue` has no
checkbox for them.

This is a decision for the maintainer. Either the CSV leaves out the fields a profile turns off,
with a checkbox for each in `ProfileSettings.vue` and a test in
`renderer/specs/web/library/libraryChaos.test.ts`, or the field goes. Removing it changes the
config type and follows the hard rule in [AGENTS.md](../../../../AGENTS.md#the-one-hard-rule): an
upgrade step deletes it from saved configs, and no existing step changes.

## History

- 2026-10-22: Found while the commented-out mod option checkboxes and their unused bindings were
  removed from `ProfileSettings.vue`. The saved field was kept, because it is user data.
- 2026-10-27: The maintainer chose to remove `modOpts`. Left: remove it from the profile type in
  `widget.ts` and from `initInstance()`, and add an upgrade step that deletes it from saved
  profiles.
