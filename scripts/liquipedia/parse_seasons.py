"""Parse the Liquipedia season pages in data/source/liquipedia/ into results.json.

Placements are derived from MATCH RESULTS (group series and the bracket), because the pages'
own summary tables are sometimes wrong (S5 prize table swaps Sharp/Sea; S1 group tables list
tied players in the wrong order). The listed standings and prize tables are parsed too, but
only as a cross-check: every disagreement is recorded under "notes".

Placement tiers (workbook convention):
  bracket  1st, 2nd, semifinal losers 3rd / 4th by the third-place match (both "3rd" when
           there was no such match), quarterfinal losers 5th-8th
  Ro16     3rd in group 9th-12th, 4th in group 13th-16th
  Ro24     3rd in group 17th-22nd, 4th in group 23rd-28th

Usage: python scripts/liquipedia/parse_seasons.py
"""

from __future__ import annotations

import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

SRC = Path(__file__).resolve().parents[2] / "data" / "source" / "liquipedia"
PIPE = "\x00"  # stands in for {{!}} (a literal pipe inside a template argument)

# Identity decisions confirmed by Derek (CLAUDE.md Domain Rules), keyed by lowercase name.
CONFIRMED = {"snow": "SnOw", "hero": "herO", "best": "Best", "effort": "EffOrt", "hyun": "HyuN",
             "huro": "tulbo", "yoon soo-chul": "tulbo", "jd": "Jaedong"}
CANON: dict[str, str] = {}      # lowercase name as written -> canonical name (filled by main)
PAGE_RACE: dict[str, str] = {}  # canonical name -> race from the Liquipedia player page


def canon(name: str) -> str:
    return CANON.get(name.lower(), name)


# --------------------------------------------------------------------------- wikitext

def find_templates(text: str, name: str) -> list[tuple[int, int, str]]:
    """All {{name ...}} templates (case-insensitive), as (start, end, inner text)."""
    out = []
    for m in re.finditer(r"\{\{\s*" + re.escape(name) + r"\s*(?=[|}\n])", text, re.I):
        depth, i = 0, m.start()
        while i < len(text) - 1:
            two = text[i:i + 2]
            if two == "{{":
                depth += 1
                i += 2
            elif two == "}}":
                depth -= 1
                i += 2
                if depth == 0:
                    out.append((m.start(), i, text[m.end():i - 2]))
                    break
            else:
                i += 1
    return out


def split_params(inner: str) -> tuple[list[str], dict[str, str]]:
    """Split a template body on top-level pipes into positional and named parameters."""
    parts, depth, cur, i = [], 0, [], 0
    while i < len(inner):
        two = inner[i:i + 2]
        if two in ("{{", "[["):
            depth += 1
            cur.append(two)
            i += 2
        elif two in ("}}", "]]"):
            depth -= 1
            cur.append(two)
            i += 2
        elif inner[i] == "|" and depth == 0:
            parts.append("".join(cur))
            cur = []
            i += 1
        else:
            cur.append(inner[i])
            i += 1
    parts.append("".join(cur))
    positional, named = [], {}
    for p in parts[1:] if parts and not parts[0].strip() else parts:
        m = re.match(r"\s*([A-Za-z0-9_ ]+?)\s*=(.*)", p, re.S)
        if m and "{{" not in m.group(1):
            named[m.group(1).strip().lower()] = m.group(2).strip()
        elif p.strip():
            positional.append(p.strip())
    return positional, named


def clean(text: str) -> str:
    text = re.sub(r"<!--.*?-->", "", text, flags=re.S)
    return text.replace("{{!}}", PIPE)


def display(name: str) -> tuple[str, str | None]:
    """'Page¦Shown' -> ('Shown', 'Page'); underscores in page names become spaces."""
    name = name.strip()
    if PIPE in name:
        page, shown = name.split(PIPE, 1)
        RAW_LINKS.setdefault(shown.strip(), page.strip().replace("_", " "))
        return canon(shown.strip()), page.strip().replace("_", " ")
    RAW_LINKS.setdefault(name, None)
    return canon(name), None


RAW_LINKS: dict[str, str | None] = {}  # name as written -> link target, per season (reset in parse_season)


RACES = {"t": "T", "z": "Z", "p": "P", "terran": "T", "zerg": "Z", "protoss": "P"}


