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
PROBLEM_CODES = {"PARSE_PROBLEM", "PLAYER_COUNT"}


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


def games_of(series: dict) -> list[tuple[str, str]]:
    """(winner, loser) of each game in a series, in the order played.

    When the page lists no games, they are rebuilt from the score with the loser's wins spread
    between the winner's (3-1 becomes W L W W): the order is unknown, and this keeps the
    series winner taking the last game. With no score either, the series counts as one game.
    """
    w, l = series["winner"], series["loser"]
    if series.get("games"):
        return [(g["winner"], l if g["winner"] == w else w) for g in series["games"]]
    if not series.get("score"):
        return [(w, l)]
    won, lost = (int(x) for x in series["score"].split("-"))
    out: list[tuple[str, str]] = []
    for i in range(won):
        out.append((w, l))
        if i < lost and i < won - 1:
            out.append((l, w))
    out[-1:-1] = [(l, w)] * max(0, lost - (won - 1))
    return out


def compute_game_elo(
    games_by_season: list[list[tuple[str, str]]],
) -> tuple[dict[str, float], dict[str, tuple[float, int]], dict[str, list[tuple[int, float]]], dict[str, int]]:
    """Game-based ELO. Start 1500, K=32 (Derek, 2026-10-09; it replaced the placement ELO).

    games_by_season[i] lists season i+1's games as (winner, loser), in the order played. Each
    game moves the winner up and the loser down by K times how unexpected the result was.
    Returns the rating, the peak (best rating at the end of any season played, and that
    season), the rating after each season played, and the number of games played.
    """
    rating: dict[str, float] = defaultdict(lambda: ELO_START)
    peak: dict[str, tuple[float, int]] = {}
    history: dict[str, list[tuple[int, float]]] = defaultdict(list)
    played: dict[str, int] = defaultdict(int)
    for i, games in enumerate(games_by_season):
        seen: dict[str, None] = {}
        for winner, loser in games:
            delta = ELO_K * (1 - 1 / (1 + 10 ** ((rating[loser] - rating[winner]) / 400)))
            rating[winner] += delta
            rating[loser] -= delta
            for n in (winner, loser):
                played[n] += 1
                seen[n] = None
        for n in seen:
            if n not in peak or rating[n] > peak[n][0]:
                peak[n] = (rating[n], i + 1)
            history[n].append((i + 1, rating[n]))
    return dict(rating), peak, dict(history), dict(played)


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
    rounds_of = {"r1": "quarterfinal", "r2": "semifinal", "r3": "final", "rx": "third_place"}
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
            warn("IN_PROGRESS", f"S{n}: no grand final result yet; the season is exported as in progress")
        for p in s["players"]:
            name = nm(p["player"])
            pl = to_placement(p["placement"])
            if p.get("provisional"):  # still playing: the range of places still open to them
                pl["status"] = "provisional"
            placements.append({"player": name, "race": race_of[name], "season": n, "placement": pl,
                               "prizeKrw": p["prizeKrw"]})
        winner, runner = (nm(final["winner"]), nm(final["loser"])) if final else (None, None)
        seasons.append({
            "season": n, "name": s["name"], "start": s["start"], "end": s["end"],
            "prizePoolKrw": s["prizePoolKrw"], "players": len(s["players"]),
            "winner": winner, "winnerRace": race_of.get(winner), "runnerUp": runner, "runnerUpRace": race_of.get(runner),
            "finalScore": final["score"] if final else None, "thirdPlaceMatch": s["thirdPlaceMatch"],
            "status": "complete" if final else "in_progress",
            "roundVods": s.get("roundVods", []),
            "upcoming": [{"round": rounds_of[u["key"][:2]], "players": [
                {"player": nm(x), "race": race_of.get(nm(x))} for x in u["players"]]} for u in s.get("upcoming", [])],
            "source": {"title": index[f"s{n:02d}"]["title"], "url": index[f"s{n:02d}"]["url"], "revid": index[f"s{n:02d}"]["revid"]},
        })
        def played(m: dict) -> dict:
            """Maps in the order played, each with its winner, and the English cast if there is one."""
            return {"games": [{"map": g["map"], "winner": nm(g["winner"])} for g in m.get("games", [])],
                    "vod": m.get("vod")}

        for g in s["groups"]:
            for m in g["series"]:
                series.append({"season": n, "stage": g["stage"], "round": g["title"], "score": None,
                               "winner": nm(m["winner"]), "loser": nm(m["loser"]), **played(m)})
        for key in sorted(s["bracket"]):
            m = s["bracket"][key]
            series.append({"season": n, "stage": "playoffs", "round": rounds_of[key[:2]], "score": m["score"],
                           "winner": nm(m["winner"]), "loser": nm(m["loser"]), **played(m)})
    for m in series:
        m["winnerRace"], m["loserRace"] = race_of.get(m["winner"]), race_of.get(m["loser"])

    # ---- career stats and ELO: once on the ASL's own games, once with each season's qualifier
    # games played before them
    qualifiers_path = lp / "qualifier-results.json"
    qualifiers = json.loads(qualifiers_path.read_text(encoding="utf-8")) if qualifiers_path.exists() else []
    numbers = [s["season"] for s in seasons]
    main_games = [[g for m in series if m["season"] == n for g in games_of(m)] for n in numbers]
    known = set(all_players)
    lower = {n.lower(): n for n in all_players}

    def qualifier_name(raw: str) -> str:
        """Newer qualifier pages write "ID Korean name". An ASL player is matched by the exact ID."""
        base = nm(re.sub(r"\s+[\uac00-\ud7a3 ]+$", "", raw).strip() or raw)
        return base if base in known else raw

    # A name that differs from an ASL player's only by capitals is not merged without Derek's
    # say-so (CLAUDE.md): it is rated as someone else and reported.
    for raw in sorted({n for q in qualifiers for n in (q["winner"], q["loser"])}, key=name_key):
        name = qualifier_name(raw)
        if name not in known and name.lower() in lower:
            warn("QUALIFIER_NAME_VARIANT", f"qualifier pages write {name!r}; not counted as {lower[name.lower()]!r}")
    qualifier_games = [[(qualifier_name(w), qualifier_name(l)) for q in qualifiers if q["season"] == n
                        for w, l in games_of(q)] for n in numbers]
    rating, peak, history, played = compute_game_elo(main_games)
    q_rating, q_peak, q_history, q_played = compute_game_elo([q + m for q, m in zip(qualifier_games, main_games)])
    champs = Counter(s["winner"] for s in seasons if s["winner"])
    by_player: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for r in placements:
        by_player[r["player"]].append(r)
    stats = []
    for name in all_players:
        rows = by_player[name]
        best = min(rows, key=lambda r: (r["placement"]["best"], r["placement"]["worst"]))["placement"]
        ranks = [r["placement"]["best"] for r in rows]
        titles = sum(r["placement"]["best"] == r["placement"]["worst"] == 1 for r in rows)
        stats.append({
            "player": name, "race": race_of[name], "seasons": len(rows), "bestFinish": best,
            "championships": titles, "finals": sum(x <= 2 for x in ranks),
            "semifinalsOrBetter": sum(x <= 4 for x in ranks), "quarterfinalsOrBetter": sum(x <= 8 for x in ranks),
            "prizeKrw": sum(r["prizeKrw"] or 0 for r in rows), "currentElo": round(rating[name], 1),
        })
        if titles != champs.get(name, 0):
            warn("PARSE_PROBLEM", f"{name}: {titles} first places but {champs.get(name, 0)} finals won")
    stats.sort(key=lambda r: (-r["currentElo"], *name_key(r["player"])))
    # Only players who entered an ASL season are listed, in both versions: qualifier opponents
    # move the ratings but have no page on the site.
    q_order = sorted(all_players, key=lambda n: (-round(q_rating[n], 1), *name_key(n)))
    q_rank = {n: i + 1 for i, n in enumerate(q_order)}

    def points(h: list[tuple[int, float]]) -> list[dict[str, Any]]:
        return [{"season": n, "elo": round(v, 1)} for n, v in h]

    elo = [{"rank": i + 1, "player": r["player"], "race": r["race"], "currentElo": r["currentElo"],
            "peakElo": round(peak[r["player"]][0], 1), "peakSeason": peak[r["player"]][1],
            "seasons": r["seasons"], "championships": r["championships"], "games": played[r["player"]],
            "history": points(history[r["player"]]),
            "withQualifiers": {
                "rank": q_rank[r["player"]], "currentElo": round(q_rating[r["player"]], 1),
                "peakElo": round(q_peak[r["player"]][0], 1), "peakSeason": q_peak[r["player"]][1],
                "games": q_played[r["player"]], "history": points(q_history[r["player"]]),
            }} for i, r in enumerate(stats)]

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
        "elo": {"start": ELO_START, "k": ELO_K, "basis": "game",
                "games": sum(len(g) for g in main_games),
                "qualifierGames": sum(len(g) for g in qualifier_games),
                "qualifierSeasons": [n for n, g in zip(numbers, qualifier_games) if g]},
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
