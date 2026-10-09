import { eloPrior as priorFromRatings, seriesWinProbability } from "@/lib/market/priors";
import { getBestOf, getEloForPlayer, getManifest, getPlayers } from "@/lib/services/stats";

import type { CreateMarketInput } from "./actions/market-admin";
import { S22_FINAL } from "./s22-final";

/**
 * Opening odds for one game of A vs B from current ELO, with the rating gap scaled to how ASL
 * games have gone (manifest.elo.probabilityScale). The ELO comes from ASL games only, so treat
 * it as a rough opener; the ledger also clamps every outcome to at least 2%.
 */
export function eloPrior(a: string, b: string): [number, number] {
  return priorFromRatings(
    getEloForPlayer(a)?.currentElo,
    getEloForPlayer(b)?.currentElo,
    eloScale(),
  );
}

/** How much of a rating gap to believe: see fit_probability_scale in the exporter. */
export function eloScale(): number {
  return getManifest().elo.probabilityScale;
}

/** The same for a best of N: the chance of winning the series, not one game. */
export function eloSeriesPrior(a: string, b: string, bestOf: number): [number, number] {
  const pa = seriesWinProbability(eloPrior(a, b)[0], bestOf);
  return [pa, 1 - pa];
}

/**
 * Current ELO by lowercased name and old spelling, for the form's "suggest odds" button. The
 * form runs in the browser, so it gets the ratings as plain data.
 */
export function eloRatings(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of getPlayers()) {
    const elo = getEloForPlayer(p.player)?.currentElo;
    if (elo === undefined) continue;
    for (const name of [p.player, ...p.aliases]) out[name.toLowerCase()] = elo;
  }
  return out;
}

export function s22FinalPreset(): CreateMarketInput {
  return {
    ...S22_FINAL,
    outcomes: S22_FINAL.outcomes.map((o) => ({ ...o })),
    prior: eloSeriesPrior("Rush", "Soulkey", getBestOf("final") ?? 7),
  };
}
