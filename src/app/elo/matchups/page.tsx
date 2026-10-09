import type { Metadata } from "next";
import type { ReactElement } from "react";

import { MatchupRatings } from "@/features/stats";

export const metadata: Metadata = {
  title: "ELO by matchup",
  description: "A separate ELO for each matchup: who is best at Terran vs Zerg, and the rest.",
};

export default function EloMatchupsPage(): ReactElement {
  return <MatchupRatings />;
}
