import { NextResponse } from "next/server";

import { isMarketsEnabled } from "@/lib/config/env";
import { getReadDb } from "@/lib/db/client";
import { listMarkets } from "@/lib/services/markets-read";

export const dynamic = "force-dynamic";

/** Every market with its current prices, for the home page's open markets list. */
export async function GET(): Promise<NextResponse> {
  if (!isMarketsEnabled()) return NextResponse.json({ error: "MARKETS_DISABLED" }, { status: 503 });
  return NextResponse.json(await listMarkets(getReadDb()), {
    headers: { "Cache-Control": "no-store" },
  });
}
