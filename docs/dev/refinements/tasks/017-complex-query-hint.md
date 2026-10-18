# The complex query hint names a setting that does not exist

**Status:** open
**Area:** trade
**Origin:** [renderer/src/web/price-check/trade/TradeListing.vue](../../../../renderer/src/web/price-check/trade/TradeListing.vue)
**Verified:** 2026-10-18

When an item search fails with an error that starts with `Query is too complex.`, `errorFix` in
`TradeListing.vue` shows `trade_result.fix_complex_query`. The English `app_i18n.json` gives it as
`Disable "Use pseudo mods" in settings or log in with builtin browser`. Settings, Price check has no
such option: `settings-price-check.vue` renders no checkbox for it, and no file in `renderer/src/`
uses the key `price_check.use_pseudo`. [docs/complex-query.md](../../../complex-query.md) tells the
reader that Kalandra has no such setting.

The translations of `fix_complex_query` in seven other `app_i18n.json` files name the same setting.
`price_check.use_pseudo` is in nine of the ten files; `ko` has neither key.

Done looks like: the English hint names only what works, signing in to the trade site in the
built-in browser. The old translations of `fix_complex_query` are removed, so those languages show
the English hint until a speaker translates it. `price_check.use_pseudo` is removed from every
`app_i18n.json`, and docs/complex-query.md drops its note in the same commit.

## History

- 2026-10-18: Found while docs/complex-query.md was rewritten, by searching `renderer/src/` for the
  setting the hint names.
