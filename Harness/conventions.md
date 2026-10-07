# Conventions — AslMarkets.Web

## Naming

| Thing | Convention | Example |
|---|---|---|
| Files (components) | PascalCase | `OutcomeRow.tsx` |
| Files (everything else) | kebab-case | `execute-trade.ts`, `query-keys.ts` |
| React components | Named PascalCase export | `export function OutcomeRow()` |
| Hooks | `use` prefix, camelCase | `usePlaceTrade`, `useMarketQuery` |
| Zustand stores | `use` + Domain + `Store` | `useTradePanelStore` |
| TanStack Query keys | Const tuple factory in `query-keys.ts` | `queryKeys.markets.detail(slug)` |
| Server Actions | verb + noun, camelCase | `placeTrade`, `resolveMarket` |
| Types / Interfaces | PascalCase, no `I` prefix | `MarketView`, `TradeReceipt` |
| Enums | String-literal unions, not TS enums | `type MarketStatus = "open" \| "closed" \| "resolved" \| "voided"` |
| Constants | SCREAMING_SNAKE | `SIGNUP_GRANT_CREDITS` |
| CSS | Tailwind utilities only; custom names only inside `@layer components` |

## File Organisation (per feature)

```
features/markets/
  components/       # Feature-scoped UI — not in shared components/
  hooks/            # Feature-scoped hooks
  actions/          # Server Actions for this domain
  queries/          # TanStack Query definitions
  store/            # Zustand slice (if needed)
  types.ts          # Domain types
  index.ts          # Public API — only export what other layers need
```

## TypeScript

- `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`.
- Prefer `type` over `interface` unless declaration merging is explicitly needed.
- No `any`. Use `unknown` + type narrowing. Disable-comments (`// eslint-disable-next-line`) require a justification comment on the same line.
- Return types on all **exported** functions. Infer internal return types.
- Zod for all external data boundaries: API responses, form input, environment variables.
- Use branded types for IDs to prevent accidental misuse: `type MarketId = bigint & { __brand: "MarketId" }`.

## Async and Error Handling

- Server Actions return `{ data: T } | { error: ActionError }` discriminated unions — never throw to the client.
- `useQuery` error states are handled at the component level, not swallowed.
- All `async` functions in Services must have a typed error path — no silent catches.
- No unhandled promise rejections. All `.catch` branches must be explicit.
- Use `React.Suspense` + `ErrorBoundary` at the route level. Use fine-grained boundaries below only when a sub-tree genuinely needs independent failure isolation.

## Imports

- Absolute imports via `@/` alias (maps to `src/`).
- Group order (enforced by ESLint import plugin):
  1. React and Next.js (`react`, `next/*`)
  2. Third-party packages
  3. `@/lib/*`
  4. `@/features/*`
  5. `@/components/*`
  6. Relative imports (`./`, `../`)
- No barrel re-exports from `components/index.ts` — import directly to preserve tree-shaking.
- No default exports except for Next.js page and layout files (required by the framework).

## Styling

- Tailwind utilities only inside JSX. No inline `style={{}}` except for truly dynamic values that cannot be expressed as utilities (e.g. CSS custom property injection for user-controlled colors).
- Repeated utility groups go into `@layer components` in `globals.css`, not into separate CSS files.
- No `!important`. Specificity conflicts signal a component tree problem — fix the structure.
- Responsive breakpoints are mobile-first: `sm:`, `md:`, `lg:`, `xl:` prefixes.
- Dark mode via `dark:` Tailwind variant. Do not use JavaScript to swap themes.

## Money and Numbers

- The unit is **credits** in code, schema, and specs, and **minerals** in UI copy (1 mineral =
  1 credit). Never write "$", "USD", "dollars", "cash", "bet", or "wager" in UI copy or
  identifiers. UI says minerals, trade, position, payout; code says credits.
- Starting balance is `SIGNUP_GRANT_CREDITS = 100`. Don't hard-code 100 anywhere else.
- Stored money and shares: Postgres `numeric(18,6)`; strings in Drizzle results; converted at
  the ledger service edge only.
- Prices are probabilities in `[0, 1]`. UI shows them as percentages.
- Only `lib/market/` does LMSR arithmetic.

## Python (scripts/liquipedia, scripts/export-stats)

- Python 3.12+, type hints on every function, `from __future__ import annotations`.
- Standard library only. No pandas, no requests.
- Fail loudly (`LayoutError`) on structural surprises; warn (`validation.json`) on data
  surprises.
- JSON output: `ensure_ascii=False`, `sort_keys=True`, 2-space indent, trailing newline.

## Comments

Write comments only when the **why** is non-obvious: a hidden constraint, a subtle
invariant, or a workaround for a specific external bug. Do not explain what the code
does — well-named identifiers already do that.
