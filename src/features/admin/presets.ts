import { eloPrior as priorFromRatings } from "@/lib/market/priors";
import { getEloForPlayer } from "@/lib/services/stats";

import type { CreateMarketInput } from "./actions/market-admin";
import { S22_FINAL } from "./s22-final";

/**
 * Opening odds for A vs B from current ELO. The ELO is placement-based, so treat it as a rough
 * opener; the ledger also clamps every outcome to at least 2%.
 */
export function eloPrior(a: string, b: string): [number, number] {
  return priorFromRatings(getEloForPlayer(a)?.currentElo, getEloForPlayer(b)?.currentElo);
}

export function s22FinalPreset(): CreateMarketInput {
  return {
    ...S22_FINAL,
    outcomes: S22_FINAL.outcomes.map((o) => ({ ...o })),
    prior: eloPrior("Rush", "Soulkey"),
  };
}
