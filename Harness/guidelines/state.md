# State Management — AslMarkets.Web

## The Core Rule

**Server data lives in TanStack Query. UI state lives in Zustand.**

Never copy a query result into a Zustand store. If you find yourself doing this,
you have a data-flow architecture problem — re-read `Harness/architecture.md`.

## Never in a Store

Balances, positions, prices, and quotes from the server. They live in TanStack Query and are
invalidated after every trade. A stale balance in a store is how users see money they don't
have.

## What Belongs in a Zustand Store

- Ephemeral UI state: modal open/closed, selected tab, sidebar collapsed
- Multi-step wizard progress (not the data itself — that stays in React state
  until submission, then goes to the server)
- User preferences that must survive route navigation but not a hard refresh
  (use `persist` middleware only for these — see below)

## Slice Pattern

Each feature that needs client state gets its own store file:

```ts
// lib/stores/trade-panel-store.ts
import { create } from "zustand";
import { devtools } from "zustand/middleware";

type TradePanelState = {
  selectedOutcome: number | null;
  side: "buy" | "sell";
  selectOutcome: (idx: number) => void;
  setSide: (side: "buy" | "sell") => void;
  reset: () => void;
};

const initial = { selectedOutcome: null, side: "buy" as const };

export const useTradePanelStore = create<TradePanelState>()(
  devtools(
    (set) => ({
      ...initial,
      selectOutcome: (idx) => set({ selectedOutcome: idx }),
      setSide: (side) => set({ side }),
      reset: () => set(initial),
    }),
    { name: "TradePanelStore" }   // name every store for readable DevTools
  )
);
```

- Always wrap with `devtools` — required for Redux DevTools support.
- Name every store (second arg) so DevTools are readable.
- Use `set` with object spread for partial updates; use `get` inside actions
  when you need to read current state.

## Persist Middleware

Use `persist` only for state that must survive a full page reload. Always use
`partialize` to be explicit about what is stored:

```ts
import { persist } from "zustand/middleware";

export const usePrefsStore = create<PrefsState>()(
  devtools(
    persist(
      (set) => ({ theme: "system", setTheme: (t) => set({ theme: t }) }),
      {
        name: "prefs-store",
        partialize: (state) => ({ theme: state.theme }),  // only persist theme
      }
    ),
    { name: "PrefsStore" }
  )
);
```

Never persist derived state or anything that can be re-fetched from the server.

## Selectors

Use atomic selectors to avoid over-rendering:

```ts
// Good — re-renders only when selectedOutcome changes
const selectedOutcome = useTradePanelStore((s) => s.selectedOutcome);

// Bad — subscribes to the entire store object, re-renders on any change
const store = useTradePanelStore();
```

## Resetting Stores on Auth Change

All stores must be reset when a user signs out. Wire this up in the auth state
listener (not inside individual components):

```ts
// lib/auth/auth-listener.ts
onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") {
    useTradePanelStore.getState().reset();
    // reset other stores...
  }
});
```

Every store must expose a `reset()` action that returns state to its initial value.
