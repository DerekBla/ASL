"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { isMarketsEnabled } from "@/lib/config/env";
import { withWriteDb } from "@/lib/db/client";
import { getViewer } from "@/lib/services/auth";
import { executeTrade } from "@/lib/services/ledger";
import type { TradeReceipt } from "@/lib/services/ledger";
import { marketId } from "@/lib/types/ids";
import type { ActionResult } from "@/lib/types/result";

const schema = z.object({
  marketId: z.number().int().positive(),
  outcomeIdx: z.number().int().min(0),
  mode: z.enum(["buy_spend", "buy_shares", "sell_shares"]),
  amount: z.number().positive().max(100_000),
  maxCost: z.number().positive().optional(), // slippage guard for buys
  minProceeds: z.number().nonnegative().optional(), // slippage guard for sells
  idempotencyKey: z.uuid(),
});

export type PlaceTradeInput = z.input<typeof schema>;

/** Thin shell: validate, authenticate, hand to the ledger (data-fetching.md, Server Actions). */
export async function placeTrade(input: PlaceTradeInput): Promise<ActionResult<TradeReceipt>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: { code: "INVALID_INPUT" } };
  if (!isMarketsEnabled()) return { error: { code: "MARKETS_DISABLED" } };

  const viewer = await getViewer();
  if (!viewer) return { error: { code: "UNAUTHENTICATED" } };

  try {
    const result = await withWriteDb((db) =>
      executeTrade(db, {
        ...parsed.data,
        userId: viewer.userId,
        marketId: marketId(parsed.data.marketId),
      }),
    );
    if ("error" in result) return { error: result.error };
    revalidatePath(`/markets/${result.data.marketSlug}`);
    revalidatePath("/portfolio");
    return result;
  } catch (error) {
    console.error("placeTrade failed", error);
    return { error: { code: "TEMPORARY_FAILURE" } };
  }
}
