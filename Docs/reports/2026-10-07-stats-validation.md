# Stats Validation Report — 2026-10-07

**Persona**: stats-curator · **Workbook**: `data/source/ASL_Complete_S1_S21.xlsx` (commit `57d010e`)
**Export**: 90 players, 572 placements, 21 seasons · **Warnings**: 14 · **Tests**: `stats:test` 20/20 pass

Nothing in the workbook or `data/generated/` was changed. Every proposed fix below needs
Derek's approval, cell by cell. Identity merges also need Derek's confirmation and belong in
the future `data/player-aliases.json` (Data roadmap), not in silent renames.

## Summary

| # | Warning(s) | Classification | Decision needed |
|---|---|---|---|
| 1 | `PLAYER_CASE_VARIANTS` SnOw/Snow, `UNKNOWN_PLAYER` S5/S8, `FINALS_MISMATCH` S5/S8 | workbook error | Approve 4 cell edits → clears 5 warnings |
| 2 | `RACE_CONFLICT` Jaedong | workbook error | Approve 1 cell edit |
| 3 | `SUSPECT_VALUE` Best prize = 4 | workbook error | Supply the correct value |
| 4 | `PLAYER_CASE_VARIANTS` BeSt/Best | identity question | Same player? |
| 5 | `PLAYER_CASE_VARIANTS` EffOrt/Effort/effOrt | identity question + possible workbook error | Same player(s)? Which S5 row is right? |
| 6 | `PLAYER_CASE_VARIANTS` HyuN/Hyun | identity question | Same player? |
| 7 | `PLAYER_CASE_VARIANTS` herO/hero, `UNKNOWN_PLAYER` herO | workbook error (spelling) + stale S21 | Approve 1 cell edit; see #8 |
| 8 | `UNKNOWN_PLAYER` Yoon Soo-chul, `LIVE_STATUS_MISMATCH` | expected (S21 data stale) | Enter S21 final results |

---

## Workbook errors

### 1. `Snow` should be `SnOw` (CLAUDE.md: SnOw is canonical)

`Snow` appears only in finals cells. Every per-player tab uses `SnOw`, and Player Placements
shows `SnOw` finishing 2nd in S5 (G68) and S8 (J68).

| Tab | Cell | Current | Proposed | Evidence |
|---|---|---|---|---|
| Season Overview | I7 (S5 runner-up) | `Snow` | `SnOw` | Player Placements G68 = `2nd` |
| Season Overview | I10 (S8 runner-up) | `Snow` | `SnOw` | Player Placements J68 = `2nd` |
| Race Stats | P15 (finals by season, S5) | `Snow` | `SnOw` | same as above; the exporter doesn't flag this table, but it should match |
| Race Stats | P18 (finals by season, S8) | `Snow` | `SnOw` | same |

Clears: `PLAYER_CASE_VARIANTS` SnOw/Snow, both `UNKNOWN_PLAYER` S5/S8, and both `FINALS_MISMATCH`.

### 2. Jaedong is Zerg

| Tab | Cell | Current | Proposed | Evidence |
|---|---|---|---|---|
| S21 Live Tracker | B4 | `T` | `Z` | Player Placements B30, ELO Ratings C20, and Player Stats B20 all say `Z` |

### 3. Best's estimated prize

| Tab | Cell | Current | Proposed | Evidence |
|---|---|---|---|---|
| Player Stats | I10 | `4` | **Derek to supply** (roughly ₩15–25M) | see below |

`4` is below every single-placement payout in the workbook. The lowest tracker payout is
₩1,000,000. Best's S1–S20 placements are one 2nd (S19), one 3rd (S15), two 5th–8th, two
9th–12th, one 13th–16th, and one 23rd–28th.

I fit a per-placement prize table to the other 89 players' Player Stats totals by least
squares. It's only a rough check, because prize schedules vary by season (worst residual
about ₩11.8M). That fit predicts about **₩20.5M** for Best. The 2nd and 3rd place alone come
to about ₩14M. The original value was probably entered in millions or lost its scale. Please
take the real figure from your source, not from this estimate.

### 7. `herO` should be `hero` (CLAUDE.md: hero is Zerg; workbook uses `hero` everywhere else)

| Tab | Cell | Current | Proposed | Evidence |
|---|---|---|---|---|
| S21 Live Tracker | A9 | `herO` | `hero` | Season Overview I6/I19, Player Placements A87, ELO B35, and Player Stats A35 all say `hero` |

> Note: the player's own stylization is `herO`. If you'd rather make **that** canonical,
> the change is the reverse: rename `hero` in five tabs. Either way, pick one. I've proposed the
> smaller edit, consistent with CLAUDE.md.

