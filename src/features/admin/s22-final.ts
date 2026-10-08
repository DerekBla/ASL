/**
 * Derek's first market (2026-10-07): the ASL Season 22 Grand Final, Rush vs Soulkey, at
 * Lotte World Ice Rink. Liquipedia (ASL/22) lists the final at 15:00 KST on October 17; the
 * page's match entry says 2025, a typo next to the season's 2026-10-17 end date.
 *
 * No server-only imports, so scripts/db/go-live.ts can use it too.
 */
import { DEFAULT_B_BINARY } from "@/lib/config/site";

export const S22_FINAL = {
  slug: "asl-s22-final-rush-vs-soulkey",
  question: "Who wins the ASL Season 22 Grand Final: Rush or Soulkey?",
  description:
    "Best of seven grand final at Lotte World Ice Rink, Seoul. Resolves to the player who wins the series. " +
    "Voided if the final is cancelled or not played. Source: Liquipedia, ASL Season 22.",
  b: DEFAULT_B_BINARY,
  closesAt: "2026-10-17T06:00:00.000Z",
  outcomes: [
    { label: "Rush", player: "Rush" },
    { label: "Soulkey", player: "Soulkey" },
  ],
  season: 22,
} as const;
