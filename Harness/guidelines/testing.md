# Testing — StarCoins

## What to Test Where

| Layer | Tool | What |
|---|---|---|
| Pure utilities (`lib/utils/`, `lib/market/`) | Vitest | All branches and edge cases; property-style tests for LMSR invariants |
| Ledger service (`lib/services/ledger/`) | Vitest + PGlite (functional) / real Postgres (concurrency) | Every operation, every rejection code, idempotent replay, invariants after each test |
| Stats pipeline (`scripts/liquipedia/`, `scripts/export-stats/`) | Python `unittest` | Wikitext parsing, group standings, ELO, real-source integration, determinism, freshness |
| Stats loader (`lib/services/stats/`) | Vitest | Zod schemas accept current `data/generated/`, reject a bumped `schemaVersion` |
| React components | Vitest + Testing Library | Behavior from the user's perspective |
| Server Actions | Vitest | Input validation, return shapes, error paths |
| TanStack Query hooks | Vitest + Testing Library | Loading, error, and success states |
| Zustand stores | Vitest | Store actions and state transitions |
| Critical user journeys | Playwright | End-to-end happy paths only |

---

## Testing Library Principles

- Query by **role** first (`getByRole`), then **label** (`getByLabelText`),
  then **text** (`getByText`). Use `getByTestId` only as a last resort for elements
  with no semantic role.
- Assert what the **user sees and can do**, not what the DOM contains.
  No snapshot tests of rendered markup.
- Wrap async assertions in `waitFor`. Never use `setTimeout` or `sleep` in tests.
- One logical outcome per `it` block. Multiple assertions are fine if they describe
  the same outcome.

---

## Vitest Example

```ts
// features/markets/components/__tests__/OutcomeRow.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { OutcomeRow } from "../OutcomeRow";
import { makeOutcome } from "@/test/factories/market";

it("calls onSelect when the Buy button is clicked", async () => {
  const user = userEvent.setup();
  const onSelect = vi.fn();
  const outcome = makeOutcome({ label: "Flash", price: 0.62 });

  render(<OutcomeRow outcome={outcome} onSelect={onSelect} />);

  await user.click(screen.getByRole("button", { name: /buy flash/i }));
  expect(onSelect).toHaveBeenCalledOnce();
});
```

---

## Test Factories

Define typed factories in `src/test/factories/`. Use `@faker-js/faker` for
realistic data, seeded for determinism:

```ts
// src/test/factories/market.ts
import { faker } from "@faker-js/faker";
faker.seed(42);

export function makeOutcome(overrides: Partial<OutcomeView> = {}): OutcomeView {
  return {
    idx: 0,
    label: faker.helpers.arrayElement(["Flash", "Soulkey", "SnOw", "Rush"]),
    player: null,
    price: 0.5,
    ...overrides,
  };
}
```

Never inline raw object literals for domain types directly in test files.

---

## Mocking Strategy

Mock at the **service boundary** (`lib/services/*`), not inside components or
inside React hooks. **Never mock the ledger in ledger tests**, and never mock `lib/market/`
anywhere. Both are the thing under test. This keeps tests meaningful and avoids over-specification of
internal wiring.

```ts
// Mock the service, not fetch
vi.mock("@/lib/services/markets-read", () => ({
  getMarket: vi.fn().mockResolvedValue(makeMarket()),
}));
```

Rules:
- `vi.mock()` calls go at the top of the test file.
- Each test sets up its own mock return values via `vi.mocked(fn).mockResolvedValue(...)`.
- No shared mock state between test files. Each file is independent.

---

## TanStack Query Wrapper

Wrap components that use `useQuery` with a `QueryClientProvider` in tests:

```ts
// src/test/utils/render-with-query.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";

export function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}
```

Set `retry: false` in test QueryClients — retries hide failures.

---

## Playwright E2E

- One spec file per user journey: `e2e/place-trade.spec.ts`, `e2e/browse-stats.spec.ts`.
- Use the **page object model**: `e2e/pages/MarketPage.ts` encapsulates selectors and
  actions. Never inline `page.locator(...)` calls in test bodies.
- Tests are fully independent. Each test creates its own state via API calls or
  database seeding — never by running prior UI flows.
- Run against `http://localhost:3000` (started with `pnpm dev` before `pnpm test:e2e`).

---

## Python (exporter)

- Tests live in `scripts/liquipedia/tests/` and `scripts/export-stats/tests/`. Run `pnpm stats:test`.
- Integration tests run against the committed Liquipedia source and are skipped when it is absent.
- Tests never touch the network. To test failure handling, copy `results.json` to a temp dir,
  break it there, and assert on the exit code and validation output.

## Coverage

- 80% line coverage on new files is a **guideline**, not a CI gate.
- Do not write tests purely to hit a number.
- Zero tests on a new feature or bug fix is never acceptable.
