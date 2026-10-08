import type { Metadata } from "next";
import type { ReactElement } from "react";

import { SeasonsTable } from "@/features/stats";

export const metadata: Metadata = {
  title: "Seasons",
  description: "Every ASL season: champion, runner up, final score, dates and prize pool.",
};

export default function SeasonsPage(): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1>Seasons</h1>
        <p className="text-ink-muted">
          Every ASL season, newest first: who won, who they beat in the final, and the prize pool.
          Click a season for its full results.
        </p>
      </header>
      <SeasonsTable />
    </div>
  );
}
