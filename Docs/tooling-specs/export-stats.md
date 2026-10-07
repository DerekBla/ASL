# Tooling Spec: Stats Exporter

**Status**: implemented
**Invocation**: `pnpm stats:export` (wraps `python scripts/export-stats/export_stats.py <xlsx> <out_dir> [--strict]`)
**Location**: `scripts/export-stats/export_stats.py` · tests: `scripts/export-stats/tests/`

## Purpose

Turns Derek's Excel workbook into the typed JSON the site reads (contract:
`Docs/foundation-specs/stats-data.md`). It enforces the workbook layout so edits can't silently
shift columns into the wrong fields, and it cross-checks tabs so data problems surface before
they're published.

## Interface

```bash
python scripts/export-stats/export_stats.py data/source/ASL_Complete_S1_S21.xlsx data/generated
python scripts/export-stats/export_stats.py <xlsx> <out_dir> --strict   # exit 2 if any warnings
```

| Argument | Required | Description |
|---|---|---|
| `xlsx` | yes | Path to the workbook |
| `out_dir` | yes | Output folder (created if missing) |
| `--strict` | no | Treat validation warnings as failure |

Exit codes: `0` ok · `1` layout error (nothing trustworthy written) · `2` warnings under `--strict`.

Requirements: Python 3.12+, `pip install openpyxl`.

## Output

`manifest.json`, `seasons.json`, `players.json`, `placements.json`, `elo.json`,
`player-stats.json`, `race-stats.json`, `live-tracker.json`, `validation.json`.

## How it works

1. **Layout contract**: each table is a `Table(sheet, header_row, first_col, columns)` entry.
   Headers must match exactly (whitespace-normalized) or the run fails with `LAYOUT ERROR`.
   Race Stats is ten separately declared tables.
2. **Typed parsing per column**: ints (rejects fractions, strips `₩` and commas), ratios
   (`"40.0%"` → `0.4`), W-L records (`"44% (4-5)"`), placements (hyphen or en-dash, singles,
   `In Prog`), race codes, and names (`TBD` → null).
3. **Validation** (warnings, never corrections):

| Code | Checks |
|---|---|
| `PLAYER_CASE_VARIANTS` | Same name differing only by case across any tab |
| `RACE_CONFLICT` | One player, different races across tabs |
| `UNKNOWN_PLAYER` | Finalist or tracker player missing from Player Placements |
| `FINALS_MISMATCH` | Season Overview winner/runner-up vs placements 1st/2nd |
| `CHAMPIONSHIP_MISMATCH` | Player Stats titles vs Season Overview winners |
| `SUSPECT_VALUE` | Prize values that look unscaled (< ₩100,000) |
| `LIVE_STATUS_MISMATCH` | In-progress players in placements vs live tracker |

## First run (2026-10-06): 14 warnings

| Warning | Detail |
|---|---|
| Case variants | `BeSt`/`Best`, `EffOrt`/`Effort`/`effOrt`, `herO`/`hero`, `HyuN`/`Hyun`, `SnOw`/`Snow` |
| Race conflict | Jaedong is `T` in S21 Live Tracker, `Z` everywhere else |
| Unknown player | `Snow` as S5/S8 runner-up in Season Overview (placements use `SnOw`); `Yoon Soo-chul` and `herO` in tracker only |
| Finals mismatch | S5, S8 (`Snow` vs `SnOw`) |
| Suspect value | `Best` Est. Prize (KRW) = 4 |
| Live status | Tracker has `herO` and `Yoon Soo-chul` in Ro16; placements S21 column doesn't mark them In Prog |

Not flagged by code, but noticed during review: tracker row for `sSak` has the note "lost to
sSak"; S21 data was last updated 2026-04-26 and the season ended 2026-05-24.

## Agent Usage Notes

- Use the `stats-curator` persona for triage. Never fix by editing JSON.
- When a `LAYOUT ERROR` appears after a deliberate workbook change, update `LAYOUT` in the
  same commit as the xlsx and re-run the tests.
