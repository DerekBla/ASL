"use client";

import { useState } from "react";
import type { ReactElement } from "react";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queries/query-keys";

async function getNames(): Promise<string[]> {
  const response = await fetch("/api/players");
  if (!response.ok) throw new Error(`/api/players answered ${response.status}`);
  return (await response.json()) as string[];
}

/**
 * The header's player search. A plain GET form to /search, which opens the player when the
 * text matches one and lists the matches otherwise, so it works without JavaScript. With it,
 * the names load when the box is first used and the browser suggests them.
 */
export function PlayerSearch(): ReactElement {
  const [used, setUsed] = useState(false);
  const { data } = useQuery({
    queryKey: queryKeys.players.names,
    queryFn: getNames,
    enabled: used,
    staleTime: Infinity,
  });
  return (
    <form action="/search" method="get" role="search" aria-label="Find a player">
      <label htmlFor="player-search" className="sr-only">
        Find a player
      </label>
      <input
        id="player-search"
        name="q"
        type="search"
        list="player-search-names"
        placeholder="Find a player"
        required
        autoComplete="off"
        onFocus={() => setUsed(true)}
        className="w-36 rounded border border-transparent bg-card px-2 py-1 text-data text-ink outline-none placeholder:text-ink-muted focus:border-nav-hover focus:ring-2 focus:ring-nav-hover/60"
      />
      <datalist id="player-search-names">
        {(data ?? []).map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <button type="submit" className="sr-only">
        Search
      </button>
    </form>
  );
}
