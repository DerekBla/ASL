"use client";

import { useEffect, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queries/query-keys";
import type { LeagueView } from "@/lib/services/draft";

const POLL_MS = { lobby: 4_000, drafting: 2_000 } as const;

async function fetchLeague(id: number): Promise<LeagueView> {
  const response = await fetch(`/api/drafts/${id}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`draft ${id} answered ${response.status}`);
  return (await response.json()) as LeagueView;
}

/** The league, polled while people are joining or drafting. Polling stops once it is drafted. */
export function useLeague(initial: LeagueView): UseQueryResult<LeagueView> {
  return useQuery({
    queryKey: queryKeys.drafts.detail(initial.id),
    queryFn: () => fetchLeague(initial.id),
    initialData: initial,
    staleTime: 0,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "lobby" || status === "drafting" ? POLL_MS[status] : false;
    },
  });
}

/**
 * Whole seconds left on a pick clock. The server's time at the last fetch corrects for a
 * browser clock that is off.
 */
export function useSecondsLeft(deadline: string, serverNow: string, fetchedAt: number): number {
  const skew = Date.parse(serverNow) - fetchedAt;
  const left = (): number =>
    Math.max(0, Math.ceil((Date.parse(deadline) - (Date.now() + skew)) / 1000));
  const [seconds, setSeconds] = useState(left);
  useEffect(() => {
    setSeconds(left());
    const timer = setInterval(() => setSeconds(left()), 250);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- left() only reads these three values
  }, [deadline, serverNow, fetchedAt]);
  return seconds;
}
