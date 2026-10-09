import { NextResponse } from "next/server";

import { getPlayers } from "@/lib/services/stats";

export const dynamic = "force-static";

/** Every player's name, for the header search box's suggestions. Built once per deploy. */
export function GET(): NextResponse {
  return NextResponse.json(getPlayers().map((p) => p.player));
}
