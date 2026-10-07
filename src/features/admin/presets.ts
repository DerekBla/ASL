import { DEFAULT_B_BINARY } from "@/lib/config/site";
import { getEloForPlayer } from "@/lib/services/stats";

import type { CreateMarketInput } from "./actions/market-admin";

/**
 * Opening probability for A beating B from current ELO (market-engine.md):
 * P(A) = 1 / (1 + 10^((R_B - R_A) / 400)). The ELO is placement-based, so treat it as a
 * rough opener; the ledger also clamps every outcome to at least 2%.
 */
export function eloPrior(a: string, b: string): [number, number] {
  const ra = getEloForPlayer(a)?.currentElo;
  const rb = getEloForPlayer(b)?.currentElo;
  if (ra === undefined || rb === undefined) return [0.5, 0.5];
  const pa = 1 / (1 + 10 ** ((rb - ra) / 400));
  return [pa, 1 - pa];
}

/**
 * Derek's first market (2026-10-07): the ASL Season 22 Grand Final, Rush vs Soulkey, at
 * Lotte World Ice Rink. Liquipedia (ASL/22) lists the final at 15:00 KST on October 17; the
 * page's match entry says 2025, a typo next to the season's 2026-10-17 end date.
 */
export function s22FinalPreset(): CreateMarketInput {
  return {
    slug: "asl-s22-final-rush-vs-soulkey",
    question: "Who wins the ASL Season 22 Grand Final: Rush or Soulkey?",
    description:
      "Best-of-seven grand final at Lotte World Ice Rink, Seoul. Resolves to the player who wins the series. " +
      "Voided if the final is cancelled or not played. Source: Liquipedia, ASL Season 22.",
    b: DEFAULT_B_BINARY,
    closesAt: "2026-10-17T06:00:00.000Z",
    outcomes: [
      { label: "Rush", player: "Rush" },
      { label: "Soulkey", player: "Soulkey" },
    ],
    prior: eloPrior("Rush", "Soulkey"),
    season: 22,
  };
}
