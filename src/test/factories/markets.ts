import type { NewMarketInput } from "@/lib/services/ledger";
import type { UserId } from "@/lib/types/ids";

let counter = 0;

/** A binary match market that closes in a week, opening 50/50 unless overridden. */
export function makeMarketInput(
  createdBy: UserId,
  overrides: Partial<NewMarketInput> = {},
): NewMarketInput {
  counter += 1;
  return {
    slug: `test-market-${counter}`,
    question: "Who wins the test match?",
    b: 10,
    closesAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    outcomes: [
      { label: "Rush", player: "Rush" },
      { label: "Soulkey", player: "Soulkey" },
    ],
    createdBy,
    ...overrides,
  };
}

let keys = 0;

/** A fresh idempotency key, as the trade panel makes one per submit. */
export function makeKey(): string {
  keys += 1;
  return `00000000-0000-4000-8000-${String(keys).padStart(12, "0")}`;
}
