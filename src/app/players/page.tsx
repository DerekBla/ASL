import type { Metadata } from "next";
import type { ReactElement } from "react";

import { PlayersTable } from "@/features/stats";

export const metadata: Metadata = {
  title: "Players",
  description: "Career stats for every ASL player: seasons, best finish, titles, prize money, ELO.",
};

export default function PlayersPage(): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1>Players</h1>
        <p className="text-ink-muted">
          Everyone who has played in the ASL, with their career record. Click a column heading to
          sort by it, or a name for that player&apos;s page.
        </p>
      </header>
      <PlayersTable />
    </div>
  );
}
