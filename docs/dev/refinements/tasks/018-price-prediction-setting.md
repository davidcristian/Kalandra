# Decide what happens to the poeprices price prediction setting

**Status:** done 2026-10-26
**Area:** trade
**Origin:** [renderer/src/web/price-check/CheckedItem.vue](../../../../renderer/src/web/price-check/CheckedItem.vue)
**Verified:** 2026-10-26

Settings, Price check shows the checkbox `Show price prediction` with `www.poeprices.info`, bound to
`requestPricePrediction` in the price check widget config and off by default. The
`<price-prediction>` element in `CheckedItem.vue` is commented out, so the checkbox changes nothing.
`CheckedItem.vue` still imports `PricePrediction` and lists it in `components`.
`requestPoeprices` in `price-prediction/poeprices.ts` is called only from `PricePrediction.vue`,
which nothing renders, and `www.poeprices.info` is still in `PROXY_HOSTS` in `main/src/proxy.ts`.
[docs/price-check.md](../../../price-check.md) leaves the setting out.

This is a decision for the maintainer, with two outcomes:

- Restore the component, after checking that poeprices returns prices for Path of Exile 2 items
  and that `requestPoeprices` converts a price in Exalted Orbs correctly. The request goes to a
  live site, so it needs the maintainer's go-ahead ([AGENTS.md](../../../../AGENTS.md#safety)),
  and the user page then documents the setting. Its
  English text moves into `app_i18n.json`, `price-prediction/` leaves `SKIPPED_DIRS` in
  `renderer/specs/web/template-text.test.ts`, and the Acknowledgments in the README credit
  poeprices.info again.
- Remove the checkbox, the `price-prediction/` folder, the import in `CheckedItem.vue` and the
  proxy host. Removing `requestPricePrediction` from the widget config type follows the hard rule
  in [AGENTS.md](../../../../AGENTS.md#the-one-hard-rule), and
  [ADR-0005](../../adr/ADR-0005-proxy-hosts-and-trade-rate-limits.md) lists the hosts.

Done looks like: the maintainer's choice is in this file's History, and the code, the user page
and ADR-0005 match it.

## History

- 2026-10-18: Found while docs/price-check.md was rewritten, and again in the renderer and ADR
  reviews, by reading `CheckedItem.vue` and searching for callers of `requestPoeprices`.
- 2026-10-26: Checked again. The README no longer credits poeprices.info, since the app sends it
  no request.
- 2026-10-26: The conversion check was added here from a FIXME comment in `requestPoeprices`,
  which was removed.
- 2026-10-26: Done. The maintainer chose to remove the price prediction, since poeprices.info
  serves Path of Exile 1 and nothing shows that it supports Path of Exile 2. The checkbox, its
  `show_prediction` text, the `price-prediction/` folder and `requestPricePrediction` left the
  renderer, and saved configs keep that key unread. `www.poeprices.info` left `PROXY_HOSTS` and
  ADR-0005.
