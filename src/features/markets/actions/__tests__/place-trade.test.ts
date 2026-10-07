// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { isMarketsEnabled } from "@/lib/config/env";
import { getViewer } from "@/lib/services/auth";
import { executeTrade } from "@/lib/services/ledger";
import { userId } from "@/lib/types/ids";

import { placeTrade } from "../place-trade";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/config/env", () => ({ isMarketsEnabled: vi.fn() }));
vi.mock("@/lib/services/auth", () => ({ getViewer: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ withWriteDb: (fn: (db: unknown) => unknown) => fn({}) }));
vi.mock("@/lib/services/ledger", () => ({ executeTrade: vi.fn() }));

const valid = {
  marketId: 1,
  outcomeIdx: 0,
  mode: "buy_spend" as const,
  amount: 5,
  maxCost: 5,
  idempotencyKey: "4b0c8d4e-1f2a-4c3b-9d5e-6f7a8b9c0d1e",
};

beforeEach(() => {
  vi.mocked(isMarketsEnabled).mockReturnValue(true);
  vi.mocked(getViewer).mockResolvedValue({
    userId: userId("user_a"),
    isAdmin: false,
    created: false,
  });
  vi.mocked(executeTrade).mockReset();
});

describe("placeTrade", () => {
  it("validates input before anything else", async () => {
    expect(await placeTrade({ ...valid, amount: -1 })).toEqual({
      error: { code: "INVALID_INPUT" },
    });
    expect(await placeTrade({ ...valid, idempotencyKey: "not-a-uuid" })).toEqual({
      error: { code: "INVALID_INPUT" },
    });
    expect(executeTrade).not.toHaveBeenCalled();
  });

  it("refuses when markets are off or nobody is signed in", async () => {
    vi.mocked(isMarketsEnabled).mockReturnValue(false);
    expect(await placeTrade(valid)).toEqual({ error: { code: "MARKETS_DISABLED" } });
    vi.mocked(isMarketsEnabled).mockReturnValue(true);
    vi.mocked(getViewer).mockResolvedValue(undefined);
    expect(await placeTrade(valid)).toEqual({ error: { code: "UNAUTHENTICATED" } });
    expect(executeTrade).not.toHaveBeenCalled();
  });

  it("trades as the signed-in user, never a user named by the client", async () => {
    vi.mocked(executeTrade).mockResolvedValue({ error: { code: "SLIPPAGE" } });
    expect(await placeTrade({ ...valid, userId: "someone_else" } as typeof valid)).toEqual({
      error: { code: "SLIPPAGE" },
    });
    expect(vi.mocked(executeTrade).mock.calls[0]?.[1]).toMatchObject({
      userId: "user_a",
      marketId: 1,
    });
  });

  it("turns unexpected failures into a safe message", async () => {
    vi.mocked(executeTrade).mockRejectedValue(new Error("connection reset"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await placeTrade(valid)).toEqual({ error: { code: "TEMPORARY_FAILURE" } });
  });
});