This clears the case-variant warning and one `UNKNOWN_PLAYER` warning. hero's S21 placement
is still `-` in Player Placements (W87), though the tracker says he reached Ro16. That's
covered in #8.

### Minor (not flagged by the exporter)

| Tab | Cell | Current | Note |
|---|---|---|---|
| S21 Live Tracker | E11 (sSak row) | `Eliminated Ro24 Group A lost to sSak` | Says sSak lost to himself. This note probably belongs on another player's row, or should name a different opponent |
| S21 Live Tracker | E10 | `Advance from Ro24 Group C` | Typo: `Advanced` (cosmetic) |

---

## Identity questions — do not merge without confirmation

For each one, the question is whether this is one person. If yes, a confirmed entry goes into
`data/player-aliases.json`, or the workbook rows are combined. If no, the rows stay separate
and the warning is suppressed by an approved "distinct players" entry.

### 4. BeSt / Best (Protoss)

| Variant | Row | Seasons with a placement | Best | ELO (current / peak) |
|---|---|---|---|---|
| `BeSt` | Placements A9 | S1–S12 (12 seasons, every one) | 3rd | 1241.8 / 1780.7 |
| `Best` | Placements A10 | S13–S21 (9 seasons, every one) | 2nd | 1919.1 / 1919.1 |

No season overlaps, and the handoff falls exactly between S12 and S13. That pattern strongly
suggests one career split across two rows. If it is one person, the merged player has 21
straight seasons, and both ELO rows are wrong. ELO is cumulative, so the S13+ row restarted
from 1500. **Merging means recomputing ELO**, not just adding the rows.

### 5. EffOrt / Effort / effOrt (Zerg)

| Variant | Row | Seasons | Best | ELO |
|---|---|---|---|---|
| `EffOrt` | Placements A17 | S1–S7, S16 (8) | 1st (S6 champion) | 1986.9 |
| `Effort` | Placements A18 | **S5** only — 9th–12th | 9th–12th | 1649.9 |
| `effOrt` | Placements A83 | S20 only — 5th–8th | 5th–8th | 1765.3 |

⚠️ **S5 conflict.** `EffOrt` (G17) has `23rd–28th` and `Effort` (G18) has `9th–12th` in the
same season. One player can't have two placements in one season. Either one S5 cell is a
duplicate entry (a workbook error), or `Effort` is a different player. Please check S5
results before merging. `effOrt` (S20) has no overlap and looks like a capitalization slip.

### 6. HyuN / Hyun (Zerg)

| Variant | Row | Seasons | Best | ELO |
|---|---|---|---|---|
| `HyuN` | Placements A26 | S12, S15, S19, S20 | 17th–22nd | 1486.8 |
| `Hyun` | Placements A28 | S3 only | 9th–12th | 1623.1 |

No overlap. That's plausibly one player, but the evidence is weaker than BeSt/Best: there's a
nine-season gap and only one season on the `Hyun` row.

---

## Expected — S21 is stale, not wrong

### 8. S21 tracker vs placements (`LIVE_STATUS_MISMATCH`, `UNKNOWN_PLAYER` Yoon Soo-chul)

The tracker (A30) says "Last Updated: April 26, 2026", and Season Overview D23 puts S21's end
at **2026-05-24**. Winner and runner-up are still `TBD`, so the exporter correctly keeps S21
`in_progress`.

- The tracker has 8 players in Ro16. Placements marks 6 as `In Prog`: BarrackS, Bisu,
  Flash, Jaedong, SnOw, soma.
- Missing from placements: **hero** (W87 is `-`), and **Yoon Soo-chul**, who has no
  Placements row at all.
- `Yoon Soo-chul` is a real name, while every other row uses a handle. **Identity question:**
  is this a player who already has a row under a handle? If so, the tracker should use that
  handle. If he's new, he needs a Player Placements row with race `Z`.

**Fix**: enter S21 final results (the Data roadmap item "S21 final results"), covering winner,
runner-up and races in Season Overview row 23, plus a final placement in column W for all
eight Ro16 players. That clears the remaining warnings.

---

## Exporter note (not a data problem)

On Windows, `export_stats.py` writes JSON with CRLF line endings. `.gitattributes`
(`eol=lf`) normalizes them, so git shows no real diff. A byte-level freshness check, like the
one planned in CI, would see every file as changed, though. Fix: open output files with
`newline="\n"`. That's an exporter change for a future task, not done here.

## After Derek's decisions

1. Derek edits the xlsx (approved cells only) → `pnpm stats:export` → review the
   `data/generated/` diff → commit the xlsx and JSON together.
2. Confirmed identities go into the "Player identity map" roadmap item.
3. If BeSt/Best or EffOrt variants merge, ELO and Player Stats need recomputing. That's a
   reason to prioritize "Compute derived stats in the pipeline".
