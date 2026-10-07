"""Build data/generated/*.json from the parsed Liquipedia results.

Input:  data/source/liquipedia/results.json   (scripts/liquipedia/parse_seasons.py)
        data/source/liquipedia/identities.json, index.json
        data/source/overrides.json            (Derek's corrections: display names, races)
Output: the files described in Docs/foundation-specs/stats-data.md

Everything derived (ELO, career stats, race stats) is computed here, so a correction to the
source propagates everywhere. Output is deterministic: sorted keys, total-order sorts, LF.

Usage: python scripts/export-stats/export_stats.py <source_dir> <out_dir> [--strict]
Exit:  0 ok, 1 unusable input, 2 problems under --strict
"""

from __future__ import annotations

import hashlib
import itertools
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

SCHEMA_VERSION = 3  # 3: elo.json rows carry a per-season history
RACES = ("T", "Z", "P")
ELO_START, ELO_K = 1500.0, 32
# Validation codes that mean the output may be wrong (fail under --strict).
PROBLEM_CODES = {"PARSE_PROBLEM", "PLAYER_COUNT", "FINALS_MISSING"}


class InputError(Exception):
    pass


# --------------------------------------------------------------------------- helpers

def to_placement(label: str) -> dict[str, Any]:
    """'9th-12th' -> {label: '9th–12th', best: 9, worst: 12, status: 'final'}."""
    nums = [int(x) for x in re.findall(r"\d+", label or "")]
    if not nums or len(nums) > 2:
        raise ValueError(f"not a placement: {label!r}")
    best, worst = nums[0], nums[-1]
    if worst < best:
        raise ValueError(f"placement range runs backwards: {label!r}")
    text = _ordinal(best) if best == worst else f"{_ordinal(best)}–{_ordinal(worst)}"
    return {"label": text, "best": best, "worst": worst, "status": "final"}


def _ordinal(n: int) -> str:
    if 10 <= n % 100 <= 20:
        return f"{n}th"
    return f"{n}{ {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th') }"


def name_key(name: str) -> tuple[str, str]:
    """Total order for names: case-insensitive, then exact (never hash-order dependent)."""
    return (name.lower(), name)


def ratio(wins: int, losses: int) -> float | None:
    return round(wins / (wins + losses), 4) if wins + losses else None


def compute_elo(tiers_by_season: list[dict[str, int]]) -> tuple[dict[str, float], dict[str, tuple[float, int]]]:
    rating, peak, _ = compute_elo_history(tiers_by_season)
    return rating, peak


def compute_elo_history(
    tiers_by_season: list[dict[str, int]],
) -> tuple[dict[str, float], dict[str, tuple[float, int]], dict[str, list[tuple[int, float]]]]:
    """Placement-based ELO. Start 1500, K=32.

    tiers_by_season[i] maps player -> best rank of their placement tier in season i+1.
    Each season, participants are ordered by (tier, name). Every pair in different tiers is
    one game won by the better-placed player; same-tier pairs are skipped. Ratings update
    after each pair. Peak is the best rating after any season played.
    """
    rating: dict[str, float] = defaultdict(lambda: ELO_START)
    peak: dict[str, tuple[float, int]] = {}
    history: dict[str, list[tuple[int, float]]] = defaultdict(list)
    for i, tiers in enumerate(tiers_by_season):
        part = sorted(tiers, key=lambda n: (tiers[n], *name_key(n)))
        for a, b in itertools.combinations(part, 2):
            if tiers[a] == tiers[b]:
                continue
            delta = ELO_K * (1 - 1 / (1 + 10 ** ((rating[b] - rating[a]) / 400)))
            rating[a] += delta
            rating[b] -= delta
        for n in part:
            if n not in peak or rating[n] > peak[n][0]:
                peak[n] = (rating[n], i + 1)
            history[n].append((i + 1, rating[n]))
    return dict(rating), peak, dict(history)


# --------------------------------------------------------------------------- build

