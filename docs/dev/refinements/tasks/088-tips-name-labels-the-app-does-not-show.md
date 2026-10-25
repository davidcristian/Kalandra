# Two tips name controls by labels the app does not show

**Status:** open
**Area:** renderer
**Origin:** [renderer/public/data/en/app_i18n.json](../../../../renderer/public/data/en/app_i18n.json)
**Verified:** 2026-10-25

The English tips quote the labels of the controls they describe, so the user can look for them.
Two tips quote labels that no UI text of the app has:

- `tips.tip_11` names "Auto-hide off" in the settings. The hotkey row in Settings, Hotkeys is
  "Open without auto-hide" (`price_check.hotkey_locked`).
- `tips.tip_14` names "Online filter" and "Exalted only". The button that
  `price-check/trade/OnlineFilter.vue` draws shows the listing type, such as "Online", and its
  currency option is "Exalted Orbs" (`online_filter.currency_only_exalted`).

The translations of both tips quote the same labels in their language. `LISTED_MISMATCHES` in
`renderer/specs/web/tips.test.ts` lists the three names, so the test that each quoted name is a
UI text passes until the tips change.

Done looks like: both English tips name the labels the app shows, the three names removed from
`LISTED_MISMATCHES`, and the translations updated by someone who speaks each language.

## History

- 2026-10-25: Found when a test compared the names the English tips quote with the UI text.
