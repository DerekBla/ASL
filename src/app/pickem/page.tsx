import type { Metadata } from "next";
import type { ReactElement } from "react";

import { isMarketsEnabled } from "@/lib/config/env";
import { getReadDb } from "@/lib/db/client";
import { listPickems } from "@/lib/services/pickem";

import { PickemList, PickemOff } from "@/features/pickem";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pick'em",
  description: "Fill out a bracket for each ASL season and see who called it best.",
};

export default async function PickemPage(): Promise<ReactElement> {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1>Pick&apos;em</h1>
        <p className="text-ink-muted">
          Before a season starts, pick who gets out of every round, all the way to the champion.
          Brackets lock when the first match is played, then everyone&apos;s picks are public and
          scored as the season goes. Free to play, nothing but bragging rights and achievements.
        </p>
      </header>
      {isMarketsEnabled() ? <PickemList pickems={await listPickems(getReadDb())} /> : <PickemOff />}
    </div>
  );
}