def opponent(raw: str) -> dict | None:
    for tname in ("SoloOpponent", "1Opponent"):
        found = find_templates(raw, tname)
        if found:
            pos, named = split_params(found[0][2])
            name = named.get("name") or named.get("p1") or (pos[0] if pos else "")
            if not name or name.upper() in ("TBD", "BYE"):
                return None
            shown, page = display(name)
            link = named.get("link") or named.get("p1link") or page
            if link:
                raw = name.split(PIPE, 1)[-1].strip()
                RAW_LINKS[raw] = link.replace("_", " ").strip()
            return {
                "name": shown,
                "link": link.replace("_", " ").strip() if link else None,
                "race": RACES.get((named.get("race") or named.get("p1race") or "").strip().lower()),
                "score": named.get("score"),
                "win": named.get("win"),
            }
    return None


def parse_match(inner: str) -> dict | None:
    _, named = split_params(inner)
    a, b = opponent(named.get("opponent1", "")), opponent(named.get("opponent2", ""))
    if not a or not b:
        return None
    maps = [0, 0]
    for key, val in named.items():
        if re.fullmatch(r"map\d+", key):
            for _, _, body in find_templates(val, "Map"):
                w = split_params(body)[1].get("winner", "").strip()
                if w in ("1", "2"):
                    maps[int(w) - 1] += 1
    winner, how = None, None
    if named.get("winner", "").strip() in ("1", "2"):
        winner, how = int(named["winner"]), "winner="
    if maps[0] != maps[1]:
        by_maps = 1 if maps[0] > maps[1] else 2
        if winner is None:
            winner, how = by_maps, "maps"
    scores = []
    for o in (a, b):
        try:
            scores.append(int(o["score"]))
        except (TypeError, ValueError):
            scores.append(None)
    if winner is None and None not in scores and scores[0] != scores[1]:
        winner, how = (1 if scores[0] > scores[1] else 2), "score="
    if winner is None:
        for i, o in enumerate((a, b), start=1):
            if (o["score"] or "").upper() in ("W", "FF", "L", "DQ"):
                winner, how = (i if o["score"].upper() == "W" else 3 - i), "walkover"
    score = scores if None not in scores else (maps if sum(maps) else None)
    return {"a": a, "b": b, "winner": winner, "how": how, "score": score}


# --------------------------------------------------------------------------- season

def group_standing(players: list[str], series: list[tuple[str, str]], tiebreak: list[str] | None):
    """Rank a group from its series results (winner, loser). Returns (order, tie_notes)."""
    wins, losses = Counter(), Counter()
    for w, l in series:
        wins[w] += 1
        losses[l] += 1
    beat = set(series)
    notes: list[str] = []

    def rank(pool: list[str]) -> list[str]:
        by_record: dict[tuple[int, int], list[str]] = defaultdict(list)
        for p in pool:
            by_record[(-wins[p], losses[p])].append(p)
        ordered: list[str] = []
        for record in sorted(by_record):
            tied = by_record[record]
            if len(tied) > 1:
                h2h = Counter({p: sum((p, q) in beat for q in tied if q != p) for p in tied})
                tied = sorted(tied, key=lambda p: -h2h[p])
                if len({h2h[p] for p in tied}) < len(tied):  # still tied: playoff order, if any
                    if tiebreak and all(p in tiebreak for p in tied):
                        tied = sorted(tied, key=tiebreak.index)
                        notes.append(f"tie {sorted(tied)} settled by the tiebreaker group")
                    else:
                        notes.append(f"UNRESOLVED tie between {sorted(tied)}")
                else:
                    notes.append(f"tie {sorted(tied)} settled head-to-head")
            ordered += tied
        return ordered

    return rank(players), notes


