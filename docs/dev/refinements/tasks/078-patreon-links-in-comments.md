# Decide whether the app shows the Patreon links to Awakened PoE Trade's author

**Status:** open
**Area:** renderer
**Origin:** [ADR-0001](../../adr/ADR-0001-kalandra-continues-exiled-exchange-2.md)
**Verified:** 2026-10-22

The two blocks that link `https://patreon.com/awakened_poe_trade`, in
`renderer/src/web/price-check/CheckedItem.vue` and `renderer/src/web/settings/SettingsWindow.vue`,
are inside HTML comments, so the app shows neither link. Exiled Exchange 2 commented them out in
its commit `drop patreon links` of 25 Apr 2026, before Kalandra started. The
`Support development on` key in each `app_i18n.json` is used only inside those comments. The README
credits both projects, `.github/FUNDING.yml` names the Patreon account, and the settings window
lists Awakened PoE Trade's patrons.

This is a decision for the maintainer, with two outcomes:

- Show the links again: remove the HTML comments, and check both blocks in the overlay.
- Leave them out: delete the two blocks and the `Support development on` key from every
  `app_i18n.json`.

Done looks like: the maintainer's choice is in this file's History, and the code, ADR-0001 and
AGENTS.md match it.

## History

- 2026-10-22: Found by a search for `patreon` in the repo. Filed when ADR-0001 and AGENTS.md were
  corrected to state that the links in the app are inside HTML comments.
