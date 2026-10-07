# Architecture — AslMarkets.Web

## Layer Map

```
┌──────────────────────────────────────────────────────────────┐
│  Pages / Routes  (app/**/page.tsx, layout.tsx)               │
│  RSC by default; opt-in "use client" at the leaf only        │
├──────────────────────────────────────────────────────────────┤
│  Features  (features/<domain>/*)                             │
│  stats · markets · portfolio · leaderboard · admin           │
│  One folder per product domain; no cross-feature imports     │
├──────────────────────────────────────────────────────────────┤
│  Shared UI  (components/*)                                   │
│  Stateless, composable; no data-fetching, no stores          │
├──────────────────────────────────────────────────────────────┤
│  Data Layer  (lib/queries/*, lib/actions/*)                  │
│  TanStack Query hooks (client), Server Actions (server)      │
├──────────────────────────────────────────────────────────────┤
│  Stores  (lib/stores/*)                                      │
│  Zustand slices; UI state only; no server data               │
├──────────────────────────────────────────────────────────────┤
│  Services / SDK Adapters  (lib/services/*)                   │
│  ledger (DB writes) · markets-read · auth · stats loader     │
│  All external I/O; thin wrappers with typed return values    │
├──────────────────────────────────────────────────────────────┤
│  Foundation  (lib/market/*, lib/types/*, lib/utils/*,        │
│               lib/config/*, lib/db/schema.ts)                │
│  Pure domain math (LMSR), shared types, env config, schema   │
└──────────────────────────────────────────────────────────────┘

Outside the app:
  scripts/liquipedia/ + scripts/export-stats/ (Python)  data/source/liquipedia/ ──► data/generated/*.json
```

## Dependency Rule

**Every layer may only import from layers below it. No upward imports. No sideways
imports between sibling features.**

> Every layer crossing is a typed interface; concrete implementations are internal
> to their layer. You may not import a concrete class or function across a layer
> boundary — only types and the public API surface.

### Allowed Import Paths

| From | May import | May NOT import |
|---|---|---|
| Pages / Routes | Features, Shared UI, Data Layer, Foundation | — |
| Features | Shared UI, Data Layer, Stores, Services, Foundation | other Features |
| Shared UI | Foundation | Features, Data Layer, Stores, Services |
| Data Layer | Services, Foundation | Stores, Shared UI, Features |
| Stores | Foundation | Data Layer, Services, Shared UI, Features |
| Services | Foundation | anything above |
| Foundation | (nothing internal) | anything |

Enforce this via ESLint `import/no-restricted-paths` rules in `eslint.config.mjs`.

### Project-specific boundaries

- `lib/market/` is **pure**: no I/O, no Date.now(), no randomness, no DB types. Client
  components may import it to show live quotes; the server recomputes every quote
  inside the trade transaction and never trusts a client-sent price or cost.
- `lib/services/ledger/` is the **only** module that writes to `accounts`, `positions`,
  `trades`, `ledger_entries`, or `market_outcomes.q`. Server Actions call it; nothing
  else touches those tables.
- `lib/db/` drivers: the `neon-serverless` Pool for ledger writes (needs interactive
  transactions); `neon-http` is allowed for read-only queries.
- `data/generated/*.json` is read only through `lib/services/stats/` (Zod-validated).
  Feature code never `import`s the JSON directly.

---

## Data-Flow Patterns

### Stats (static, build time)

```
Liquipedia → pnpm stats:fetch → data/source/liquipedia/ → pnpm stats:export → data/generated/*.json (committed)
    ↓
lib/services/stats: read + Zod parse (once per build)
    ↓
RSC pages render tables; generateStaticParams for seasons and players
```

No client fetching. Stats pages are statically generated and revalidated on deploy.

### Market reads (dynamic)

```
RSC page → markets-read service → Postgres (prices from q via lmsr.prices)
    ↓
prefetch into QueryClient → HydrationBoundary → useQuery (refetchInterval for live prices)
```

### Trades (mutations)

```
Client trade panel → local quote from lib/market (display only)
    ↓  useMutation
Server Action placeTrade (Zod → auth → idempotency key)
    ↓
ledger.executeTrade: BEGIN → lock market row → lock account row → recompute quote
  → check status / close time / balance / max cost → write trade, q, position,
    ledger entry, balance → COMMIT
    ↓
return ActionResult → invalidate market + portfolio query keys
```

### Client-only state

```
User interaction → Zustand store action → component re-render via selector
```

(Example: trade panel's selected outcome and buy/sell toggle.)

---

## Module Boundary Checklist

Before adding any cross-layer or cross-feature import, verify all four:

1. The target layer is **below** the caller in the layer map.
2. The import is to a **typed interface or public API**, not a concrete implementation.
3. No **circular dependency** is introduced — run `pnpm madge --circular src/`.
4. The **feature boundary** is not violated — features stay isolated from siblings.

If any check fails, restructure rather than proceed.

---

## Directory Skeleton (create folders only when a feature needs them)

```
src/
  app/
    (stats)/seasons/[season]/  players/[player]/  races/  elo/
    markets/[slug]/
    portfolio/  leaderboard/  admin/
  features/
    stats/  markets/  portfolio/  leaderboard/  admin/
      components/  hooks/  actions/  queries/  store/  types.ts  index.ts
  components/           # EXISTS: SiteHeader, SiteFooter, RaceBadge, PlacementBadge, DataTable, Button
  lib/
    market/             # EXISTS: lmsr.ts (+ settlement math later). Pure.
    db/                 # schema.ts, client.ts (pool + http)
    services/
      ledger/           # The only credit-writing code
      markets-read/
      stats/            # EXISTS: schemas.ts, parse.ts, index.ts (loaders)
    queries/            # query-keys.ts
    stores/
    types/              # EXISTS: race.ts
    utils/              # EXISTS: format.ts, slug.ts
    config/             # EXISTS: site.ts. env.ts (Zod) later
  test/
    factories/
    setup.ts            # EXISTS: jest-dom matchers + cleanup
scripts/
  liquipedia/           # EXISTS: fetch + parse Liquipedia season pages, tests
  export-stats/         # EXISTS: export_stats.py + tests
data/
  source/               # EXISTS: liquipedia/ (wikitext + results), overrides.json, old xlsx (reference)
  generated/            # EXISTS: exporter output
```
