# Stats Pipeline — AslMarkets.Web

## Flow

```
Derek edits data/source/ASL_Complete_S1_S21.xlsx in Excel
  → pnpm stats:export          (writes data/generated/*.json, prints warnings)
  → review git diff of data/generated/
  → commit xlsx + generated JSON together
```

## Rules for agents

- **Never edit the workbook** without Derek's explicit approval for that specific change.
  Propose fixes as a list (cell, current value, proposed value, evidence).
- **Never hand-edit `data/generated/`.** If output is wrong, fix the workbook or the exporter.
- **Never merge player identities** (case variants, real name vs handle) without Derek's
  confirmation. Unconfirmed variants stay separate and stay in `validation.json`.
- When a header or table moves in the workbook, the export fails with `LAYOUT ERROR`. Update
  the matching `Table(...)` in `LAYOUT` deliberately. Don't loosen the check.
- New tab or table: add a `Table` declaration, a parser per column, a key in the output, a
  type in `Docs/foundation-specs/stats-data.md`, and a Zod schema in `lib/services/stats/`.
- Breaking output change: bump `SCHEMA_VERSION`.
- Keep the workbook conventions: en-dash placement ranges, `₩` prize columns, race color
  scheme (CLAUDE.md Domain Rules), all six tabs preserved.

## When a new season starts

1. Derek adds the season column/rows in the workbook (and a new live tracker, if wanted).
2. Season header must match `S<n>` (suffix text after a newline is allowed).
3. Run export; expect `FINALS_MISMATCH` warnings for the in-progress season until it ends.
   That's expected while `winner` is TBD.