def parse_season(n: int, text: str) -> dict:
    text = clean(text)
    RAW_LINKS.clear()
    notes: list[str] = []
    # Participant tables carry link hints such as |p2=JD|p2link=Jaedong
    for _, _, body in find_templates(text, "ParticipantSection") + find_templates(text, "ParticipantTable"):
        _, pnamed = split_params(body)
        for key, val in pnamed.items():
            if re.fullmatch(r"p\d+", key) and pnamed.get(key + "link"):
                RAW_LINKS[val.strip()] = pnamed[key + "link"].replace("_", " ").strip()
    for _, _, body in find_templates(text, "InlinePlayer"):
        _, inamed = split_params(body)
        if inamed.get("1") and inamed.get("link"):
            RAW_LINKS.setdefault(inamed["1"].strip(), inamed["link"].replace("_", " ").strip())
    info = split_params(find_templates(text, "Infobox league")[0][2])[1]
    headings = [(m.start(), len(m.group(1)), m.group(2).strip()) for m in re.finditer(r"^(={2,5})\s*(.*?)\s*=+\s*$", text, re.M)]

    def heading_before(pos: int, level: int) -> str:
        return next((t for p, lv, t in reversed(headings) if p < pos and lv <= level), "")

    # ---- groups
    tables = find_templates(text, "GroupTableLeague")
    matchlists = find_templates(text, "Matchlist")
    races: dict[str, Counter] = defaultdict(Counter)
    links: dict[str, str] = {}

    def see(o: dict) -> str:
        if o["race"]:
            races[o["name"]][o["race"]] += 1
        if o["link"]:
            links.setdefault(o["name"], o["link"])
        return o["name"]

    groups = []
    for idx, (start, end, body) in enumerate(tables):
        nxt = tables[idx + 1][0] if idx + 1 < len(tables) else len(text)
        ml = next((m for m in matchlists if end <= m[0] < nxt), None)
        _, named = split_params(body)
        title = named.get("title", "")
        stage_h = heading_before(start, 3)
        stage = "ro24" if "24" in stage_h else "ro16"
        listed = []
        for _, _, ob in find_templates(body, "soloOpponent"):
            _, on = split_params(ob)
            if on.get("p1"):
                shown, page = display(on["p1"])
                if on.get("p1link"):
                    RAW_LINKS[on["p1"].split(PIPE, 1)[-1].strip()] = on["p1link"].replace("_", " ").strip()
                listed.append(see({"name": shown, "link": (on.get("p1link") or page or "").replace("_", " ") or None,
                                   "race": RACES.get(on.get("p1race", "").strip().lower())}))
        series, players = [], []
        if ml:
            _, mnamed = split_params(ml[2])
            for key in sorted((k for k in mnamed if re.fullmatch(r"m\d+", k)), key=lambda k: int(k[1:])):
                found = find_templates(mnamed[key], "Match")
                m = parse_match(found[0][2]) if found else None
                if not m:
                    notes.append(f"{stage} {title}: could not read match {key.upper()}")
                    continue
                a, b = see(m["a"]), see(m["b"])
                for p in (a, b):
                    if p not in players:
                        players.append(p)
                if m["winner"] is None:
                    notes.append(f"{stage} {title}: no winner recorded for {a} vs {b}")
                    continue
                series.append((a, b) if m["winner"] == 1 else (b, a))
        groups.append({"stage": stage, "title": title, "listed": listed, "players": players, "series": series,
                       "tiebreaker": "tiebreak" in title.lower()})

    placements: dict[str, str] = {}
    tiers = {"ro24": ("17th-22nd", "23rd-28th"), "ro16": ("9th-12th", "13th-16th")}
    out_groups = []
    for g in (g for g in groups if not g["tiebreaker"]):
        tb = next((t for t in groups if t["tiebreaker"] and t["title"].lower().startswith(g["title"].lower())), None)
        tb_order = None
        if tb:
            tb_order, tb_notes = group_standing(tb["players"], tb["series"], tb["listed"] or None)
        order, tie_notes = group_standing(g["players"], g["series"], tb_order)
        for t in tie_notes:
            notes.append(f"{g['stage']} {g['title']}: {t}")
        if len(order) != 4:
            notes.append(f"{g['stage']} {g['title']}: expected 4 players, found {len(order)} {order}")
        if g["listed"] and g["listed"] != order and not any("UNRESOLVED" in t for t in tie_notes):
            notes.append(f"{g['stage']} {g['title']}: page lists {g['listed']} but match results give {order}")
        if len(order) == 4:
            placements[order[2]], placements[order[3]] = tiers[g["stage"]]
        out_groups.append({"stage": g["stage"], "title": g["title"], "standing": order,
                           "series": [{"winner": w, "loser": l} for w, l in g["series"]]})

    # ---- bracket
    bracket = find_templates(text, "Bracket")
    _, bnamed = split_params(bracket[0][2]) if bracket else ([], {})
    rounds: dict[str, dict] = {}
    for key in ("r1m1", "r1m2", "r1m3", "r1m4", "r2m1", "r2m2", "r3m1", "rxmtp"):
        found = find_templates(bnamed.get(key, ""), "Match")
        m = parse_match(found[0][2]) if found else None
        if m and m["winner"]:
            a, b = see(m["a"]), see(m["b"])
            w, l = (a, b) if m["winner"] == 1 else (b, a)
            s = sorted(m["score"], reverse=True) if m["score"] else None
            rounds[key] = {"winner": w, "loser": l, "score": f"{s[0]}-{s[1]}" if s else None}
        elif key != "rxmtp":
            notes.append(f"bracket: could not read {key.upper()}")
    for key in ("r1m1", "r1m2", "r1m3", "r1m4"):
        if key in rounds:
            placements[rounds[key]["loser"]] = "5th-8th"
    if "rxmtp" in rounds:
        placements[rounds["rxmtp"]["winner"]], placements[rounds["rxmtp"]["loser"]] = "3rd", "4th"
    else:
        for key in ("r2m1", "r2m2"):
            if key in rounds:
                placements[rounds[key]["loser"]] = "3rd"
    if "r3m1" in rounds:
        placements[rounds["r3m1"]["winner"]], placements[rounds["r3m1"]["loser"]] = "1st", "2nd"

    # ---- prize table (cross-check, and the only source for payouts)
    prize_by_place: dict[str, int] = {}
    listed_place: dict[str, str] = {}
    for _, _, body in find_templates(text, "Prize pool slot"):
        pos, named = split_params(body)
        place = named.get("place", "").strip()
        if named.get("localprize"):
            prize_by_place[place] = int(re.sub(r"[^\d]", "", named["localprize"]) or 0)
        for i, raw in enumerate(pos, start=1):
            shown, page = display(raw)
            listed_place[shown] = place
            if RACES.get(named.get(f"race{i}", "").strip().lower()):
                races[shown][RACES[named[f"race{i}"].strip().lower()]] += 1
            if page:
                links.setdefault(shown, page)
    auto_place = 1
    for _, _, body in find_templates(text, "Slot"):
        _, named = split_params(body)
        place = named.get("place", "").strip() or str(auto_place)
        auto_place += 1
        if named.get("localprize"):
            prize_by_place[place] = int(re.sub(r"[^\d]", "", named["localprize"]) or 0)

    def prize_for(label: str) -> int | None:
        lo = int(re.match(r"\d+", label).group())
        for place, amount in prize_by_place.items():
            nums = [int(x) for x in re.findall(r"\d+", place)]
            if nums and nums[0] <= lo <= nums[-1]:
                return amount
        return None

    def as_range(label: str) -> tuple[int, int]:
        nums = [int(x) for x in re.findall(r"\d+", label)]
        return nums[0], nums[-1]

    for name, place in listed_place.items():
        if name in placements and place:
            lo, hi = as_range(placements[name])
            plo, phi = as_range(place)
            if not (plo <= lo and hi <= phi):
                notes.append(f"prize table puts {name} at {place}, match results give {placements[name]}")
        elif name not in placements:
            notes.append(f"prize table lists {name} ({place}) but no match result places them")

    expected = int(re.sub(r"[^\d]", "", info.get("player_number", "")) or 0)
    if expected and len(placements) != expected:
        notes.append(f"placed {len(placements)} players, infobox says {expected}")
    race_counts = Counter()
    players = []
    for name in sorted(placements, key=lambda p: (as_range(placements[p]), p.lower(), p)):
        race = races[name].most_common(1)[0][0] if races[name] else None
        race_source = "season page" if race else None
        if not race and PAGE_RACE.get(name):
            race, race_source = PAGE_RACE[name], "player page"
        if len(races[name]) > 1:
            notes.append(f"{name} appears with more than one race: {dict(races[name])}")
        race_counts[race] += 1
        players.append({"player": name, "link": links.get(name), "race": race, "raceSource": race_source,
                        "placement": placements[name], "prizeKrw": prize_for(placements[name])})
    info_counts = {r: int(re.sub(r"[^\d]", "", info.get(f"{k}_number", "")) or 0)
                   for r, k in (("T", "terran"), ("Z", "zerg"), ("P", "protoss"))}
    if None not in race_counts and any(info_counts.values()) and dict(race_counts) != {k: v for k, v in info_counts.items() if v}:
        notes.append(f"race counts {dict(race_counts)} differ from infobox {info_counts}")

    return {
        "season": n,
        "name": info.get("name"),
        "start": info.get("sdate"),
        "end": info.get("edate"),
        "prizePoolKrw": int(re.sub(r"[^\d]", "", info.get("prizepool", "")) or 0) or None,
        "thirdPlaceMatch": "rxmtp" in rounds,
        "players": players,
        "bracket": rounds,
        "groups": out_groups,
        "prizeByPlace": prize_by_place,
        "notes": notes,
        "rawLinks": dict(RAW_LINKS),
    }


