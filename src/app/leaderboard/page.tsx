import type { Metadata } from "next";
import type { ReactElement } from "react";

import { isMarketsEnabled } from "@/lib/config/env";
import { getReadDb } from "@/lib/db/client";
import { getLeaderboard } from "@/lib/services/markets-read";

import { LeaderboardTable } from "@/features/leaderboard/components/LeaderboardTable";
import { MarketsOff } from "@/features/markets";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Market leaderboard",
  description: "The sharpest StarCoins traders, ranked by net worth in minerals.",
};

export default async function LeaderboardPage(): Promise<ReactElement> {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1>Market leaderboard</h1>
        <p className="text-ink-muted">
          Everyone who plays the markets, ranked by net worth: the minerals they hold plus what
          their open positions are worth at current prices. Minerals are play money.
        </p>
      </header>
      {isMarketsEnabled() ? (
        <LeaderboardTable rows={await getLeaderboard(getReadDb())} />
      ) : (
        <MarketsOff />
      )}
    </div>
  );
}
