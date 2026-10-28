# The stash prices reader reads only the newest 100 listings of an account

**Status:** declined 2026-10-29
**Area:** trade
**Origin:** [renderer/src/web/stash-prices/stash-reader.ts](../../../../renderer/src/web/stash-prices/stash-reader.ts)
**Verified:** 2026-10-29

The reader searches every listing of the account without a price, sorted by the time the trade site
indexed it, and a search returns at most 100 ids with `total` the full count. When `total` is above
100, the reader reads the newest 100 and the panel says so. An item that sits in the price check tab
longer than 100 newer listings of the account is then dropped from the tab's listings. An account had
1373 listings without a price on 2026-10-28.

This waits for the maintainer's decision on how a check that reads more than 100 listings is paced.
Each check fetches every listing the search returns, 10 per request, because the search order does
not change when an item moves. The category list saved on 2026-10-25 has 10 categories, one of them
`sanctum.relic` without a parent, and 53 subcategories, 23 of them weapons. Five subcategories are
named "Any", such as `weapon.onemelee`, which suggests their listings are also in other subcategories.
A check of 1373 listings then sends 11 to 64 searches, by how they spread, and 138 fetch requests.
The site's limits of 2026-10-28, in `renderer/specs/web/stash-prices/fake-trade-site.ts`, allow 15
searches a minute, 60 in 5 minutes and 600 in 3 hours, and 100 fetches in 5 minutes and 1000 in 3
hours. At the 10 minute interval that is 198 to 1152 searches and 2484 fetches in 3 hours, against a
default budget of 400, and the user's price checks fail with `Retry after N seconds` while a check
fills a limit. The pricer also leaves only one search per check for the reader. The options include a
longer interval or a fetch budget for such a check, a pause between its searches as the pricer has,
and fetching every place again only for the newest 100 listings.

Done looks like: the maintainer's choice is in the History and in
[ADR-0012](../../adr/ADR-0012-background-trade-searches.md). When `total` is above 100, the reader
splits the search by item category, with `type_filters` and the categories of
`/api/trade2/data/filters`, so that each search returns at most 100, and splits a category that still
has more by its subcategories. Every search counts against the search budget, so the split runs only
when `total` is above 100, and the panel shows how many searches one check sends. Read the category
list from the site's data once, not from a list in the code.

## History

- 2026-10-28: Left out of the first version of stash prices, which shows "only the newest 100 are read"
  instead.
- 2026-10-28: Checked against the code and left open: the split waits for the decision above, since
  at the default settings its searches and fetches for an account of 1373 listings exceed the search
  budget and the site's fetch limit.
- 2026-10-29: Declined. The maintainer chose to keep reading the newest 100 listings, since a split
  costs more searches and fetches a check than the site allows. The panel now tells the user to price
  the items in their other public tabs, or make those tabs private, to read them all.
