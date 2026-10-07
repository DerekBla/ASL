"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { isMarketsEnabled } from "@/lib/config/env";
import { withWriteDb } from "@/lib/db/client";
import { getViewer } from "@/lib/services/auth";
import { closeMarket, createMarket, resolveMarket, voidMarket } from "@/lib/services/ledger";
import type { Settlement } from "@/lib/services/ledger";
import { marketId } from "@/lib/types/ids";
import type { UserId } from "@/lib/types/ids";
import type { ActionResult } from "@/lib/types/result";

async function asAdmin<T>(
  run: (admin: UserId) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  if (!isMarketsEnabled()) return { error: { code: "MARKETS_DISABLED" } };
  const viewer = await getViewer();
  if (!viewer) return { error: { code: "UNAUTHENTICATED" } };
  if (!viewer.isAdmin) return { error: { code: "FORBIDDEN" } };
  try {
    return await run(viewer.userId);
  } catch (error) {
    console.error("admin action failed", error);
    return { error: { code: "TEMPORARY_FAILURE" } };
  }
}

function refresh(slug?: string): void {
  revalidatePath("/markets");
  revalidatePath("/admin");
  revalidatePath("/leaderboard");
  if (slug) revalidatePath(`/markets/${slug}`);
}

const createSchema = z.object({
  slug: z.string().min(3).max(80),
  question: z.string().min(5).max(200),
  description: z.string().max(2000).optional(),
  b: z.number().positive().max(1000),
  closesAt: z.iso.datetime(),
  outcomes: z
    .array(
      z.object({
        label: z.string().min(1).max(60),
        player: z.string().max(60).nullable().optional(),
      }),
    )
    .min(2)
    .max(32),
  prior: z.array(z.number().min(0).max(1)).optional(),
  season: z.number().int().positive().nullable().optional(),
});

export type CreateMarketInput = z.input<typeof createSchema>;

export async function createMarketAction(
  input: CreateMarketInput,
): Promise<ActionResult<{ slug: string }>> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success)
    return {
      error: {
        code: "INVALID_INPUT",
        message: parsed.error.issues[0]?.message ?? "Check the form.",
      },
    };
  return asAdmin(async (admin) => {
    const d = parsed.data;
    const result = await withWriteDb((db) =>
      createMarket(db, {
        slug: d.slug,
        question: d.question,
        description: d.description,
        b: d.b,
        closesAt: new Date(d.closesAt),
        outcomes: d.outcomes.map((o) => ({ label: o.label, player: o.player ?? null })),
        prior: d.prior,
        season: d.season ?? null,
        createdBy: admin,
      }),
    );
    if ("error" in result) return { error: result.error };
    refresh(result.data.slug);
    return { data: { slug: result.data.slug } };
  });
}

const idSchema = z.object({ marketId: z.number().int().positive(), slug: z.string() });

export async function closeMarketAction(
  input: z.input<typeof idSchema>,
): Promise<ActionResult<{ status: "closed" }>> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { error: { code: "INVALID_INPUT" } };
  return asAdmin(async () => {
    const result = await withWriteDb((db) => closeMarket(db, marketId(parsed.data.marketId)));
    if ("error" in result) return { error: result.error };
    refresh(parsed.data.slug);
    return result;
  });
}

const resolveSchema = idSchema.extend({
  winningIdx: z.number().int().min(0),
  note: z.string().max(500),
});

export async function resolveMarketAction(
  input: z.input<typeof resolveSchema>,
): Promise<ActionResult<Settlement>> {
  const parsed = resolveSchema.safeParse(input);
  if (!parsed.success) return { error: { code: "INVALID_INPUT" } };
  return asAdmin(async (admin) => {
    const d = parsed.data;
    const result = await withWriteDb((db) =>
      resolveMarket(db, {
        marketId: marketId(d.marketId),
        winningIdx: d.winningIdx,
        note: d.note,
        adminId: admin,
      }),
    );
    if ("error" in result) return { error: result.error };
    refresh(d.slug);
    return result;
  });
}

const voidSchema = idSchema.extend({ note: z.string().min(3).max(500) });

export async function voidMarketAction(
  input: z.input<typeof voidSchema>,
): Promise<ActionResult<Settlement>> {
  const parsed = voidSchema.safeParse(input);
  if (!parsed.success)
    return { error: { code: "INVALID_INPUT", message: "Say why the market is voided." } };
  return asAdmin(async (admin) => {
    const d = parsed.data;
    const result = await withWriteDb((db) =>
      voidMarket(db, { marketId: marketId(d.marketId), note: d.note, adminId: admin }),
    );
    if ("error" in result) return { error: result.error };
    refresh(d.slug);
    return result;
  });
}
