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
      <h1>Players</h1>
      <PlayersTable />
    </div>
  );
}
