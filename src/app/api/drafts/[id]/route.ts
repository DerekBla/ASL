import { NextResponse } from "next/server";

import { isMarketsEnabled } from "@/lib/config/env";
import { getSignedInUserId } from "@/lib/services/auth";
import { readLeague } from "@/lib/services/draft/live";
import { draftLeagueId } from "@/lib/types/ids";

export const dynamic = "force-dynamic";

/** Live draft state for the league page's polling. Also settles a pick clock that has run out. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!isMarketsEnabled()) return NextResponse.json({ error: "MARKETS_DISABLED" }, { status: 503 });
  const raw = (await params).id;
  if (!/^\d{1,12}$/.test(raw) || Number(raw) <= 0)
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const league = await readLeague(draftLeagueId(Number(raw)), await getSignedInUserId());
  if (!league) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json(league, { headers: { "Cache-Control": "no-store" } });
}
