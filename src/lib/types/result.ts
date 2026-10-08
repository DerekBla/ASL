/**
 * Error model (ts-4): expected failures are values, not exceptions.
 *
 * Services return Result<T, E>. Server Actions return ActionResult<T>, which is what reaches
 * the browser. Both are `{ data } | { error }` so callers narrow with `"error" in result`.
 */

export type Result<T, E> = { data: T } | { error: E };

export function ok<T>(data: T): { data: T } {
  return { data };
}

export function err<E>(error: E): { error: E } {
  return { error };
}

/** Business rejections from the ledger. Each has user-facing copy in ACTION_ERROR_MESSAGES. */
export type LedgerErrorCode =
  | "NOT_FOUND"
  | "MARKET_CLOSED"
  | "MARKET_NOT_OPEN"
  | "INSUFFICIENT_FUNDS"
  | "INSUFFICIENT_SHARES"
  | "SLIPPAGE"
  | "PRICE_LIMIT"
  | "INVALID_TRADE"
  | "INVALID_MARKET"
  | "ALREADY_SETTLED";

export type LedgerError = { code: LedgerErrorCode; message?: string };

/** Business rejections from the pick'em service. */
export type PickemErrorCode =
  "PICKEM_NOT_FOUND" | "PICKEM_LOCKED" | "PICKEM_HAS_ENTRIES" | "INVALID_PICKS" | "INVALID_PICKEM";

export type PickemError = { code: PickemErrorCode; message?: string };

export type ActionErrorCode =
  | LedgerErrorCode
  | PickemErrorCode
  | "INVALID_INPUT"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "MARKETS_DISABLED"
  | "TEMPORARY_FAILURE";

export type ActionError = { code: ActionErrorCode; message?: string };

export type ActionResult<T> = { data: T } | { error: ActionError };

/** Copy shown to users for each error code. Minerals, never money words (conventions). */
export const ACTION_ERROR_MESSAGES: Record<ActionErrorCode, string> = {
  NOT_FOUND: "That market doesn't exist.",
  MARKET_CLOSED: "This market is closed to trading.",
  MARKET_NOT_OPEN: "This market isn't open.",
  INSUFFICIENT_FUNDS: "You don't have enough minerals for that trade.",
  INSUFFICIENT_SHARES: "You can only sell shares you hold.",
  SLIPPAGE: "The price moved before your trade went through. Check the new price and try again.",
  PRICE_LIMIT: "That trade would push the price past 0.1% or 99.9%. Try a smaller amount.",
  INVALID_TRADE: "That trade amount isn't valid.",
  INVALID_MARKET: "That market setup isn't valid.",
  ALREADY_SETTLED: "This market has already been resolved or voided.",
  PICKEM_NOT_FOUND: "That pick'em doesn't exist.",
  PICKEM_LOCKED: "Brackets are locked. The season has started.",
  PICKEM_HAS_ENTRIES: "Brackets are already in, so the players and rounds can't change.",
  INVALID_PICKS: "Those picks don't fit the bracket.",
  INVALID_PICKEM: "That pick'em setup isn't valid.",
  INVALID_INPUT: "Something in the request wasn't valid.",
  UNAUTHENTICATED: "Sign in to trade.",
  FORBIDDEN: "Only admins can do that.",
  MARKETS_DISABLED: "Markets aren't switched on yet.",
  TEMPORARY_FAILURE: "Something went wrong on our side. Your minerals are safe; try again.",
};
