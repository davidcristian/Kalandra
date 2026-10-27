---
title: Suggested price
---

**Experimental.** Above the listings of a [price check](/price-check), the line **Suggested price:** shows one price
for the item, a range and how reliable they are. Kalandra works them out from the listings the search already got, so
the line sends no extra request to the trade site. It helps most with a rare, magic or normal item, which has no
[price estimate](/price-check#price-estimate) from poe.ninja. How Kalandra works out the price can change in later
versions.

## Turn it on

In Settings, **General** page, check **Enable experimental features**, then **Suggested price in the price check**
below it, and click **Save**. With it on, the price check also searches the trade site at once for a normal, magic or
rare item, as it does for a unique, so the line has listings to work from. The two toggles under **Perform an auto
search, when pressing** in the price check settings still turn that search off.

## What the line shows

For example: **Suggested price:** `~ 6 ex (5 ~ 8 ex)` **high reliability**, after a yellow exclamation mark.

- The price after `~`, in your primary base currency, or in Divine Orbs when the whole range is above one Divine Orb.
- The range in brackets: where most of the cheaper sellers ask.
- The reliability: **high reliability**, **medium reliability** or **low reliability**.
- **too few listings** when fewer than two sellers are left to count.

Point at the line to see that the feature is experimental, how many sellers the price counts and how many it left
out as likely price fixing.

## How Kalandra works it out

1. It values each listing in Divine Orbs, with the rates from Kalandra's price service that the values in brackets in
   the **Price** column use. It leaves out your own listings (found by **Account name**) and any listing in a
   currency the price file has no rate for.
2. It counts each seller once, at the seller's cheapest listing. A seller with 30 copies counts as one seller.
3. It leaves out a listing that you cannot buy at once and that asks for less than 40% of the median price. Such a
   listing is often price fixing: a low price whose seller does not reply to buyers. A listing you can buy at once
   always counts, since anyone can buy it at that price. The default listing type, **Instant**, shows only those.
4. The suggested price is the 25th percentile of the prices left: with 20 sellers, about the fifth cheapest. The range
   runs from the 10th to the 50th percentile.

| Reliability | When |
| --- | --- |
| **high** | 8 or more sellers, and the top of the range is at most 1.5 times its bottom |
| **medium** | 4 or more sellers, and the top of the range is at most 2.5 times its bottom |
| **low** | 2 or more sellers otherwise |

## Limits

- Listings are asking prices, not sales. An item can stay listed at its price for weeks without selling.
- The price is for the items your filters match. With fewer stat filters on, the listings include worse items and
  the price goes down; with more, the search can find too few. Change the filters and search again to compare.
- The window reads the 20 cheapest listings, and more, up to 100, when sellers list many copies. The suggested price
  uses only those.
- The line does not show for a stackable item, for a [bulk exchange](/price-check#bulk-exchange) search, or while
  the price file is not loaded, such as in a private league.
