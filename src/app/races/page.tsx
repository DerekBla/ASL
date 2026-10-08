import type { Metadata } from "next";
import type { ReactElement } from "react";

import { RaceStatsPanels } from "@/features/stats";

export const metadata: Metadata = {
  title: "Race stats",
  description: "Titles, representation and series matchups by race across every ASL season.",
};

export default function RacesPage(): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1>Race stats</h1>
        <p className="text-ink-muted">
          How the three StarCraft races, Terran, Zerg and Protoss, have done in the ASL: titles, how
          many players of each entered, and series records against each other.
        </p>
      </header>
      <RaceStatsPanels />
    </div>
  );
}
