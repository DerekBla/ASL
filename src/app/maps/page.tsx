import type { Metadata } from "next";
import type { ReactElement } from "react";

import { MapsTable } from "@/features/stats";

export const metadata: Metadata = {
  title: "Maps",
  description: "Every ASL map: games played and how the races have done against each other.",
};

export default function MapsPage(): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1>Maps</h1>
        <p className="text-ink-muted">
          Every map the ASL has been played on, with how Terran, Zerg and Protoss have done against
          each other on it. Open a map for each player&apos;s record there.
        </p>
        <p className="text-caption text-ink-muted">
          Counts individual games, from the maps Liquipedia lists. Group stage games are covered for
          every season. Playoff maps are missing for some older seasons, so those games are not
          counted here. Versions of a map, such as Sylphid and Neo Sylphid, are kept apart.
        </p>
      </header>
      <MapsTable />
    </div>
  );
}
