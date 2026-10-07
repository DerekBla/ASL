"""Compare the workbook export (data/generated/) with the Liquipedia results.

Reads data/source/liquipedia/results.json + identities.json and writes a Markdown report.
Changes nothing in the workbook or in data/generated/.

Usage: python scripts/liquipedia/audit_workbook.py <report.md>
"""

from __future__ import annotations

import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "data" / "source" / "liquipedia"
GEN = ROOT / "data" / "generated"
RACE = {"T": "Terran", "Z": "Zerg", "P": "Protoss", None: "unknown"}
# Workbook spellings that are plainly the same Liquipedia entry (punctuation / appended Korean name).
WORKBOOK_ALIASES = {"force": "force(Name)", "ivory": "ivOry 인치호"}


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def main(report_path: str) -> None:
    results = load(SRC / "results.json")
    identities = load(SRC / "identities.json")
    index = load(SRC / "index.json")
    canon = {}
    for name, aliases in identities.items():
        for a in [name, *aliases]:
            canon[a.lower()] = name
    lp_names = {p["player"] for s in results for p in s["players"]}
    for n in lp_names:
        canon.setdefault(n.lower(), n)

    def c(name: str) -> str:
        name = WORKBOOK_ALIASES.get(name.lower(), name)
        return canon.get(name.lower(), name)

    placements = load(GEN / "placements.json")
    seasons = {s["season"]: s for s in load(GEN / "seasons.json")}
    wb_by_season: dict[int, dict[str, tuple[str, str]]] = defaultdict(dict)
    wb_race: dict[str, str] = {}
    wb_rows: dict[str, set[str]] = defaultdict(set)
    for r in placements:
        name = c(r["player"])
        wb_rows[name].add(r["player"])
        wb_race[name] = r["race"]
        wb_by_season[r["season"]][name] = (r["placement"]["label"].replace("–", "-"), r["player"])

    lp_race: dict[str, Counter] = defaultdict(Counter)
    for s in results:
        for p in s["players"]:
            if p["race"]:
                lp_race[p["player"]][p["race"]] += 1

    out: list[str] = []
    totals = Counter()
    per_season = []
    detail: list[str] = []
    for s in results:
        n = s["season"]
        lp = {p["player"]: p for p in s["players"]}
        wb = wb_by_season.get(n, {})
        missing = sorted(set(lp) - set(wb), key=str.lower)
        extra = sorted(set(wb) - set(lp), key=str.lower)
        wrong = sorted((x for x in set(lp) & set(wb) if lp[x]["placement"] != wb[x][0]), key=str.lower)
        ok = len(set(lp) & set(wb)) - len(wrong)
        ws = seasons.get(n, {})
        final = s["bracket"].get("r3m1", {})
        meta = []
        if ws.get("start") != s["start"] or ws.get("end") != s["end"]:
            meta.append(f"dates {ws.get('start')} to {ws.get('end')} → **{s['start']} to {s['end']}**")
        if ws.get("prizePoolKrw") != s["prizePoolKrw"]:
            meta.append(f"prize pool ₩{ws.get('prizePoolKrw') or 0:,} → **₩{s['prizePoolKrw']:,}**")
        if ws.get("winner") and c(ws["winner"]) != final.get("winner"):
            meta.append(f"winner {ws['winner']} → **{final.get('winner')}**")
        if ws.get("runnerUp") and c(ws["runnerUp"]) != final.get("loser"):
            meta.append(f"runner-up {ws['runnerUp']} → **{final.get('loser')}**")
        totals.update(ok=ok, wrong=len(wrong), missing=len(missing), extra=len(extra), meta=len(meta), players=len(lp))
        per_season.append((n, len(lp), ok, len(wrong), len(missing), len(extra), len(meta)))

        detail.append(f"### S{n} — {s['name']}\n")
        detail.append(f"Source: [{index[f's{n:02d}']['title']}]({index[f's{n:02d}']['url']}), revision {index[f's{n:02d}']['revid']}. "
                      f"Final: **{final.get('winner')}** beat {final.get('loser')} {final.get('score')}."
                      + ("" if s["thirdPlaceMatch"] else " No third-place match, so both semifinal losers are 3rd.") + "\n")
        if not (missing or extra or wrong or meta):
            detail.append("No differences.\n")
            continue
        if meta:
            detail.append("**Season details:** " + "; ".join(meta) + "\n")
        if wrong or missing or extra:
            detail.append("| Player | Workbook | Liquipedia |\n|---|---|---|")
            for x in wrong:
                detail.append(f"| {x} | {wb[x][0].replace('-', '–')} | **{lp[x]['placement'].replace('-', '–')}** |")
            for x in missing:
                detail.append(f"| {x} | not listed | **{lp[x]['placement'].replace('-', '–')}** ({RACE[lp[x]['race']]}) |")
            for x in extra:
                detail.append(f"| {x} | {wb[x][0].replace('-', '–')} | **did not play** |")
            detail.append("")
        for note in s["notes"]:
            if "prize table" in note or "UNRESOLVED" in note or "race counts" in note:
                detail.append(f"- Liquipedia inconsistency: {note}")
        if s["notes"]:
            detail.append("")

    # ---- races, identities, unknown players
    race_rows = []
    for name in sorted(set(wb_race) & set(lp_race), key=str.lower):
        lr = lp_race[name].most_common(1)[0][0]
        if wb_race[name] != lr:
            race_rows.append(f"| {name} | {RACE[wb_race[name]]} | **{RACE[lr]}** | {sum(lp_race[name].values())} |")
    split_rows = [f"| {name} | {', '.join(sorted(rows))} |" for name, rows in sorted(wb_rows.items(), key=lambda kv: kv[0].lower()) if len(rows) > 1]
    rename_rows = [f"| {next(iter(rows))} | **{name}** |" for name, rows in sorted(wb_rows.items(), key=lambda kv: kv[0].lower())
                   if len(rows) == 1 and next(iter(rows)) != name and name in lp_names]
    unknown = sorted((n for n in wb_rows if n not in lp_names), key=str.lower)
    never = sorted((n for n in lp_names if n not in wb_rows), key=str.lower)
    no_race = sorted({p["player"] for s in results for p in s["players"] if not p["race"]}, key=str.lower)

    entries = totals["players"]
    out.append("# Liquipedia Audit of the ASL Workbook — 2026-10-07\n")
    out.append("Generated by `scripts/liquipedia/audit_workbook.py`. Compares `data/generated/` (the workbook export) "
               "with results parsed from Liquipedia's 21 season pages (`data/source/liquipedia/`). "
               "Nothing in the workbook was changed.\n")
    out.append("## Summary\n")
    out.append(f"- Liquipedia has **{entries}** player-season entries across 21 seasons. The workbook matches "
               f"**{totals['ok']}** of them ({totals['ok'] * 100 // entries}%).")
    out.append(f"- **{totals['wrong']}** have the wrong placement, **{totals['missing']}** are missing from the workbook, "
               f"and the workbook lists **{totals['extra']}** entries for players who did not play that season.")
    out.append(f"- **{len(race_rows)}** players have the wrong race. **{totals['meta']}** season details "
               "(dates, prize pool, finalists) differ.")
    out.append(f"- **{len(unknown)}** workbook players appear on no Liquipedia season page, and **{len(never)}** "
               "Liquipedia players are missing from the workbook entirely.\n")
    out.append("| Season | Players | Match | Wrong placement | Missing | Did not play | Season details |\n|---|---|---|---|---|---|---|")
    for n, players, ok, wrong, missing, extra, meta in per_season:
        out.append(f"| S{n} | {players} | {ok} | {wrong} | {missing} | {extra} | {meta} |")
    out.append(f"| **Total** | **{entries}** | **{totals['ok']}** | **{totals['wrong']}** | **{totals['missing']}** | **{totals['extra']}** | **{totals['meta']}** |\n")

    out.append("## How the Liquipedia results were derived\n")
    out.append("Placements come from **match results** (group series and the bracket), not from the pages' summary "
               "tables, because those tables are occasionally wrong (S5's prize table swaps Sharp and Sea; S1's group "
               "tables list tied players in the wrong order). The prize tables are used for payouts and as a cross-check. "
               "Players are matched across seasons by their Liquipedia player page, so different spellings and renames "
               "resolve to one person.\n")

    out.append("## Wrong races\n")
    out.append("| Player | Workbook | Liquipedia | Seasons seen |\n|---|---|---|---|" if race_rows else "None.")
    out += race_rows
    out.append("")
    out.append("## Identity\n")
    out.append("Names that Liquipedia treats as one person (same player page):\n")
    out.append("| Canonical | Also written as |\n|---|---|")
    out += [f"| {k} | {', '.join(v)} |" for k, v in sorted(identities.items(), key=lambda kv: kv[0].lower())]
    out.append("")
    if split_rows:
        out.append("**Split in the workbook** (one person, several rows):\n\n| Player | Workbook rows |\n|---|---|")
        out += split_rows
        out.append("")
    if rename_rows:
        out.append("**Spelled differently in the workbook:**\n\n| Workbook | Liquipedia |\n|---|---|")
        out += rename_rows
        out.append("")
    out.append(f"**In the workbook but on no Liquipedia season page ({len(unknown)}):** " + (", ".join(unknown) or "none") + "\n")
    if unknown:
        # Suggest who each one is: a Liquipedia player with the same placement in every one of
        # those seasons who is absent from the workbook in those seasons.
        out.append("| Workbook row | Seasons and placements | Likely the same person as |\n|---|---|---|")
        lp_by_season = {s["season"]: {p["player"]: p["placement"] for p in s["players"]} for s in results}
        for u in unknown:
            mine = {n: wb[u][0] for n, wb in wb_by_season.items() if u in wb}
            cands = None
            for n, label in mine.items():
                here = {p for p, pl in lp_by_season[n].items() if pl == label and p not in wb_by_season[n]}
                cands = here if cands is None else cands & here
            shown = ", ".join(f"S{n} {label.replace('-', '–')}" for n, label in sorted(mine.items()))
            out.append(f"| {u} | {shown} | {', '.join(sorted(cands)) if cands else 'no clear match'} |")
        out.append("")
    out.append(f"**On Liquipedia but not in the workbook ({len(never)}):** " + (", ".join(never) or "none") + "\n")
    if no_race:
        out.append(f"**Race not found on Liquipedia ({len(no_race)}):** " + ", ".join(no_race)
                   + ". Their pages are missing or are disambiguation pages; Derek to supply.\n")
    out.append("## Season by season\n")
    out += detail
    Path(report_path).write_text("\n".join(out).rstrip() + "\n", encoding="utf-8", newline="\n")
    sys.stdout.reconfigure(encoding="utf-8")
    print("\n".join(out[: out.index("## How the Liquipedia results were derived\n")]))
    print(f"wrong races: {len(race_rows)} | workbook-only players: {unknown} | liquipedia-only: {never}")


if __name__ == "__main__":
    main(sys.argv[1])
