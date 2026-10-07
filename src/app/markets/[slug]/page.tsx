import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";

import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";

import { isMarketsEnabled } from "@/lib/config/env";
import { getReadDb } from "@/lib/db/client";
import { queryKeys } from "@/lib/queries/query-keys";
import { getMarketView } from "@/lib/services/markets-read";

import { MarketLive, MarketsOff, MatchContext } from "@/features/markets";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!isMarketsEnabled()) return { title: "Markets" };
  const market = await getMarketView(getReadDb(), (await params).slug);
  return market ? { title: market.question } : {};
}

export default async function MarketPage({ params }: Props): Promise<ReactElement> {
  if (!isMarketsEnabled()) return <MarketsOff />;
  const slug = (await params).slug;
  const market = await getMarketView(getReadDb(), slug);
  if (!market) notFound();

  // Prefetch on the server, then the client keeps it fresh by polling (data-fetching.md).
  const queryClient = new QueryClient();
  queryClient.setQueryData(queryKeys.markets.detail(slug), market);
  const players = market.outcomes.map((o) => o.player).filter((p): p is string => Boolean(p));

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb" className="text-caption">
        <Link href="/markets">All markets</Link>
      </nav>
      <h1>{market.question}</h1>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <MarketLive
          slug={slug}
          signInHref={`/sign-in?redirect_url=${encodeURIComponent(`/markets/${slug}`)}`}
          context={players.length > 0 ? <MatchContext players={players} /> : null}
        />
      </HydrationBoundary>
    </div>
  );
}
