export type {
  MarketSummary,
  MarketView,
  OutcomeView,
  TradeView,
} from "@/lib/services/markets-read";

/** The viewer's balance and holdings in one market (GET /api/me/markets/[slug]). */
export type MyMarketState = {
  signedIn: boolean;
  balance: number | null;
  /** Shares held per outcome index in this market. */
  shares: Record<number, number>;
};
