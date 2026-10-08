import type { Metadata } from "next";
import Link from "next/link";
import type { ReactElement } from "react";

import { isMarketsEnabled } from "@/lib/config/env";
import { getReadDb } from "@/lib/db/client";
import { getViewer } from "@/lib/services/auth";
import { getPortfolio } from "@/lib/services/markets-read";

import { MarketsOff } from "@/features/markets";
import { PortfolioView } from "@/features/portfolio/components/PortfolioView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Portfolio" };

export default async function PortfolioPage(): Promise<ReactElement> {
  if (!isMarketsEnabled()) return <MarketsOff />;
  const viewer = await getViewer(); // middleware already sent signed-out visitors to sign in
  const portfolio = viewer ? await getPortfolio(getReadDb(), viewer.userId) : undefined;
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h1>Portfolio</h1>
        {viewer?.isAdmin ? <Link href="/admin">Admin</Link> : null}
      </header>
      {viewer?.created ? (
        <p role="status" className="rounded-2xl bg-medal-gold px-4 py-3 text-race-ink">
          Welcome to StarCoins! You start with 100 minerals.
        </p>
      ) : null}
      {portfolio ? <PortfolioView portfolio={portfolio} /> : <p>Sign in to see your portfolio.</p>}
    </div>
  );
}
