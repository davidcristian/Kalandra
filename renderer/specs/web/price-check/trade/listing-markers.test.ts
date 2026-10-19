import { describe, expect, it } from "vitest";
import { listingMarkers } from "@/web/price-check/trade/listing-markers";

const MARKED = { isMine: true, inDemand: true, gone: true };
const ALL = { you: true, inDemand: true, gone: true };
const NONE = { you: false, inDemand: false, gone: false };

describe("listingMarkers", () => {
  it("shows the markers after the listed time when the Seller column is hidden", () => {
    expect(listingMarkers(MARKED, false)).toEqual({
      listed: ALL,
      seller: NONE,
    });
  });

  it.each(["account", "ign"] as const)(
    "shows the markers after the seller when Show seller is %s",
    (showSeller) => {
      expect(listingMarkers(MARKED, showSeller)).toEqual({
        listed: NONE,
        seller: ALL,
      });
    },
  );

  it("shows Gone after the seller for a listing with no other marker", () => {
    expect(listingMarkers({ isMine: false, gone: true }, "account")).toEqual({
      listed: NONE,
      seller: { you: false, inDemand: false, gone: true },
    });
  });

  it("shows no marker for a listing the trade site does not mark", () => {
    expect(listingMarkers({ isMine: false }, undefined)).toEqual({
      listed: NONE,
      seller: NONE,
    });
  });
});
