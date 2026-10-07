import { create } from "zustand";

/**
 * Trade panel UI state only (state.md): which outcome, buy or sell, the typed amount.
 * Prices, balances and positions never live here; they come from TanStack Query.
 */
type TradePanelState = {
  selectedOutcome: number;
  side: "buy" | "sell";
  amount: string;
  selectOutcome: (idx: number) => void;
  setSide: (side: "buy" | "sell") => void;
  setAmount: (amount: string) => void;
  reset: () => void;
};

const initial = { selectedOutcome: 0, side: "buy" as const, amount: "" };

export const useTradePanelStore = create<TradePanelState>()((set) => ({
  ...initial,
  selectOutcome: (idx) => set({ selectedOutcome: idx }),
  setSide: (side) => set({ side, amount: "" }),
  setAmount: (amount) => set({ amount }),
  reset: () => set(initial),
}));
