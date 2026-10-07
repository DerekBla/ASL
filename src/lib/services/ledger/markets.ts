import { eq } from "drizzle-orm";

import * as lmsr from "@/lib/market/lmsr";
import { marketOutcomes, markets, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";
import { marketId } from "@/lib/types/ids";
import type { MarketId, UserId } from "@/lib/types/ids";
import { err, ok } from "@/lib/types/result";
import type { LedgerError, Result } from "@/lib/types/result";

import { toNumeric } from "./numeric";
import { withRetry } from "./retry";

export type NewMarketInput = {
  slug: string;
  question: string;
  description?: string | undefined;
  /** Liquidity. Ledger defaults: 10 for a binary market, 15 for multi-outcome. */
  b: number;
  closesAt: Date;
  outcomes: readonly { label: string; player?: string | null | undefined }[];
  /** Opening probabilities, one per outcome. Clamped to at least 2% each, then normalised. */
  prior?: readonly number[] | undefined;
  season?: number | null | undefined;
  createdBy: UserId;
};

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Creates a market and its outcomes. Opening quantities come from lmsr.initialQuantities, so
 * the market opens at the prior with C(q0) = 0. Only admins reach this (checked by the action).
 */
export async function createMarket(
  db: Db,
  input: NewMarketInput,
): Promise<Result<{ marketId: MarketId; slug: string }, LedgerError>> {
  const n = input.outcomes.length;
  const invalid = (message: string): { error: LedgerError } =>
    err({ code: "INVALID_MARKET", message });
  if (!SLUG.test(input.slug)) return invalid("Slug must be lowercase letters, digits and hyphens.");
  if (input.question.trim().length < 5) return invalid("Write the question out in full.");
  if (n < 2) return invalid("A market needs at least two outcomes.");
  if (new Set(input.outcomes.map((o) => o.label.trim().toLowerCase())).size !== n) {
    return invalid("Outcome labels must be different.");
  }
  if (!Number.isFinite(input.b) || input.b <= 0 || input.b > 1000)
    return invalid("Liquidity (b) must be between 0 and 1000.");
  if (Number.isNaN(input.closesAt.getTime())) return invalid("Pick a closing time.");
  const rawPrior = input.prior ?? Array.from({ length: n }, () => 1 / n);
  if (rawPrior.length !== n || rawPrior.some((p) => !Number.isFinite(p) || p < 0)) {
    return invalid("Give one opening probability per outcome.");
  }
  const prior = lmsr.clampPrior(rawPrior);
  const q0 = lmsr.initialQuantities(input.b, prior);

  return withRetry(() =>
    db.transaction(async (tx) => {
      const [creator] = await tx
        .select({ isAdmin: users.isAdmin })
        .from(users)
        .where(eq(users.id, input.createdBy));
      if (!creator?.isAdmin)
        return err({ code: "INVALID_MARKET" as const, message: "Only admins can create markets." });
      const [taken] = await tx
        .select({ id: markets.id })
        .from(markets)
        .where(eq(markets.slug, input.slug));
      if (taken) return invalid("That slug is already used.");
      const [market] = await tx
        .insert(markets)
        .values({
          slug: input.slug,
          question: input.question.trim(),
          description: input.description?.trim() ?? "",
          kind: n === 2 ? "binary" : "multi",
          b: toNumeric(input.b),
          closesAt: input.closesAt,
          season: input.season ?? null,
          createdBy: input.createdBy,
        })
        .returning({ id: markets.id, slug: markets.slug });
      if (!market) throw new Error("market insert returned nothing");
      await tx.insert(marketOutcomes).values(
        input.outcomes.map((o, idx) => ({
          marketId: market.id,
          idx,
          label: o.label.trim(),
          player: o.player ?? null,
          q: toNumeric(q0[idx] ?? 0),
          q0: toNumeric(q0[idx] ?? 0),
        })),
      );
      return ok({ marketId: marketId(market.id), slug: market.slug });
    }),
  );
}

/** Stops trading early (markets also stop at closes_at on their own). */
export async function closeMarket(
  db: Db,
  id: MarketId,
): Promise<Result<{ status: "closed" }, LedgerError>> {
  return withRetry(() =>
    db.transaction(async (tx) => {
      const [market] = await tx
        .select({ status: markets.status })
        .from(markets)
        .where(eq(markets.id, id))
        .for("update");
      if (!market) return err({ code: "NOT_FOUND" as const });
      if (market.status !== "open") return err({ code: "MARKET_NOT_OPEN" as const });
      await tx.update(markets).set({ status: "closed" }).where(eq(markets.id, id));
      return ok({ status: "closed" as const });
    }),
  );
}
