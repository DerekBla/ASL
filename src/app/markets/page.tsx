import type { Metadata } from "next";
import type { ReactElement } from "react";

import { isMarketsEnabled } from "@/lib/config/env";
import { getReadDb } from "@/lib/db/client";
import { listMarkets } from "@/lib/services/markets-read";

import { MarketsList, MarketsOff } from "@/features/markets";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Markets",
  description: "Trade play money minerals on ASL matches.",
};

export default async function MarketsPage(): Promise<ReactElement> {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1>Markets</h1>
        <p className="text-ink-muted">
          Prices are the crowd&apos;s odds. Buy shares in the outcome you believe in; each share
          pays 1 mineral if it happens. Play money only.
        </p>
      </header>
      {isMarketsEnabled() ? (
        <MarketsList markets={await listMarkets(getReadDb())} />
      ) : (
        <MarketsOff />
      )}
    </div>
  );
}
