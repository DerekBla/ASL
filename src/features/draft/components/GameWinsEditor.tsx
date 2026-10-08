"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ReactElement } from "react";

import type { GameWins } from "@/lib/draft/draft";
import { ACTION_ERROR_MESSAGES } from "@/lib/types/result";

import { Button } from "@/components/Button";

import { fetchGameWinsAction, saveGameWinsAction } from "../actions/draft";

type Props = {
  season: number;
  players: readonly string[];
  gameWins: GameWins;
};

/**
 * Admin: each player's game wins this season, which fantasy drafts score on. The numbers can
 * be fetched from the season's Liquipedia page, then checked and saved.
 */
export function GameWinsEditor({ season, players, gameWins }: Props): ReactElement {
  const router = useRouter();
  const [wins, setWins] = useState<Record<string, string>>(() =>
    Object.fromEntries(players.map((p) => [p, String(gameWins[p] ?? 0)])),
  );
  const [page, setPage] = useState(`ASL/${season}`);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function fetchFromLiquipedia(): void {
    startTransition(async () => {
      const result = await fetchGameWinsAction({ season, page });
      if ("error" in result) {
        setMessage(result.error.message ?? ACTION_ERROR_MESSAGES[result.error.code]);
        return;
      }
      const { gameWins: fetched, games, series, unmatched } = result.data;
      setWins(Object.fromEntries(players.map((p) => [p, String(fetched[p] ?? 0)])));
      const skipped =
        unmatched.length === 0
          ? ""
          : ` Not matched to a player of this season: ${unmatched.map((u) => `${u.name} (${u.wins})`).join(", ")}.`;
      setMessage(
        `Found ${games} games in ${series} series on Liquipedia.${skipped} Check the numbers, then save.`,
      );
    });
  }

  function save(): void {
    const numbers = Object.fromEntries(players.map((p) => [p, Number(wins[p] ?? 0)]));
    startTransition(async () => {
      const result = await saveGameWinsAction({ season, gameWins: numbers });
      if ("error" in result) {
        setMessage(result.error.message ?? ACTION_ERROR_MESSAGES[result.error.code]);
        return;
      }
      setMessage("Game wins saved. Draft standings are updated.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-caption">
          Liquipedia page title for this season
          <input value={page} onChange={(e) => setPage(e.target.value)} className="field" />
        </label>
        <Button variant="secondary" disabled={pending} onClick={fetchFromLiquipedia}>
          {pending ? "Working…" : "Fetch game wins from Liquipedia"}
        </Button>
      </div>
      <fieldset className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <legend className="pb-1 text-caption font-semibold">Games won so far</legend>
        {players.map((p) => (
          <label key={p} className="flex items-center justify-between gap-2 text-data">
            {p}
            <input
              type="number"
              min={0}
              max={999}
              value={wins[p] ?? "0"}
              onChange={(e) => setWins({ ...wins, [p]: e.target.value })}
              className="field w-16 px-1.5 py-1 text-right"
            />
          </label>
        ))}
      </fieldset>
      <div>
        <Button disabled={pending} onClick={save}>
          Save game wins
        </Button>
      </div>
      {message ? (
        <p role="status" className="notice text-caption">
          {message}
        </p>
      ) : null}
    </div>
  );
}
