import type { PriceCheckWidget } from "@/web/overlay/widgets";
import type { PricingResult } from "./pathofexile-trade";

export interface ListingMarkers {
  you: boolean;
  inDemand: boolean;
  gone: boolean;
}

const NONE: ListingMarkers = { you: false, inDemand: false, gone: false };

/** Returns the markers shown after a listing's listed time, or after its seller when the Seller column shows. */
export function listingMarkers(
  listing: Pick<PricingResult, "isMine" | "inDemand" | "gone">,
  showSeller: PriceCheckWidget["showSeller"] | undefined,
): { listed: ListingMarkers; seller: ListingMarkers } {
  const markers: ListingMarkers = {
    you: listing.isMine,
    inDemand: listing.inDemand === true,
    gone: listing.gone === true,
  };
  return showSeller
    ? { listed: NONE, seller: markers }
    : { listed: markers, seller: NONE };
}
