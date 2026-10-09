import type { Metadata } from "next";
import type { ReactElement } from "react";

import { RecordsPanels } from "@/features/stats";

export const metadata: Metadata = {
  title: "Records",
  description:
    "ASL records: longest winning streaks, biggest upsets, title runs, youngest and oldest champions.",
};

export default function RecordsPage(): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1>Records</h1>
        <p className="text-ink-muted">
          The most, the longest and the least likely in ASL history. Everything here counts the
          ASL&apos;s own games, not qualifiers.
        </p>
      </header>
      <RecordsPanels />
    </div>
  );
}
