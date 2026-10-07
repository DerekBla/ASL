"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queries/query-keys";
import type { TradeReceipt } from "@/lib/services/ledger";
import type { ActionResult } from "@/lib/types/result";

import { placeTrade } from "../actions/place-trade";
import type { PlaceTradeInput } from "../actions/place-trade";
import type { MarketView, MyMarketState } from "../types";

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return (await response.json()) as T;
}

/** The market, polled every 10 seconds while it is open (prices move when others trade). */
export function useMarket(slug: string): UseQueryResult<MarketView> {
  return useQuery({
    queryKey: queryKeys.markets.detail(slug),
    queryFn: () => getJson<MarketView>(`/api/markets/${encodeURIComponent(slug)}`),
    refetchInterval: (query) => (query.state.data?.status === "open" ? 10_000 : false),
  });
}

/** The viewer's balance and shares in this market. */
export function useMyMarket(slug: string): UseQueryResult<MyMarketState> {
  return useQuery({
    queryKey: queryKeys.me.market(slug),
    queryFn: () => getJson<MyMarketState>(`/api/me/markets/${encodeURIComponent(slug)}`),
  });
}

/** Places a trade, then refetches prices and holdings. No optimistic updates (money-8). */
export function usePlaceTrade(
  slug: string,
): UseMutationResult<ActionResult<TradeReceipt>, Error, PlaceTradeInput> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: PlaceTradeInput) => placeTrade(input),
    onSettled: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.markets.detail(slug) }),
        client.invalidateQueries({ queryKey: queryKeys.me.market(slug) }),
      ]);
    },
  });
}
