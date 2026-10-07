import type { Metadata } from "next";
import type { ReactElement } from "react";

import { SeasonsTable } from "@/features/stats";

export const metadata: Metadata = {
  title: "Seasons",
  description: "Every ASL season: champion, runner-up, final score, dates and prize pool.",
};

export default function SeasonsPage(): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <h1>Seasons</h1>
      <SeasonsTable />
    </div>
  );
}
