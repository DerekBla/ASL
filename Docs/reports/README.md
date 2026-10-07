# Reports — AslMarkets.Web

> **Generated output only.** Do not hand-author files in this folder. Reports are
> produced by agents or automation scripts. If a report is wrong, re-run the
> process that generated it — do not edit the report file directly.

## Report Types

| Report | Generator | Cadence |
|---|---|---|
| Spec review | `spec-reviewer` agent | On demand (before feature work begins) |
| Debt audit | `debt-auditor` agent | On demand or scheduled |
| Stats validation | `stats-curator` agent | After each workbook update |
| Ledger audit | `ledger-auditor` agent | Before ledger releases; on demand |
| Bundle size | `pnpm build` + size-limit | Each release |
| Test coverage | `pnpm test --coverage` | Each CI run |
| Dependency audit | `pnpm audit` | Weekly (CI) |

## File Naming Convention

```
reports/<YYYY-MM-DD>-<type>-<slug>.md
```

Examples:
```
reports/2026-10-06-stats-validation.md
reports/2026-10-20-spec-review-markets.md
reports/2026-11-01-ledger-audit-resolve-market.md
```

## Retention

Reports older than 90 days may be archived or deleted. They are snapshots for
human review — the codebase and specs are the source of truth. When a report leads
to action (a ROADMAP entry, a spec change), record that action in the relevant
file, not in the report itself.
