import { describe, expect, it } from "vitest";
import {
  inDivines,
  PricedListing,
  suggestPrice,
} from "@/web/price-check/trade/suggested-price";

function listing(
  priceDivines: number | undefined,
  accountName: string,
  change: Partial<PricedListing> = {},
): PricedListing {
  return {
    priceDivines,
    accountName,
    isMine: false,
    isInstantBuyout: true,
    ...change,
  };
}

/** One instant buyout listing for each price, each from its own seller. */
function sellers(...prices: number[]): PricedListing[] {
  return prices.map((price, i) => listing(price, `seller-${i}`));
}

describe("inDivines", () => {
  it("multiplies the amount by the rate of its currency", () => {
    const price = { amount: 4, currency: "alch" };

    expect(inDivines(price, { primaryValue: 0.25 })).toBe(1);
  });

  it("takes a Divine Orb price as it is, with or without a rate", () => {
    expect(inDivines({ amount: 3, currency: "divine" }, null)).toBe(3);
  });

  it("returns undefined without a rate, a price or a positive amount", () => {
    const rate = { primaryValue: 1 };

    expect(inDivines({ amount: 2, currency: "vaal" }, null)).toBeUndefined();
    expect(inDivines(undefined, rate)).toBeUndefined();
    expect(inDivines({ amount: 0, currency: "alch" }, rate)).toBeUndefined();
  });
});

describe("suggestPrice", () => {
  it("takes the 25th percentile as the price and the 10th to 50th as the range", () => {
    expect(suggestPrice(sellers(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11))).toEqual({
      price: 3.5,
      low: 2,
      high: 6,
      reliability: "low",
      sellers: 11,
      leftOut: 0,
    });
  });

  it("counts each seller once, at the seller's cheapest listing", () => {
    const listings = [
      listing(5, "many"),
      listing(2, "many"),
      listing(9, "many"),
      listing(4, "other"),
    ];

    expect(suggestPrice(listings)).toMatchObject({
      low: 2.2,
      high: 3,
      sellers: 2,
    });
  });

  it("leaves out the user's own listings and listings without a value", () => {
    const listings = [
      listing(0.5, "me", { isMine: true }),
      listing(undefined, "unknown currency"),
      listing(0, "no price"),
      ...sellers(2, 2),
    ];

    expect(suggestPrice(listings)).toMatchObject({ price: 2, sellers: 2 });
  });

  it("leaves out a cheap listing that is not instant buyout, but keeps a cheap instant one", () => {
    const fixer = listing(1, "fixer", { isInstantBuyout: false });
    const instant = listing(1, "instant");
    const rest = sellers(10, 10, 10, 10);

    expect(suggestPrice([fixer, ...rest])).toMatchObject({
      low: 10,
      sellers: 4,
      leftOut: 1,
    });
    expect(suggestPrice([instant, ...rest])).toMatchObject({
      sellers: 5,
      leftOut: 0,
    });
  });

  it("keeps a listing that is not instant buyout at 40% of the median", () => {
    const listings = [
      listing(4, "online", { isInstantBuyout: false }),
      ...sellers(10, 10),
    ];

    expect(suggestPrice(listings)).toMatchObject({ sellers: 3, leftOut: 0 });
  });

  it("returns null for fewer than two sellers", () => {
    expect(suggestPrice([])).toBeNull();
    expect(suggestPrice([listing(3, "only"), listing(4, "only")])).toBeNull();
    const fixer = listing(1, "fixer", { isInstantBuyout: false });
    expect(suggestPrice([fixer, listing(10, "seller")])).toBeNull();
  });

  it("rates high from 8 sellers whose range top is at most 1.5 times its bottom", () => {
    const tight = sellers(10, 10, 10, 15, 15, 15, 15, 15);
    const wider = sellers(10, 10, 10, 15.1, 15.1, 15.1, 15.1, 15.1);

    expect(suggestPrice(tight)?.reliability).toBe("high");
    expect(suggestPrice(wider)?.reliability).toBe("medium");
    expect(suggestPrice(tight.slice(1))?.reliability).toBe("medium");
  });

  it("rates medium from 4 sellers whose range top is at most 2.5 times its bottom", () => {
    expect(suggestPrice(sellers(10, 10, 40, 40))?.reliability).toBe("medium");
    expect(suggestPrice(sellers(10, 10, 40.2, 40.2))?.reliability).toBe("low");
    expect(suggestPrice(sellers(10, 10, 10))?.reliability).toBe("low");
  });
});
