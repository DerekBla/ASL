import type { Metadata } from "next";
import type { ReactElement } from "react";

import { getManifest } from "@/lib/services/stats";
import { formatInteger } from "@/lib/utils/format";

import { EloTable } from "@/features/stats";

export const metadata: Metadata = {
  title: "ELO ratings",
  description: "ELO from season placements for every ASL player, current and peak.",
};

export default function EloPage(): ReactElement {
  const { elo, seasons } = getManifest();
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1>ELO ratings</h1>
        <p className="text-ink-muted">
          ELO from season placements across all {seasons.complete} seasons: every player starts at{" "}
          {formatInteger(elo.start)}, and each season counts every pair of players who finished in
          different tiers as one game won by the higher finisher (K = {elo.k}). It measures how deep
          players go, not individual game results.
        </p>
      </header>
      <EloTable />
    </div>
  );
}
