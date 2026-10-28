# The stash prices reader reads only the newest 100 listings of an account

**Status:** open
**Area:** trade
**Origin:** [renderer/src/web/stash-prices/stash-reader.ts](../../../../renderer/src/web/stash-prices/stash-reader.ts)
**Verified:** 2026-10-28

The reader searches every listing of the account without a price, sorted by the time the trade site
indexed it, and a search returns at most 100 ids with `total` the full count. When `total` is above
100, the reader reads the newest 100 and the panel says so. An item that sits in the price check tab
longer than 100 newer listings of the account is then dropped from the tab's listings. An account had
1373 listings without a price on 2026-10-28.

Done looks like: when `total` is above 100, the reader splits the search by item category, with
`type_filters` and the categories of `/api/trade2/data/filters`, so that each search returns at most
100, and splits a category that still has more by its subcategories. Every search counts against the
search budget, so the split runs only when `total` is above 100, and the panel shows how many searches
one check sends. Read the category list from the site's data once, not from a list in the code.

## History

- 2026-10-28: Left out of the first version of stash prices, which shows "only the newest 100 are read"
  instead.
