"""Export ASL_Complete_S1_S21.xlsx to typed JSON for the stats site.

Usage:
    python scripts/export-stats/export_stats.py <workbook.xlsx> <out_dir> [--strict]

Design:
- The workbook is human-maintained, so every table is declared in LAYOUT with its exact
  cell range and expected header text. If a header moves or is renamed, the export FAILS
  instead of silently publishing shifted columns. Update LAYOUT deliberately when the
  sheet layout changes.
- Values are exported faithfully (no corrections). Data-quality problems are reported as
  warnings in validation.json; --strict turns warnings into a non-zero exit for CI.
- Output is deterministic (sorted keys, stable row order) so diffs of data/generated/
  are reviewable in git.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

import openpyxl
from openpyxl.utils import column_index_from_string
from openpyxl.worksheet.worksheet import Worksheet

SCHEMA_VERSION = 1
RACES = {"T": "Terran", "Z": "Zerg", "P": "Protoss"}
RACE_NAMES = {v: k for k, v in RACES.items()}


class LayoutError(Exception):
    """The workbook no longer matches LAYOUT. Fix the sheet or update LAYOUT."""


# --------------------------------------------------------------------------- parsers


def is_blank(v: Any) -> bool:
    return v is None or (isinstance(v, str) and v.strip() in ("", "-", "--", "TBD", "?"))


def to_int(v: Any) -> int | None:
    if is_blank(v):
        return None
    if isinstance(v, bool):
        raise ValueError(f"unexpected boolean {v!r}")
    if isinstance(v, (int, float)):
        if float(v) != int(v):
            raise ValueError(f"expected an integer, got {v!r}")
        return int(v)
    s = str(v).strip().replace(",", "").replace("₩", "")
    return int(float(s))


def to_float(v: Any) -> float | None:
    if is_blank(v):
        return None
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return float(v)
    return float(str(v).strip().replace(",", "").replace("₩", "").replace("$", ""))


def to_ratio(v: Any) -> float | None:
    """'40.0%' -> 0.4. Numeric cells are assumed to already be ratios if <= 1, else percents."""
    if is_blank(v):
        return None
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return float(v) if v <= 1 else float(v) / 100
    s = str(v).strip()
    if not s.endswith("%"):
        raise ValueError(f"expected a percentage, got {v!r}")
    return round(float(s[:-1]) / 100, 6)


_RECORD = re.compile(r"^\s*(\d+(?:\.\d+)?)%\s*\((\d+)-(\d+)\)\s*$")


def to_record(v: Any) -> dict[str, Any] | None:
    """'44% (4-5)' -> {"winRate": 0.44, "wins": 4, "losses": 5}. '--' and blanks -> None."""
    if is_blank(v):
        return None
    m = _RECORD.match(str(v))
    if not m:
        raise ValueError(f"expected 'NN% (W-L)', got {v!r}")
    wins, losses = int(m.group(2)), int(m.group(3))
    return {"wins": wins, "losses": losses, "winRate": round(wins / (wins + losses), 6) if wins + losses else None}


def to_str(v: Any) -> str | None:
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def to_name(v: Any) -> str | None:
    """Player name; placeholders like 'TBD' / '?' / '-' mean unknown -> None."""
    return None if is_blank(v) else to_str(v)


def to_race(v: Any) -> str | None:
    """Accepts 'T'/'Z'/'P' or 'Terran'/'Zerg'/'Protoss'; returns the letter code."""
    if is_blank(v):
        return None
    s = str(v).strip()
    if s in RACES:
        return s
    if s in RACE_NAMES:
        return RACE_NAMES[s]
    raise ValueError(f"unknown race {v!r}")


_ORD = r"(\d+)(?:st|nd|rd|th)"
_RANGE = re.compile(rf"^{_ORD}\s*[-–—]\s*{_ORD}$")
_SINGLE = re.compile(rf"^{_ORD}$")


def to_placement(v: Any) -> dict[str, Any] | None:
    """'9th-12th' / '9th–12th' -> {"label": "9th–12th", "best": 9, "worst": 12, "status": "final"}.

    Canonical label uses an en-dash (matches the workbook convention). 'In Prog' / 'Ro16 (In
    Progress)' -> status "in_progress". '-' / blank -> None (did not participate).
    """
    if is_blank(v):
        return None
    s = str(v).strip()
    if "prog" in s.lower():
        return {"label": "In progress", "best": None, "worst": None, "status": "in_progress"}
    m = _RANGE.match(s)
    if m:
        a, b = int(m.group(1)), int(m.group(2))
        return {"label": f"{_ordinal(a)}–{_ordinal(b)}", "best": a, "worst": b, "status": "final"}
    m = _SINGLE.match(s)
    if m:
        a = int(m.group(1))
        return {"label": _ordinal(a), "best": a, "worst": a, "status": "final"}
    raise ValueError(f"unrecognised placement {v!r}")


def _ordinal(n: int) -> str:
    suffix = "th" if 10 <= n % 100 <= 20 else {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n}{suffix}"


def to_season_number(v: Any) -> int:
    """'S18\\n(SSL)' / 'S21\\nProg' / 'S5' -> 18 / 21 / 5."""
    m = re.match(r"^\s*S(\d+)", str(v))
    if not m:
        raise ValueError(f"expected a season header like 'S5', got {v!r}")
    return int(m.group(1))


def to_series_score(v: Any) -> dict[str, int] | None:
    if is_blank(v):
        return None
    m = re.match(r"^\s*(\d+)\s*-\s*(\d+)\s*$", str(v))
    if not m:
        raise ValueError(f"expected a series score like '4-2', got {v!r}")
    return {"winner": int(m.group(1)), "loser": int(m.group(2))}


# --------------------------------------------------------------------------- layout contract


@dataclass(frozen=True)
class Col:
    header: str  # exact header text in the sheet (after strip)
    key: str  # JSON key
    parse: Callable[[Any], Any]


@dataclass(frozen=True)
class Table:
    key: str
    sheet: str
    header_row: int
    first_col: str  # column letter of the first declared column
    columns: tuple[Col, ...]
    first_data_row: int | None = None  # default header_row + 1
    last_data_row: int | None = None  # default: stop at first fully blank row
    stop_at_first_col_values: tuple[str, ...] = ()  # e.g. ("TOTALS",)


SEASON_OVERVIEW = Table(
    key="seasons",
    sheet="Season Overview",
    header_row=2,
    first_col="A",
    columns=(
        Col("S#", "season", to_int),
        Col("Name", "name", to_str),
        Col("Start", "start", to_str),
        Col("End", "end", to_str),
        Col("Prize Pool (₩)", "prizePoolKrw", to_int),
        Col("Approx ($USD)", "prizePoolUsdApprox", to_int),
        Col("Winner", "winner", to_name),
        Col("Race", "winnerRace", to_race),
        Col("Runner-Up", "runnerUp", to_name),
        Col("Race", "runnerUpRace", to_race),
        Col("Notes", "notes", to_str),
    ),
)

ELO = Table(
    key="elo",
    sheet="ELO Ratings",
    header_row=2,
    first_col="A",
    columns=(
        Col("Rank", "rank", to_int),
        Col("Player", "player", to_str),
        Col("Race", "race", to_race),
        Col("Current ELO", "currentElo", to_float),
        Col("Peak ELO", "peakElo", to_float),
        Col("Peak Season", "peakSeason", lambda v: None if is_blank(v) else to_season_number(v)),
        Col("Seasons", "seasons", to_int),
        Col("Championships", "championships", to_int),
    ),
)

PLAYER_STATS = Table(
    key="playerStats",
    sheet="Player Stats",
    header_row=2,
    first_col="A",
    columns=(
        Col("Player", "player", to_str),
        Col("Race", "race", to_race),
        Col("Seasons", "seasons", to_int),
        Col("Best Finish", "bestFinish", to_placement),
        Col("Championships", "championships", to_int),
        Col("Finals", "finals", to_int),
        Col("SF+", "semifinalsOrBetter", to_int),
        Col("QF+", "quarterfinalsOrBetter", to_int),
        Col("Est. Prize (KRW)", "estPrizeKrw", to_int),
        Col("Current ELO", "currentElo", to_float),
    ),
)

S21_TRACKER = Table(
    key="liveTracker",
    sheet="S21 Live Tracker",
    header_row=2,
    first_col="A",
    columns=(
        Col("Player", "player", to_str),
        Col("Race", "race", to_race),
        Col("Current Status", "status", to_str),
        Col("Prize (₩)", "prizeKrw", to_int),
        Col("Notes", "notes", to_str),
    ),
)

RACE_TABLES: tuple[Table, ...] = (
    Table(
        key="overall",
        sheet="Race Stats",
        header_row=4,
        first_col="A",
        columns=(
            Col("Race", "race", to_race),
            Col("Championships", "championships", to_int),
            Col("Runner-Ups", "runnerUps", to_int),
            Col("Finals App.", "finalsAppearances", to_int),
            Col("Win Rate", "titleShare", to_ratio),
            Col("Finals Win %", "finalsWinRate", to_ratio),
            Col("Total Players", "totalPlayers", to_int),
            Col("Player Share %", "playerShare", to_ratio),
            Col("Titles / 100 Players", "titlesPer100Players", to_float),
        ),
        last_data_row=7,
    ),
    Table(
        key="championshipsByEra",
        sheet="Race Stats",
        header_row=4,
        first_col="M",
        columns=(
            Col("Era", "era", to_str),
            Col("T Champs", "terran", to_int),
            Col("Z Champs", "zerg", to_int),
            Col("P Champs", "protoss", to_int),
            Col("Total Seasons", "totalSeasons", to_int),
            Col("Dominant Race", "dominantRace", to_race),
        ),
        last_data_row=8,
    ),
    Table(
        key="participantsBySeason",
        sheet="Race Stats",
        header_row=10,
        first_col="A",
        columns=(
            Col("Season", "seasonName", to_str),
            Col("Terran", "terran", to_int),
            Col("Zerg", "zerg", to_int),
            Col("Protoss", "protoss", to_int),
            Col("Total", "total", to_int),
        ),
        last_data_row=31,
        stop_at_first_col_values=("TOTALS",),
    ),
    Table(
        key="playoffSeriesS13toS20",
        sheet="Race Stats",
        header_row=10,
        first_col="G",
        columns=(
            Col("Race Matchup", "matchup", to_str),
            Col("Series W", "wins", to_int),
            Col("Series L", "losses", to_int),
            Col("Total", "total", to_int),
            Col("Win Rate", "winRate", to_ratio),
            Col("Sample Size", "sampleSize", to_str),
        ),
        last_data_row=16,
    ),
    Table(
        key="grandFinalsByMatchup",
        sheet="Race Stats",
        header_row=19,
        first_col="G",
        columns=(
            Col("Finals Matchup", "matchup", to_str),
            Col("Winner Race", "race", to_race),
            Col("Wins", "wins", to_int),
            Col("Total Finals", "totalFinals", to_int),
            Col("Win Rate", "winRate", to_ratio),
            Col("Note", "note", to_str),
        ),
        last_data_row=25,
    ),
    Table(
        key="playoffMatrixS13toS20",
        sheet="Race Stats",
        header_row=28,
        first_col="G",
        columns=(
            Col("Race / Opp", "race", to_race),
            Col("Terran", "vsTerran", to_record),
            Col("Zerg", "vsZerg", to_record),
            Col("Protoss", "vsProtoss", to_record),
        ),
        last_data_row=31,
    ),
    Table(
        key="finalsBySeason",
        sheet="Race Stats",
        header_row=10,
        first_col="M",
        columns=(
            Col("Season", "seasonName", to_str),
            Col("Champion", "champion", to_str),
            Col("Race", "championRace", to_race),
            Col("Runner-Up", "runnerUp", to_name),
            Col("Race", "runnerUpRace", to_race),
            Col("Score", "score", to_series_score),
        ),
        last_data_row=30,
    ),
    Table(
        key="matchupsAllStages",
        sheet="Race Stats",
        header_row=35,
        first_col="A",
        columns=(
            Col("Matchup", "matchup", to_str),
            Col("Wins", "wins", to_int),
            Col("Losses", "losses", to_int),
            Col("Total", "total", to_int),
            Col("Win Rate", "winRate", to_ratio),
            Col("Assessment", "assessment", to_str),
        ),
        last_data_row=38,
    ),
    Table(
        key="matchupsAllStagesMirror",
        sheet="Race Stats",
        header_row=35,
        first_col="H",
        columns=(
            Col("Matchup", "matchup", to_str),
            Col("Wins", "wins", to_int),
            Col("Losses", "losses", to_int),
            Col("Total", "total", to_int),
            Col("Win Rate", "winRate", to_ratio),
        ),
        last_data_row=38,
    ),
    Table(
        key="matrixAllStages",
        sheet="Race Stats",
        header_row=42,
        first_col="A",
        columns=(
            Col("Race / Opp", "race", to_race),
            Col("Terran", "vsTerran", to_record),
            Col("Zerg", "vsZerg", to_record),
            Col("Protoss", "vsProtoss", to_record),
        ),
        last_data_row=45,
    ),
)

PLACEMENTS_SHEET = "Player Placements"
EXPECTED_SHEETS = (
    "Season Overview",
    PLACEMENTS_SHEET,
    "ELO Ratings",
    "Player Stats",
    "Race Stats",
    "S21 Live Tracker",
)


def _norm_header(v: Any) -> str:
    return re.sub(r"\s+", " ", str(v)).strip() if v is not None else ""


def read_table(wb: openpyxl.Workbook, t: Table) -> list[dict[str, Any]]:
    ws: Worksheet = wb[t.sheet]
    c0 = column_index_from_string(t.first_col)
    actual = [_norm_header(ws.cell(t.header_row, c0 + i).value) for i in range(len(t.columns))]
    expected = [c.header for c in t.columns]
    if actual != expected:
        raise LayoutError(
            f"[{t.sheet}] table '{t.key}' header at {t.first_col}{t.header_row} changed.\n"
            f"  expected: {expected}\n  actual:   {actual}"
        )
    out: list[dict[str, Any]] = []
    r = t.first_data_row or t.header_row + 1
    last = t.last_data_row or ws.max_row
    while r <= last:
        raw = [ws.cell(r, c0 + i).value for i in range(len(t.columns))]
        if all(v is None for v in raw):
            if t.last_data_row is None:
                break
            r += 1
            continue
        if t.stop_at_first_col_values and to_str(raw[0]) in t.stop_at_first_col_values:
            break
        row: dict[str, Any] = {}
        for col, v in zip(t.columns, raw):
            try:
                row[col.key] = col.parse(v)
            except (ValueError, TypeError) as e:
                raise LayoutError(f"[{t.sheet}] {t.first_col}..{r} column '{col.header}': {e}") from e
        out.append(row)
        r += 1
    return out


def read_placements(wb: openpyxl.Workbook) -> tuple[list[dict[str, Any]], list[int]]:
    """Wide Player x Season grid -> long rows {player, race, season, placement}."""
    ws = wb[PLACEMENTS_SHEET]
    header = [ws.cell(2, c).value for c in range(1, ws.max_column + 1)]
    norm = [_norm_header(h) for h in header]
    if norm[:2] != ["Player", "Race"] or norm[-2:] != ["Played", "Best"]:
        raise LayoutError(f"[{PLACEMENTS_SHEET}] expected Player, Race, S1..Sn, Played, Best; got {norm}")
    season_cols = header[2:-2]
    seasons = [to_season_number(h) for h in season_cols]
    if seasons != list(range(1, len(seasons) + 1)):
        raise LayoutError(f"[{PLACEMENTS_SHEET}] season columns are not S1..S{len(seasons)} in order: {season_cols}")
    rows: list[dict[str, Any]] = []
    for r in range(3, ws.max_row + 1):
        player = to_str(ws.cell(r, 1).value)
        if player is None:
            continue
        race = to_race(ws.cell(r, 2).value)
        for i, s in enumerate(seasons):
            v = ws.cell(r, 3 + i).value
            try:
                p = to_placement(v)
            except ValueError as e:
                raise LayoutError(f"[{PLACEMENTS_SHEET}] row {r} ({player}) S{s}: {e}") from e
            if p is not None:
                rows.append({"player": player, "race": race, "season": s, "placement": p})
    return rows, seasons


# --------------------------------------------------------------------------- validation


def validate(data: dict[str, Any]) -> list[dict[str, str]]:
    """Cross-tab consistency checks. Returns warnings; never mutates data."""
    w: list[dict[str, str]] = []

    def warn(code: str, msg: str) -> None:
        w.append({"code": code, "message": msg})

    races_by_tab: dict[str, dict[str, str | None]] = {
        "placements": {r["player"]: r["race"] for r in data["placements"]},
        "elo": {r["player"]: r["race"] for r in data["elo"]},
        "playerStats": {r["player"]: r["race"] for r in data["playerStats"]},
        "liveTracker": {r["player"]: r["race"] for r in data["liveTracker"]},
    }
    all_names = set().union(*[set(d) for d in races_by_tab.values()])
    for s in data["seasons"]:
        for k in ("winner", "runnerUp"):
            if s[k]:
                all_names.add(s[k])

    groups: dict[str, set[str]] = defaultdict(set)
    for n in all_names:
        groups[n.lower()].add(n)
    for variants in sorted(groups.values(), key=lambda g: sorted(g)[0].lower()):
        if len(variants) > 1:
            warn("PLAYER_CASE_VARIANTS", f"Possible duplicate identity (case variants): {sorted(variants)}")

    for n in sorted(all_names):
        seen = {tab: d[n] for tab, d in races_by_tab.items() if n in d}
        if len(set(seen.values())) > 1:
            warn("RACE_CONFLICT", f"{n} has different races across tabs: {seen}")

    known = set(races_by_tab["placements"])
    for s in data["seasons"]:
        for k in ("winner", "runnerUp"):
            if s[k] and s[k] not in known:
                warn("UNKNOWN_PLAYER", f"Season {s['season']} {k} '{s[k]}' is not a row in Player Placements")
    for n in sorted(set(races_by_tab["liveTracker"]) - known):
        warn("UNKNOWN_PLAYER", f"Live tracker player '{n}' is not a row in Player Placements")

    by_season: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for r in data["placements"]:
        by_season[r["season"]].append(r)
    for s in data["seasons"]:
        rows = by_season.get(s["season"], [])
        firsts = sorted(r["player"] for r in rows if r["placement"]["best"] == 1 and r["placement"]["worst"] == 1)
        seconds = sorted(r["player"] for r in rows if r["placement"]["best"] == 2 and r["placement"]["worst"] == 2)
        if s["winner"] and firsts != [s["winner"]]:
            warn("FINALS_MISMATCH", f"S{s['season']}: Season Overview winner '{s['winner']}' vs placements 1st {firsts}")
        if s["runnerUp"] and seconds != [s["runnerUp"]]:
            warn("FINALS_MISMATCH", f"S{s['season']}: Season Overview runner-up '{s['runnerUp']}' vs placements 2nd {seconds}")

    champs = Counter(s["winner"] for s in data["seasons"] if s["winner"])
    for r in data["playerStats"]:
        if r["championships"] != champs.get(r["player"], 0):
            warn(
                "CHAMPIONSHIP_MISMATCH",
                f"{r['player']}: Player Stats championships={r['championships']} but Season Overview lists {champs.get(r['player'], 0)}",
            )

    for r in data["playerStats"]:
        p = r["estPrizeKrw"]
        if p is not None and 0 < p < 100_000:
            warn("SUSPECT_VALUE", f"{r['player']}: Est. Prize (KRW) is {p:,}; looks like a missing scale (expected millions)")

    in_progress = {r["player"] for r in data["placements"] if r["placement"]["status"] == "in_progress"}
    tracker_alive = {r["player"] for r in data["liveTracker"] if r["status"] and "progress" in r["status"].lower()}
    if tracker_alive and in_progress != tracker_alive:
        warn(
            "LIVE_STATUS_MISMATCH",
            f"In-progress players differ: placements={sorted(in_progress)} tracker={sorted(tracker_alive)}",
        )
    return w


# --------------------------------------------------------------------------- export


def export(xlsx: Path, out_dir: Path) -> dict[str, Any]:
    wb = openpyxl.load_workbook(xlsx, data_only=True, read_only=False)
    missing = [s for s in EXPECTED_SHEETS if s not in wb.sheetnames]
    if missing:
        raise LayoutError(f"missing sheets {missing}; found {wb.sheetnames}")
    extra = [s for s in wb.sheetnames if s not in EXPECTED_SHEETS]

    placements, seasons = read_placements(wb)
    tracker_ws = wb[S21_TRACKER.sheet]
    tracker_note = next(
        (to_str(c.value) for c in tracker_ws["A"][S21_TRACKER.header_row:] if isinstance(c.value, str) and c.value.startswith("Last Updated")),
        None,
    )
    data: dict[str, Any] = {
        "seasons": read_table(wb, SEASON_OVERVIEW),
        "placements": placements,
        "elo": read_table(wb, ELO),
        "playerStats": read_table(wb, PLAYER_STATS),
        "raceStats": {t.key: read_table(wb, t) for t in RACE_TABLES},
        "liveTracker": read_table(wb, S21_TRACKER),
    }
    for s in data["seasons"]:
        s["status"] = "in_progress" if s["winner"] is None else "complete"

    players = sorted(
        ({"player": p, "race": r} for p, r in {(x["player"], x["race"]) for x in placements}),
        key=lambda x: (x["player"].lower(), x["player"]),  # tie-break: case variants must not depend on hash order
    )
    warnings = validate(data)

    out_dir.mkdir(parents=True, exist_ok=True)
    files = {
        "seasons.json": data["seasons"],
        "players.json": players,
        "placements.json": placements,
        "elo.json": data["elo"],
        "player-stats.json": data["playerStats"],
        "race-stats.json": data["raceStats"],
        "live-tracker.json": {"lastUpdatedNote": tracker_note, "rows": data["liveTracker"]},
        "validation.json": warnings,
    }
    for name, payload in files.items():
        _write_json(out_dir / name, payload)

    manifest = {
        "schemaVersion": SCHEMA_VERSION,
        "source": {"file": xlsx.name, "sha256": hashlib.sha256(xlsx.read_bytes()).hexdigest()},
        "seasons": {"count": len(seasons), "complete": sum(1 for s in data["seasons"] if s["status"] == "complete")},
        "counts": {
            "seasons": len(data["seasons"]),
            "players": len(players),
            "placements": len(placements),
            "elo": len(data["elo"]),
            "playerStats": len(data["playerStats"]),
            "liveTracker": len(data["liveTracker"]),
            **{f"raceStats.{k}": len(v) for k, v in data["raceStats"].items()},
        },
        "ignoredSheets": extra,
        "warnings": len(warnings),
    }
    _write_json(out_dir / "manifest.json", manifest)
    return {"manifest": manifest, "warnings": warnings}


def _write_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("xlsx", type=Path)
    ap.add_argument("out_dir", type=Path)
    ap.add_argument("--strict", action="store_true", help="exit 2 if validation produced warnings")
    args = ap.parse_args(argv)
    try:
        result = export(args.xlsx, args.out_dir)
    except LayoutError as e:
        print(f"LAYOUT ERROR: {e}", file=sys.stderr)
        return 1
    m = result["manifest"]
    print(f"Exported {m['counts']['players']} players, {m['counts']['placements']} placements, {m['counts']['seasons']} seasons -> {args.out_dir}")
    for w in result["warnings"]:
        print(f"  WARN {w['code']}: {w['message']}")
    if args.strict and result["warnings"]:
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
