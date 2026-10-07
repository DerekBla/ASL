/**
 * Branded IDs (ts-5): a MarketId can't be passed where a UserId is expected.
 *
 * Market ids are bigserial in Postgres but read as JS numbers (Drizzle `mode: "number"`):
 * they stay far below 2^53 and serialize to JSON for the browser without extra handling.
 */

export type MarketId = number & { readonly __brand: "MarketId" };
export type UserId = string & { readonly __brand: "UserId" };
export type AccountId = number & { readonly __brand: "AccountId" };
export type TradeId = number & { readonly __brand: "TradeId" };

export function marketId(id: number): MarketId {
  if (!Number.isSafeInteger(id) || id <= 0) throw new RangeError(`invalid market id ${id}`);
  return id as MarketId;
}

/** Clerk user ids, e.g. "user_2abc…". */
export function userId(id: string): UserId {
  if (id.length === 0) throw new RangeError("empty user id");
  return id as UserId;
}

export function accountId(id: number): AccountId {
  return id as AccountId;
}

export function tradeId(id: number): TradeId {
  return id as TradeId;
}
