# Code Validation Pipeline — AslMarkets.Web

Run steps in order. A step may not be skipped. Do not mark a task complete
until all steps pass. Steps marked *(after …)* activate once that ROADMAP item is
implemented.

---

## Pipeline

### 1. Type Check

```bash
pnpm typecheck
# tsc --noEmit
```

Zero errors required.

### 2. Lint

```bash
pnpm lint
# eslint . --max-warnings 0
```

Zero warnings. Fix the root cause. If suppression is truly necessary, add a comment
explaining why and reference the `code-checklist.yml` rule it conflicts with.

### 3. Format Check

```bash
pnpm format:check
# prettier --check .
```

### 4. Unit + Integration Tests

```bash
pnpm test
# vitest run
```

All tests pass. New code requires new tests per `test-1` in `code-checklist.yml`.

### 5. Stats Exporter Tests

```bash
pnpm stats:test
# python -m unittest discover -s scripts/liquipedia/tests -v && ... -s scripts/export-stats/tests -v
```

Required whenever `scripts/liquipedia/`, `scripts/export-stats/`, or `data/source/` changes.

### 6. Stats Freshness

```bash
pnpm stats:export && git diff --exit-code data/generated
```

Generated JSON must match the committed Liquipedia source. A diff means the source or an
override changed without re-exporting (or someone edited the JSON by hand). New validation warnings must be called
out in the PR description.

### 7. Ledger Concurrency Test *(after ledger service)*

```bash
pnpm test:ledger-concurrency
```

Required when anything in `lib/services/ledger/` or `lib/db/schema.ts` changes. Runs against
a real Postgres (`DATABASE_URL_TEST`, a Neon dev branch or local Docker).

### 8. E2E Tests (critical paths only) *(after Playwright setup)*

```bash
pnpm test:e2e
# playwright test
```

Critical paths: browse stats → player page; sign in → trade → see position; admin resolve →
payout visible.

### 9. Build

```bash
pnpm build
# next build
```

---

## CI Enforcement

The GitHub Actions workflow runs steps 1–6, 8, and 9 on every PR (step 7 when ledger paths
change). PRs cannot merge with a failing pipeline. Local pre-commit hooks run steps 1–3 only.

---

## Agent Pre-PR Checklist

- [ ] `pnpm typecheck` — zero errors
- [ ] `pnpm lint` — zero warnings
- [ ] `pnpm format:check` — clean
- [ ] `pnpm test` — all pass
- [ ] `pnpm stats:test` — all pass (if the stats scripts or `data/source/` were touched)
- [ ] `data/generated/` matches a fresh export
- [ ] Ledger concurrency test (if ledger or schema touched)
- [ ] `pnpm test:e2e` — critical paths pass
- [ ] `pnpm build` — succeeds
- [ ] `code-checklist.yml` reviewed — no blocking rules violated (especially `money-*`)
- [ ] ROADMAP updated if an item moved status
- [ ] `Docs/` specs updated if public contracts changed
