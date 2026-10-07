import { NextResponse } from "next/server";

import { isMarketsEnabled } from "@/lib/config/env";
import { getReadDb } from "@/lib/db/client";
import { getSignedInUserId } from "@/lib/services/auth";
import { getPortfolio } from "@/lib/services/markets-read";

import type { MyMarketState } from "@/features/markets/types";

export const dynamic = "force-dynamic";

/** The viewer's balance and holdings in one market, for the trade panel. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse<MyMarketState>> {
  const empty: MyMarketState = { signedIn: false, balance: null, shares: {} };
  if (!isMarketsEnabled()) return NextResponse.json(empty);
  const user = await getSignedInUserId();
  if (!user) return NextResponse.json(empty);
  const portfolio = await getPortfolio(getReadDb(), user);
  const slug = (await params).slug;
  const shares: Record<number, number> = {};
  for (const p of portfolio?.positions ?? []) {
    if (p.marketSlug === slug) shares[p.outcomeIdx] = p.shares;
  }
  return NextResponse.json(
    { signedIn: true, balance: portfolio?.balance ?? null, shares },
    { headers: { "Cache-Control": "no-store" } },
  );
}
