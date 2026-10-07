import type { Metadata } from "next";
import type { ReactElement } from "react";

import { isMarketsEnabled } from "@/lib/config/env";
import { getReadDb } from "@/lib/db/client";
import { getLeaderboard } from "@/lib/services/markets-read";

import { LeaderboardTable } from "@/features/leaderboard/components/LeaderboardTable";
import { MarketsOff } from "@/features/markets";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "The sharpest StarCoins traders, ranked by net worth in minerals.",
};

export default async function LeaderboardPage(): Promise<ReactElement> {
  return (
    <div className="flex flex-col gap-6">
      <h1>Leaderboard</h1>
      {isMarketsEnabled() ? (
        <LeaderboardTable rows={await getLeaderboard(getReadDb())} />
      ) : (
        <MarketsOff />
      )}
    </div>
  );
}
