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
      <h1>Race stats</h1>
      <RaceStatsPanels />
    </div>
  );
}
