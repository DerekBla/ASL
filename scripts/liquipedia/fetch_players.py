"""Resolve every player name on the season pages to a Liquipedia player page.

Writes data/source/liquipedia/players.json: for each name as written on a season page, the
player page it resolves to (after redirects), and the race and ID from that page's infobox.
Two names that resolve to the same page are the same person according to Liquipedia.

Same API terms as fetch_seasons.py: identified User-Agent, gzip, one request per 3 seconds.

Usage: python scripts/liquipedia/fetch_players.py
"""

from __future__ import annotations

import gzip
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import parse_seasons  # noqa: E402
from fetch_seasons import API, USER_AGENT  # noqa: E402

SRC = parse_seasons.SRC


def api(params: dict) -> dict:
    query = urllib.parse.urlencode({"format": "json", "formatversion": "2", **params})
    req = urllib.request.Request(f"{API}?{query}", headers={"User-Agent": USER_AGENT, "Accept-Encoding": "gzip"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        raw = resp.read()
        if resp.headers.get("Content-Encoding") == "gzip":
            raw = gzip.decompress(raw)
    return json.loads(raw)


def fetch_pages(titles: list[str]) -> tuple[dict[str, str], dict[str, dict]]:
    """Returns (requested title -> final title, final title -> {missing, text})."""
    final = {t: t for t in titles}
    pages: dict[str, dict] = {}
    cont: dict = {}
    while True:
        data = api({"action": "query", "redirects": "1", "prop": "revisions", "rvprop": "content",
                    "rvslots": "main", "titles": "|".join(titles), **cont})
        q = data.get("query", {})
        hops = {m["from"]: m["to"] for m in q.get("normalized", []) + q.get("redirects", [])}
        for t in titles:
            cur, seen = t, set()
            while cur in hops and cur not in seen:
                seen.add(cur)
                cur = hops[cur]
            final[t] = cur
        for p in q.get("pages", []):
            entry = pages.setdefault(p["title"], {"missing": bool(p.get("missing")), "text": None})
            if p.get("revisions"):
                entry["text"] = p["revisions"][0]["slots"]["main"]["content"]
        if "continue" not in data:
            return final, pages
        cont = data["continue"]
        time.sleep(3)


def infobox_field(text: str, field: str) -> str | None:
    m = re.search(r"^\s*\|\s*" + field + r"\s*=\s*([^\n|}]*)", text or "", re.M | re.I)
    return m.group(1).strip() or None if m else None


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    parse_seasons.CANON.clear()
    wanted: dict[str, str] = {}  # name as written -> page title to look up
    for path in sorted(SRC.glob("s[0-9][0-9].wiki")):
        season = parse_seasons.parse_season(int(path.stem[1:]), path.read_text(encoding="utf-8"))
        for name, link in season["rawLinks"].items():
            if link or name not in wanted:
                wanted[name] = link or name
    titles = sorted(set(wanted.values()))
    final: dict[str, str] = {}
    pages: dict[str, dict] = {}
    for i in range(0, len(titles), 40):
        if i:
            time.sleep(3)
        f, p = fetch_pages(titles[i:i + 40])
        final.update(f)
        pages.update(p)
        print(f"fetched {min(i + 40, len(titles))}/{len(titles)} player pages")
    out = {}
    for name, title in sorted(wanted.items(), key=lambda kv: (kv[0].lower(), kv[0])):
        page = final.get(title, title)
        info = pages.get(page, {"missing": True, "text": None})
        text = info["text"] or ""
        race = parse_seasons.RACES.get((infobox_field(text, "race") or "").lower())
        out[name] = {
            "page": None if info["missing"] else page,
            "id": infobox_field(text, "id"),
            "race": race,
            "isPlayerPage": bool(re.search(r"\{\{\s*Infobox player", text, re.I)),
        }
    (SRC / "players.json").write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
    bad = {n: v["page"] for n, v in out.items() if not v["isPlayerPage"]}
    print(f"{len(out)} names -> {len({v['page'] for v in out.values() if v['page']})} pages; not a player page: {bad}")


if __name__ == "__main__":
    main()
