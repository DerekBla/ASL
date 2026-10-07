# Stats Pipeline — AslMarkets.Web

## Flow

```
pnpm stats:fetch     Liquipedia API → data/source/liquipedia/ (wikitext, players)   [network]
pnpm stats:export    parse → data/source/liquipedia/results.json → data/generated/*.json
  → review git diff of data/generated/ and validation.json
  → pnpm stats:test
  → commit source and generated files together
```

Full description: `Docs/tooling-specs/export-stats.md`. Data contract:
`Docs/foundation-specs/stats-data.md`.

## Rules for agents

- **Liquipedia is the source.** The workbook in `data/source/` is a reference copy; nothing
  reads it and it is not to be edited or regenerated.
- **Never hand-edit `data/generated/` or `data/source/liquipedia/results.json`.** If output
  is wrong, fix the parser or exporter and add a test.
- **`data/source/overrides.json` is Derek's.** Propose an entry (display name or race) with
  evidence; add it only when he confirms.
- **Never merge player identities on your own.** Merges come from Liquipedia player pages or
  from Derek's confirmed list in CLAUDE.md. A new case variant needs his confirmation.
- **Placements follow match results**, not Liquipedia's summary tables. When they disagree,
  the exporter records `SOURCE_TABLE_MISMATCH`; don't "correct" the result to match the table.
- **Respect Liquipedia's API terms**: the fetch scripts' User-Agent and 3-second spacing stay.
  Don't fetch in tests or in CI.
- Breaking output change: bump `SCHEMA_VERSION` and update the contract in the same change.
- Sorts need a total order (`name_key`). Determinism tests run in separate processes with
  different `PYTHONHASHSEED`s.

## When a new season finishes

1. Add its page title to `TITLES` in `scripts/liquipedia/fetch_seasons.py`.
2. `pnpm stats:fetch && pnpm stats:export`.
3. Expect 28 players and no problem codes. A `PARSE_PROBLEM` usually means Liquipedia changed
   a template; fix the parser.
4. New players with `UNKNOWN_RACE` go to Derek for an `overrides.json` entry.
