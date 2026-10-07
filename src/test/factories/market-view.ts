import type { MarketView, MyMarketState } from "@/features/markets/types";

/** A 50/50 binary market view, as the API returns it. */
export function makeMarketView(overrides: Partial<MarketView> = {}): MarketView {
  return {
    id: 1,
    slug: "asl-s22-final-rush-vs-soulkey",
    question: "Who wins the ASL Season 22 Grand Final: Rush or Soulkey?",
    status: "open",
    closesAt: "2026-10-17T06:00:00.000Z",
    season: 22,
    resolvedOutcome: null,
    outcomes: [
      { idx: 0, label: "Rush", player: "Rush", price: 0.5 },
      { idx: 1, label: "Soulkey", player: "Soulkey", price: 0.5 },
    ],
    volume: 0,
    traders: 0,
    description: "",
    b: 10,
    resolutionNote: null,
    resolvedAt: null,
    recentTrades: [],
    history: [{ at: "2026-10-08T00:00:00.000Z", prices: [0.5, 0.5] }],
    ...overrides,
  };
}

export function makeMyMarket(overrides: Partial<MyMarketState> = {}): MyMarketState {
  return { signedIn: true, balance: 100, shares: {}, ...overrides };
}
