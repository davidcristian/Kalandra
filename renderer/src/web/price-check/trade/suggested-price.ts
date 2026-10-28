/** Works out a suggested price, its range and how reliable it is from the listings of a trade search. */

import {
  DivCurrency,
  displayRounding,
  usePoeninja,
} from "@/web/background/Prices";

export interface PricedListing {
  priceDivines?: number;
  accountName: string;
  isMine: boolean;
  isInstantBuyout: boolean;
}

export type Reliability = "high" | "medium" | "low";

/** The `app_i18n.json` key and the text color of each reliability, as the suggested price line shows them. */
export const RELIABILITY_TEXT: Record<
  Reliability,
  { key: string; class: string }
> = {
  high: { key: "trade_result.reliability_high", class: "text-green-500" },
  medium: { key: "trade_result.reliability_medium", class: "text-yellow-500" },
  low: { key: "trade_result.reliability_low", class: "text-orange-500" },
};

export interface SuggestedPrice {
  /** The suggested price, in Divine Orbs. */
  price: number;
  low: number;
  high: number;
  reliability: Reliability;
  /** How many sellers the price counts, one listing each. */
  sellers: number;
  /** How many sellers were left out as likely price fixing. */
  leftOut: number;
}

/** A listing that is not instant buyout and costs less than this share of the median is likely price fixing. */
const PRICE_FIXING_SHARE = 0.4;
const MIN_SELLERS = 3;

/** Returns the value of a listing price in Divine Orbs, or undefined when the price file has no rate for it. */
export function inDivines(
  price: { amount: number; currency: string } | undefined,
  rate: { primaryValue: number } | null,
): number | undefined {
  if (!price || price.amount <= 0) return undefined;
  if (price.currency === "divine") return price.amount;
  return rate ? rate.primaryValue * price.amount : undefined;
}

/** Returns null when fewer than three sellers remain after the cleaning. */
export function suggestPrice(
  listings: readonly PricedListing[],
): SuggestedPrice | null {
  const bySeller = new Map<string, PricedListing & { priceDivines: number }>();
  for (const listing of listings) {
    const price = listing.priceDivines;
    if (listing.isMine || price === undefined || price <= 0) continue;
    const cheapest = bySeller.get(listing.accountName);
    if (!cheapest || price < cheapest.priceDivines) {
      bySeller.set(listing.accountName, { ...listing, priceDivines: price });
    }
  }

  const sellers = [...bySeller.values()].sort(
    (a, b) => a.priceDivines - b.priceDivines,
  );
  const median = percentile(
    sellers.map((seller) => seller.priceDivines),
    0.5,
  );
  const keptSellers = sellers.filter(
    (seller) =>
      seller.isInstantBuyout ||
      seller.priceDivines >= median * PRICE_FIXING_SHARE,
  );
  const kept = keptSellers.map((seller) => seller.priceDivines);
  if (kept.length < MIN_SELLERS) return null;

  // A comparable item that anyone can buy at once caps what a buyer pays
  const price =
    keptSellers.find((seller) => seller.isInstantBuyout)?.priceDivines ??
    kept[0];
  const low = kept[0];
  const high = Math.max(percentile(kept, 0.25), price);
  return {
    price,
    low,
    high,
    reliability: reliability(kept.length, high / low),
    sellers: kept.length,
    leftOut: sellers.length - kept.length,
  };
}

/** Writes the price and range in Divine Orbs when the whole range is above one, else in the core currency. */
export function suggestedPriceText(
  suggested: Pick<SuggestedPrice, "price" | "low" | "high">,
): {
  price: string;
  range: string;
} {
  const { autoCurrency, xchgRateCurrency } = usePoeninja();
  const range = autoCurrency([suggested.low, suggested.high]);
  const price = autoCurrency(
    [suggested.price, suggested.price],
    range.currency !== "div",
  );
  const abbrev =
    range.currency === "div"
      ? DivCurrency.abbrev
      : (xchgRateCurrency.value?.abbrev ?? "");
  return {
    price: `${displayRounding(price.min)} ${abbrev}`,
    range: `${displayRounding(range.min)} ~ ${displayRounding(range.max)} ${abbrev}`,
  };
}

function reliability(sellers: number, spread: number): Reliability {
  if (sellers >= 8 && spread <= 1.5) return "high";
  if (sellers >= 4 && spread <= 2.5) return "medium";
  return "low";
}

/** Returns the value at share `p` of a list sorted from low to high, between its two nearest values. */
function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const position = (sorted.length - 1) * p;
  const below = Math.floor(position);
  const above = Math.min(below + 1, sorted.length - 1);
  return sorted[below] + (sorted[above] - sorted[below]) * (position - below);
}
