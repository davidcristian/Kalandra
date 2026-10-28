import { TradeResponseError } from "@/web/price-check/trade/trade-response";

/** A trade site fetch result with the fields `readListing` checks; the other fields stay as the site sent them. */
export interface StashFetchResult {
  id: string;
  item: Record<string, unknown> & { id: string; w: number; h: number };
  listing: Record<string, unknown> & {
    indexed: string;
    stash: { name: string; x: number; y: number };
  };
}

/** One listing of the user's account without a price, read from a fetch result. */
export interface StashListing {
  id: string;
  itemId: string;
  name: string;
  typeLine: string;
  baseType: string;
  rarity: string;
  stashName: string;
  x: number;
  y: number;
  w: number;
  h: number;
  indexed: string;
  raw: StashFetchResult;
}

/** The part of a search response the reader uses: the query id, the listing ids in order and the full count. */
export interface StashSearch {
  queryId: string;
  ids: string[];
  total: number;
}

/** Returns the search for every listing of the account that has no price, newest first. */
export function stashSearchBody(accountName: string) {
  return {
    query: {
      status: { option: "any" },
      filters: {
        trade_filters: {
          filters: {
            account: { input: accountName },
            sale_type: { option: "unpriced" },
          },
        },
      },
    },
    sort: { indexed: "desc" },
  };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Returns the query id, ids and total of a search response, and throws a TradeResponseError for another shape. */
export function readSearch(data: unknown, status: number): StashSearch {
  if (
    isRecord(data) &&
    typeof data.id === "string" &&
    Array.isArray(data.result) &&
    data.result.every((id) => typeof id === "string") &&
    isCount(data.total)
  ) {
    return { queryId: data.id, ids: data.result, total: data.total };
  }
  throw new TradeResponseError(
    "The trade site sent a search result without a query id, listing ids or a total.",
    status,
  );
}

function isStashFetchResult(value: unknown): value is StashFetchResult {
  if (!isRecord(value) || !isRecord(value.item) || !isRecord(value.listing)) {
    return false;
  }
  const { item, listing } = value;
  const stash = listing.stash;
  return (
    typeof value.id === "string" &&
    typeof item.id === "string" &&
    isCount(item.w) &&
    isCount(item.h) &&
    typeof listing.indexed === "string" &&
    isRecord(stash) &&
    typeof stash.name === "string" &&
    isCount(stash.x) &&
    isCount(stash.y)
  );
}

/** Returns the listing of a fetch result, or undefined when the result lacks a field the reader needs. */
export function readListing(result: unknown): StashListing | undefined {
  if (!isStashFetchResult(result)) return undefined;
  const { item, listing } = result;
  return {
    id: result.id,
    itemId: item.id,
    name: text(item.name),
    typeLine: text(item.typeLine),
    baseType: text(item.baseType),
    rarity: text(item.rarity),
    stashName: listing.stash.name,
    x: listing.stash.x,
    y: listing.stash.y,
    w: item.w,
    h: item.h,
    indexed: listing.indexed,
    raw: result,
  };
}
