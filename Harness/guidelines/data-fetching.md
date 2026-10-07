# Data Fetching — AslMarkets.Web

## Decision Tree

```
Need data in a component?
  ├─ Stats (seasons, players, ELO, race stats)?
  │    → RSC reads via lib/services/stats (static JSON, Zod-validated). No client fetch, no Query.
  ├─ RSC component, market/portfolio data?  → fetch directly in the component body
  └─ Client component?
       ├─ Parent RSC prefetches it?  → useQuery() → immediate cache hit
       └─ No prefetch                → useQuery() → client fetch + Suspense fallback

Need to mutate?
  ├─ From RSC or <form action>?     → Server Action (direct call)
  └─ From Client component?         → Server Action wrapped in useMutation()
```

---

## Query Keys

Define all query keys in a single factory file. Use `as const` for narrow tuples:

```ts
// lib/queries/query-keys.ts
export const queryKeys = {
  markets: {
    all: ["markets"] as const,
    list: (filter: "open" | "resolved") => ["markets", "list", filter] as const,
    detail: (slug: string) => ["markets", slug] as const,
    history: (slug: string) => ["markets", slug, "history"] as const,
  },
  me: {
    account: () => ["me", "account"] as const,       // balance
    positions: () => ["me", "positions"] as const,
  },
  leaderboard: () => ["leaderboard"] as const,
} as const;
```

Always invalidate by key: `queryClient.invalidateQueries({ queryKey: queryKeys.markets.detail(slug) })`.

---

## RSC Prefetch + HydrationBoundary

```tsx
// app/markets/[slug]/page.tsx  (RSC)
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { MarketView } from "@/features/markets/components/MarketView";
import { getMarket } from "@/lib/services/markets-read";
import { queryKeys } from "@/lib/queries/query-keys";

export default async function MarketPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: queryKeys.markets.detail(slug),
    queryFn: () => getMarket(slug),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <MarketView slug={slug} />
    </HydrationBoundary>
  );
}
```

---

## Client useQuery (live prices)

```tsx
// features/markets/components/MarketView.tsx
"use client";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/query-keys";
import { fetchMarket } from "@/features/markets/queries/fetch-market";

export function MarketView({ slug }: { slug: string }) {
  const { data, isPending, isError } = useQuery({
    queryKey: queryKeys.markets.detail(slug),
    queryFn: () => fetchMarket(slug),
    staleTime: 5_000,
    refetchInterval: 10_000,   // prices move when others trade; poll while open
  });

  if (isPending) return <MarketSkeleton />;
  if (isError) return <MarketError />;
  return <MarketBody market={data} />;
}
```

Stop polling (`refetchInterval: false`) once `data.status !== "open"`.

---

## Server Actions (credit-moving)

```ts
// features/markets/actions/place-trade.ts
"use server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/types/action-result";
import { executeTrade, type TradeReceipt } from "@/lib/services/ledger";

const schema = z.object({
  marketId: z.coerce.bigint().positive(),
  outcomeIdx: z.number().int().min(0),
  mode: z.enum(["buy_spend", "buy_shares", "sell_shares"]),
  amount: z.number().positive().max(100_000),
  maxCost: z.number().positive().optional(),       // slippage guard for buys
  minProceeds: z.number().nonnegative().optional(), // slippage guard for sells
  idempotencyKey: z.string().uuid(),
});

export async function placeTrade(input: z.input<typeof schema>): Promise<ActionResult<TradeReceipt>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: { code: "INVALID_INPUT", details: parsed.error.flatten() } };

  const { userId } = await auth();
  if (!userId) return { error: { code: "UNAUTHENTICATED" } };

  const result = await executeTrade({ userId, ...parsed.data });
  if ("error" in result) return result;   // INSUFFICIENT_FUNDS, MARKET_CLOSED, SLIPPAGE, …

  revalidatePath(`/markets/${result.data.marketSlug}`);
  return result;
}
```

Rules:
- Validate with Zod at the **top** before any other logic.
- Check authentication before reading or writing user data.
- Return `{ data } | { error }` — never throw to the client.
- **Never accept a price or cost from the client as truth.** Only as a slippage bound.
- The idempotency key is generated once per submit on the client (`crypto.randomUUID()`) and
  reused on retry.
- All credit logic lives in `lib/services/ledger` — the action is a thin shell.

---

## useMutation with Server Actions

```tsx
"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { placeTrade } from "@/features/markets/actions/place-trade";
import { queryKeys } from "@/lib/queries/query-keys";

export function usePlaceTrade(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: placeTrade,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.markets.detail(slug) });
      queryClient.invalidateQueries({ queryKey: queryKeys.me.account() });
      queryClient.invalidateQueries({ queryKey: queryKeys.me.positions() });
    },
  });
}
```

## No Optimistic Updates for Money

Do **not** optimistically update balances, positions, or prices. The server's result is the
only truth (another trader may have moved the price). Show a pending state on the trade
button, then render the receipt from the action result. Optimistic UI is fine for non-money
state (for example, watchlist toggles).