def main() -> None:
    texts = {int(p.stem[1:]): p.read_text(encoding="utf-8") for p in sorted(SRC.glob("s[0-9][0-9].wiki"))}
    players_path = SRC / "players.json"
    pages = json.loads(players_path.read_text(encoding="utf-8")) if players_path.exists() else {}

    # Pass 1 (names as written): decide one canonical spelling per person. Two names are the
    # same person when they differ only by case or resolve to the same Liquipedia player page.
    CANON.clear()
    last_seen: dict[str, tuple[int, str]] = {}
    for n, text in texts.items():
        for raw in parse_season(n, text)["rawLinks"]:
            last_seen[raw] = (n, raw)
    key_of = {}
    for raw in last_seen:
        page = (pages.get(raw) or {}).get("page")
        key_of[raw] = ("page", page.lower()) if page and pages[raw].get("isPlayerPage") else ("name", raw.lower())
    by_lower: dict[str, tuple] = {}
    for raw, key in key_of.items():  # a case variant with no page of its own joins its sibling's page
        if key[0] == "page":
            by_lower[raw.lower()] = key
    groups: dict[tuple, list[str]] = defaultdict(list)
    for raw, key in key_of.items():
        groups[by_lower.get(raw.lower(), key)].append(raw)
    identities = {}
    for key, names in groups.items():
        confirmed = next((CONFIRMED[x.lower()] for x in names if x.lower() in CONFIRMED), None)
        page_id = next((pages[x]["id"] for x in names if (pages.get(x) or {}).get("isPlayerPage") and pages[x].get("id")), None)
        if page_id and page_id.lower() not in {x.lower() for x in names}:
            page_id = None  # only trust the page's handle when a season page actually uses it
        chosen = confirmed or page_id or max(names, key=lambda x: last_seen[x])
        for raw in names:
            CANON[raw.lower()] = chosen
        if len(names) > 1:
            identities[chosen] = sorted(set(names) - {chosen})
        race = next((pages[x]["race"] for x in names if (pages.get(x) or {}).get("race")), None)
        if race:
            PAGE_RACE[chosen] = race

    seasons = [parse_season(n, text) for n, text in texts.items()]
    # A player with no race on a season page (S12+) takes the race from their other seasons.
    known: dict[str, Counter] = defaultdict(Counter)
    for s in seasons:
        for p in s["players"]:
            if p["raceSource"] == "season page":
                known[p["player"]][p["race"]] += 1
    for s in seasons:
        for p in s["players"]:
            if p["raceSource"] != "season page" and known[p["player"]]:
                p["race"], p["raceSource"] = known[p["player"]].most_common(1)[0][0], "other seasons"
        s.pop("rawLinks")
    (SRC / "identities.json").write_text(json.dumps(dict(sorted(identities.items(), key=lambda kv: kv[0].lower())), indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
    (SRC / "results.json").write_text(json.dumps(seasons, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
    sys.stdout.reconfigure(encoding="utf-8")
    for s in seasons:
        norace = [p["player"] for p in s["players"] if not p["race"]]
        print(f"S{s['season']:<2} {s['start']} to {s['end']}  players={len(s['players'])}  "
              f"pool={s['prizePoolKrw']}  no race={len(norace)}  notes={len(s['notes'])}")
        for note in s["notes"]:
            print("     -", note)


if __name__ == "__main__":
    main()
