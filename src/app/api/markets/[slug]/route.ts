import { NextResponse } from "next/server";

import { isMarketsEnabled } from "@/lib/config/env";
import { getReadDb } from "@/lib/db/client";
import { getMarketView } from "@/lib/services/markets-read";

export const dynamic = "force-dynamic";

/** Live market data for the market page's polling (data-fetching.md: live prices). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  if (!isMarketsEnabled()) return NextResponse.json({ error: "MARKETS_DISABLED" }, { status: 503 });
  const market = await getMarketView(getReadDb(), (await params).slug);
  if (!market) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json(market, { headers: { "Cache-Control": "no-store" } });
}
