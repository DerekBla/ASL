# Feature Specs — StarCoins

> **Engineering how**: UI states, data flows, view-model contracts, Server Action
> interfaces, and routing for each buildable feature. Feature specs bridge the
> product spec (why) and the code (what gets built). Agents author and consume
> these specs.

## What a Feature Spec Contains

A feature spec answers: **How is this built at the boundary level?** It defines the
interface between the feature and the rest of the system — not the internal
implementation details, which live in the code.

## Template

Create specs as `Docs/feature-specs/<slug>.md`:

```markdown
# Feature Spec: <Name>

**Status**: draft | approved | in-progress | implemented
**Last updated**: YYYY-MM-DD
**Product spec**: Docs/product-specs/<slug>.md
**UI spec**: Docs/ui-specs/<slug>.md
**Feature map**: Docs/feature-map/<slug>.md

## Routes

| Path | Segment type | Description |
|---|---|---|
| /markets/[slug] | RSC page + Client components | Market detail with trade panel |
| /portfolio | RSC page (auth) | Positions and history |

## View-Model

Data shape the component tree receives at the page boundary.

```ts
type MarketPageViewModel = {
  market: MarketView;            // question, status, closesAt, b, outcomes with prices
  myPosition: PositionView[] | null;
  myBalance: number | null;      // null when signed out
  linkedPlayers: PlayerLink[];   // to stats pages
};
```

## Data Flow

Step-by-step from page load to mutation:

1. RSC page calls `marketsRead.getMarket(slug)`.
2. Prefetches result into `QueryClient` under `queryKeys.markets.detail(slug)`.
3. Wraps client tree in `<HydrationBoundary>`.
4. Client component `MarketView` reads via `useQuery(queryKeys.markets.detail(slug))`, a cache hit, then polls every 10s while open.
5. User enters an amount → local display quote from `lib/market/lmsr` → Buy → `placeTrade` Server Action.
6. Action validates, calls `ledger.executeTrade`, returns a receipt; client invalidates market, account, and positions keys.

## Server Actions

| Action | Input schema | Output | Side effects |
|---|---|---|---|
| placeTrade | `{ marketId, outcomeIdx, mode, amount, maxCost?, minProceeds?, idempotencyKey }` | `ActionResult<TradeReceipt>` | Ledger transaction; revalidates market path |

## Zustand (if applicable)

List any Zustand slices this feature introduces or depends on. Most features should not need a store.

## States

- **Loading**: `<MarketSkeleton />` via Suspense; HydrationBoundary prevents a flash on first load
- **Error**: inline `<MarketError />` with retry; the route-level ErrorBoundary catches unexpected throws
- **Signed out**: prices visible; trade panel shows a "Sign in to trade" CTA
- **Closed / resolved / voided**: trade panel replaced by a status banner (winning outcome, payout)

## Acceptance Criteria

- [ ] Prices render on first paint (prefetched in RSC)
- [ ] A trade completes and the UI updates in < 800ms p95
- [ ] Rejections (insufficient credits, slippage, closed) show specific copy
- [ ] Keyboard: Tab reaches the outcome rows, amount input, and Buy/Sell; Enter submits
- [ ] Screen reader: the trade receipt is announced via aria-live
```

## Spec Lifecycle

- **draft**: written by an agent based on the product spec; not yet reviewed
- **approved**: human has reviewed and approved; work may begin
- **in-progress**: ROADMAP entry is `in-progress`; spec is locked (changes require discussion)
- **implemented**: feature shipped; spec is archived reference
