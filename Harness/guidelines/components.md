# Component Guidelines — AslMarkets.Web

## RSC vs Client Boundary

Default to RSC (no directive). Add `"use client"` only when the component needs:

- `useState`, `useReducer`, or `useContext`
- Browser-only APIs (`window`, `document`, `navigator`)
- Event handlers that cannot be lifted to a Server Action prop
- Third-party libraries that require a DOM environment

Push `"use client"` to the **lowest possible leaf**. Never add it to a layout,
a page wrapper, or a container just because one small child needs it. Wrap only
the interactive island.

## Component Structure

```tsx
// 1. Imports: framework → third-party → @/lib → @/features → @/components → relative
import { Suspense } from "react";
import { OutcomeRow } from "@/features/markets/components/OutcomeRow";
import type { MarketView } from "@/features/markets/types";

// 2. Types — props first, locals below
type Props = {
  market: MarketView;
  onSelectOutcome: (idx: number) => void;
};

// 3. Named export — no default export except pages/layouts
export function MarketOutcomes({ market, onSelectOutcome }: Props) {
  // 4. Hooks at top (Rules of Hooks)
  // 5. Derived values (no side effects)
  // 6. Event handlers
  // 7. JSX return
  return (
    <Suspense fallback={<OutcomeRowSkeleton />}>
      {market.outcomes.map((o) => (
        <OutcomeRow key={o.idx} outcome={o} onSelect={() => onSelectOutcome(o.idx)} />
      ))}
    </Suspense>
  );
}
```

## Hard Rules

- **No default exports** except `app/**/page.tsx` and `app/**/layout.tsx`.
- **No prop drilling > 2 levels.** Introduce context or restructure the tree.
- **Shared components** (`components/`) are stateless and do no data-fetching.
  Feature-scoped UI lives in `features/<domain>/components/` and may be stateful.
- **Accessibility**: every interactive element is keyboard-accessible. Icon-only
  buttons need `aria-label`. Form fields need associated `<label>` elements.
  Minimum contrast: WCAG AA (4.5:1 text, 3:1 large text).
- **Tailwind only** for styling. No inline `style={{}}` except for truly dynamic
  values (e.g. a CSS custom property driven by user input).
- **Skeleton components** for every async boundary. Do not use bare spinners on
  layout-stable surfaces — skeletons prevent cumulative layout shift.

## Composition over Configuration

Prefer composition (slot pattern with `children`, render props) over growing a
component's boolean prop list. When a component has more than 4 conditional
rendering branches driven by props, split it into separate named components.

## Race and Placement Display

- Render races only through the shared `RaceBadge` component and race color tokens
  (`bg-race-terran-pale`, `text-race-zerg-dark`, …). Never hard-code the hex values.
  Pale tokens for player/data cells, dark tokens for section headers only.
- Render placements through `PlacementBadge`; it receives the exported `PlacementValue`
  and never re-parses label strings.
- Prices render as cents-style percentages (`62¢` / `62%`) via one formatter in
  `lib/utils/format.ts`. Credits render with at most 2 decimals in the UI.

## Co-location

Tests live in `__tests__/` next to the component file. Do not scatter test files
into a top-level `__tests__/` directory.

```
features/markets/components/
  OutcomeRow.tsx
  OutcomeRow.test.tsx     ← co-located
  OutcomeRowSkeleton.tsx
```

## Async Boundaries

Every route segment wraps its async content in `<Suspense>`. Each `<Suspense>`
boundary must have a meaningful `fallback` (a Skeleton, not null). Use
`<ErrorBoundary>` at the route level; add fine-grained boundaries only when a
sub-tree genuinely needs independent failure isolation.