def build(source_dir: Path) -> dict[str, Any]:
    lp = source_dir / "liquipedia"
    try:
        results = json.loads((lp / "results.json").read_text(encoding="utf-8"))
        identities = json.loads((lp / "identities.json").read_text(encoding="utf-8"))
        index = json.loads((lp / "index.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        raise InputError(f"cannot read Liquipedia results in {lp}: {e}") from e
    overrides_path = source_dir / "overrides.json"
    overrides = json.loads(overrides_path.read_text(encoding="utf-8")) if overrides_path.exists() else {}
    rename: dict[str, str] = overrides.get("names", {})
    race_override: dict[str, str] = overrides.get("races", {})

    warnings: list[dict[str, str]] = []

    def warn(code: str, message: str) -> None:
        warnings.append({"code": code, "message": message})

    def nm(name: str) -> str:
        return rename.get(name, name)

    for name, race in race_override.items():
        if race not in RACES:
            raise InputError(f"overrides.json: race for {name!r} must be one of {RACES}, got {race!r}")

    # ---- one race per player: override, else what Liquipedia shows most often
    seen_race: dict[str, Counter] = defaultdict(Counter)
    for s in results:
        for p in s["players"]:
            if p["race"]:
                seen_race[nm(p["player"])][p["race"]] += 1
    race_of: dict[str, str | None] = {}
    all_players = sorted({nm(p["player"]) for s in results for p in s["players"]}, key=name_key)
    for name in all_players:
        counts = seen_race[name]
        if len(counts) > 1:
            warn("RACE_VARIES", f"{name} appears with more than one race on Liquipedia: {dict(sorted(counts.items()))}")
        liquipedia = sorted(counts, key=lambda r: (-counts[r], r))[0] if counts else None
        race_of[name] = race_override.get(name, liquipedia)
        if name in race_override and liquipedia and liquipedia != race_override[name]:
            warn("RACE_OVERRIDDEN", f"{name}: overrides.json says {race_override[name]}, Liquipedia says {liquipedia}")
        if race_of[name] is None:
            warn("UNKNOWN_RACE", f"{name}: no race found on Liquipedia; add it to data/source/overrides.json")
    for name in sorted(set(race_override) - set(all_players), key=name_key):
        warn("OVERRIDE_UNUSED", f"overrides.json has a race for {name!r}, who is not in the results")

    seasons, placements, series = [], [], []
    tiers_by_season: list[dict[str, int]] = []
    for s in sorted(results, key=lambda x: x["season"]):
        n = s["season"]
        for note in s["notes"]:
            if "settled" in note:
                continue
            table = any(k in note for k in ("prize table", "page lists", "race counts"))
            warn("SOURCE_TABLE_MISMATCH" if table else "PARSE_PROBLEM", f"S{n}: {note}")
        expected = 16 if n == 1 else 28
        if len(s["players"]) != expected:
            warn("PLAYER_COUNT", f"S{n}: {len(s['players'])} players placed, expected {expected}")
        final = s["bracket"].get("r3m1")
        if not final:
            warn("FINALS_MISSING", f"S{n}: no grand final result")
        tiers: dict[str, int] = {}
        for p in s["players"]:
            name = nm(p["player"])
            pl = to_placement(p["placement"])
            tiers[name] = pl["best"]
            placements.append({"player": name, "race": race_of[name], "season": n, "placement": pl,
                               "prizeKrw": p["prizeKrw"]})
        tiers_by_season.append(tiers)
        winner, runner = (nm(final["winner"]), nm(final["loser"])) if final else (None, None)
        seasons.append({
            "season": n, "name": s["name"], "start": s["start"], "end": s["end"],
            "prizePoolKrw": s["prizePoolKrw"], "players": len(s["players"]),
            "winner": winner, "winnerRace": race_of.get(winner), "runnerUp": runner, "runnerUpRace": race_of.get(runner),
            "finalScore": final["score"] if final else None, "thirdPlaceMatch": s["thirdPlaceMatch"],
            "status": "complete" if final else "in_progress",
            "source": {"title": index[f"s{n:02d}"]["title"], "url": index[f"s{n:02d}"]["url"], "revid": index[f"s{n:02d}"]["revid"]},
        })
        for g in s["groups"]:
            for m in g["series"]:
                series.append({"season": n, "stage": g["stage"], "round": g["title"], "score": None,
                               "winner": nm(m["winner"]), "loser": nm(m["loser"])})
        rounds = {"r1": "quarterfinal", "r2": "semifinal", "r3": "final", "rx": "third_place"}
        for key in sorted(s["bracket"]):
            m = s["bracket"][key]
            series.append({"season": n, "stage": "playoffs", "round": rounds[key[:2]], "score": m["score"],
                           "winner": nm(m["winner"]), "loser": nm(m["loser"])})
    for m in series:
        m["winnerRace"], m["loserRace"] = race_of.get(m["winner"]), race_of.get(m["loser"])

    # ---- career stats and ELO
    rating, peak, history = compute_elo_history(tiers_by_season)
    champs = Counter(s["winner"] for s in seasons if s["winner"])
    by_player: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for r in placements:
        by_player[r["player"]].append(r)
    stats = []
    for name in all_players:
        rows = by_player[name]
        best = min(rows, key=lambda r: (r["placement"]["best"], r["placement"]["worst"]))["placement"]
        ranks = [r["placement"]["best"] for r in rows]
        stats.append({
            "player": name, "race": race_of[name], "seasons": len(rows), "bestFinish": best,
            "championships": ranks.count(1), "finals": sum(x <= 2 for x in ranks),
            "semifinalsOrBetter": sum(x <= 4 for x in ranks), "quarterfinalsOrBetter": sum(x <= 8 for x in ranks),
            "prizeKrw": sum(r["prizeKrw"] or 0 for r in rows), "currentElo": round(rating[name], 1),
        })
        if ranks.count(1) != champs.get(name, 0):
            warn("PARSE_PROBLEM", f"{name}: {ranks.count(1)} first places but {champs.get(name, 0)} finals won")
    stats.sort(key=lambda r: (-r["currentElo"], *name_key(r["player"])))
    elo = [{"rank": i + 1, "player": r["player"], "race": r["race"], "currentElo": r["currentElo"],
            "peakElo": round(peak[r["player"]][0], 1), "peakSeason": peak[r["player"]][1],
            "seasons": r["seasons"], "championships": r["championships"],
            "history": [{"season": n, "elo": round(v, 1)} for n, v in history[r["player"]]]} for i, r in enumerate(stats)]

    aliases: dict[str, list[str]] = defaultdict(list)
    for canonical, others in identities.items():
        aliases[nm(canonical)] += others
    for raw, shown in rename.items():
        aliases[shown].append(raw)
    players = [{"player": n, "race": race_of[n], "aliases": sorted(set(aliases.get(n, [])), key=name_key)} for n in all_players]

    data = {
        "seasons.json": seasons,
        "players.json": players,
        "placements.json": sorted(placements, key=lambda r: (r["season"], r["placement"]["best"], *name_key(r["player"]))),
        "elo.json": elo,
        "player-stats.json": stats,
        "race-stats.json": race_stats(seasons, placements, series),
        "series.json": series,
    }
    data["validation.json"] = warnings
    sha = hashlib.sha256()
    for f in sorted(lp.glob("s[0-9][0-9].wiki")):
        sha.update(f.read_bytes().replace(b"\r\n", b"\n"))
    data["manifest.json"] = {
        "schemaVersion": SCHEMA_VERSION,
        "source": {"kind": "liquipedia", "license": "CC-BY-SA 3.0", "wikitextSha256": sha.hexdigest(),
                   "pages": [{"season": s["season"], **s["source"]} for s in seasons]},
        "seasons": {"count": len(seasons), "complete": sum(s["status"] == "complete" for s in seasons)},
        "counts": {k.removesuffix(".json"): len(v) for k, v in data.items() if isinstance(v, list)},
        "elo": {"start": ELO_START, "k": ELO_K, "basis": "placement"},
        "warnings": len(warnings),
    }
    return data


def race_stats(seasons: list[dict], placements: list[dict], series: list[dict]) -> dict[str, Any]:
    total = len(seasons)
    champs = Counter(s["winnerRace"] for s in seasons)
    runners = Counter(s["runnerUpRace"] for s in seasons)
    entries = Counter(r["race"] for r in placements)
    known = sum(entries[r] for r in RACES)
    overall = [{
        "race": r, "championships": champs[r], "runnerUps": runners[r], "finalsAppearances": champs[r] + runners[r],
        "titleShare": round(champs[r] / total, 4) if total else None,
        "participantSeasons": entries[r], "participantShare": round(entries[r] / known, 4) if known else None,
    } for r in RACES]
    by_season = []
    for s in seasons:
        c = Counter(r["race"] for r in placements if r["season"] == s["season"])
        by_season.append({"season": s["season"], "T": c["T"], "Z": c["Z"], "P": c["P"], "unknown": c[None],
                          "total": sum(c.values())})

    def matchups(rows: list[dict]) -> dict[str, Any]:
        wins = Counter((m["winnerRace"], m["loserRace"]) for m in rows if m["winnerRace"] and m["loserRace"])
        cross = [{"race": a, "vs": b, "wins": wins[(a, b)], "losses": wins[(b, a)], "winRate": ratio(wins[(a, b)], wins[(b, a)])}
                 for a in RACES for b in RACES if a != b]
        return {"crossRace": cross, "mirrors": {f"{r}v{r}": wins[(r, r)] for r in RACES},
                "unknownRace": sum(1 for m in rows if not (m["winnerRace"] and m["loserRace"]))}

    return {
        "overall": overall,
        "participantsBySeason": by_season,
        "finalsBySeason": [{"season": s["season"], "champion": s["winner"], "championRace": s["winnerRace"],
                            "runnerUp": s["runnerUp"], "runnerUpRace": s["runnerUpRace"], "score": s["finalScore"]} for s in seasons],
        "seriesByMatchup": {
            "allStages": matchups(series),
            "playoffs": matchups([m for m in series if m["stage"] == "playoffs"]),
            "finals": matchups([m for m in series if m["round"] == "final"]),
        },
    }


# --------------------------------------------------------------------------- cli

def _write_json(path: Path, payload: Any) -> None:
    text = json.dumps(payload, indent=2, ensure_ascii=False, sort_keys=True) + "\n"
    path.write_text(text, encoding="utf-8", newline="\n")


def main(argv: list[str] | None = None) -> int:
    args = [a for a in (sys.argv[1:] if argv is None else argv) if not a.startswith("--")]
    strict = "--strict" in (sys.argv[1:] if argv is None else argv)
    if len(args) != 2:
        print(__doc__)
        return 1
    source_dir, out_dir = Path(args[0]), Path(args[1])
    try:
        data = build(source_dir)
    except InputError as e:
        print(f"INPUT ERROR: {e}", file=sys.stderr)
        return 1
    out_dir.mkdir(parents=True, exist_ok=True)
    for stale in out_dir.glob("*.json"):
        if stale.name not in data:
            stale.unlink()
    for name, payload in data.items():
        _write_json(out_dir / name, payload)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    counts = data["manifest.json"]["counts"]
    print(f"Exported {counts['players']} players, {counts['placements']} placements, "
          f"{counts['series']} series, {len(data['seasons.json'])} seasons -> {out_dir}")
    for w in data["validation.json"]:
        print(f"  {'PROBLEM' if w['code'] in PROBLEM_CODES else 'note'} {w['code']}: {w['message']}")
    problems = [w for w in data["validation.json"] if w["code"] in PROBLEM_CODES]
    return 2 if strict and problems else 0


if __name__ == "__main__":
    sys.exit(main())
