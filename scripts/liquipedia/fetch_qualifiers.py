"""Download the wikitext of every ASL qualifier page from Liquipedia's MediaWiki API.

A season's qualifier pages are found two ways: the links to them on the stored season page,
and every page whose title starts with "<season page>/Qualif". Each is written to
data/source/liquipedia/qualifiers/sNN-KK.wiki, with qualifiers.json recording the title, URL
and revision of each file. Liquipedia content is CC-BY-SA 3.0.

API terms (https://liquipedia.net/api-terms-of-use): identify yourself with a User-Agent,
accept gzip, and make at most one request every 2 seconds. This script waits 3.

Usage: python scripts/liquipedia/fetch_qualifiers.py [season ...]
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

from fetch_seasons import API, TITLES, USER_AGENT

SRC = Path(__file__).resolve().parents[2] / "data" / "source" / "liquipedia"
OUT = SRC / "qualifiers"
LINK = re.compile(r"\[\[([^\]|#]*(?:[Qq]ualif|[Pp]relim|[Ww]ild ?[Cc]ard)[^\]|#]*)")
PARAM = re.compile(r"\|(?:link\d*|tournament\d*)=([^\n|}]*(?:[Qq]ualif|[Pp]relim)[^\n|}]*)")


def api(params: dict[str, str]) -> dict:
    query = urllib.parse.urlencode({"format": "json", "formatversion": "2", **params})
    req = urllib.request.Request(f"{API}?{query}", headers={"User-Agent": USER_AGENT, "Accept-Encoding": "gzip"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        raw = resp.read()
        if resp.headers.get("Content-Encoding") == "gzip":
            raw = gzip.decompress(raw)
    time.sleep(3)
    return json.loads(raw)


def linked(season: int) -> set[str]:
    text = (SRC / f"s{season:02d}.wiki").read_text(encoding="utf-8")
    found = LINK.findall(text) + PARAM.findall(text)
    return {t.replace("_", " ").strip() for t in found if t.strip()}


def under(title: str) -> set[str]:
    """Titles of every page below a season page whose name starts with Qualif."""
    data = api({"action": "query", "list": "allpages", "apprefix": f"{title}/Qualif", "aplimit": "100"})
    return {p["title"] for p in data["query"]["allpages"]}


def fetch(title: str) -> dict | None:
    data = api({"action": "query", "redirects": "1", "prop": "revisions", "rvprop": "content|timestamp|ids",
                "rvslots": "main", "titles": title})
    page = data["query"]["pages"][0]
    if page.get("missing") or "revisions" not in page:
        return None
    rev = page["revisions"][0]
    return {"title": page["title"], "revid": rev["revid"], "timestamp": rev["timestamp"],
            "text": rev["slots"]["main"]["content"]}


def main(argv: list[str]) -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    seasons = [int(a) for a in argv] or sorted(TITLES)
    OUT.mkdir(parents=True, exist_ok=True)
    index_path = SRC / "qualifiers.json"
    index = json.loads(index_path.read_text(encoding="utf-8")) if index_path.exists() else {}
    for n in seasons:
        for old in OUT.glob(f"s{n:02d}-*.wiki"):
            old.unlink()
        index = {k: v for k, v in index.items() if v["season"] != n}
        wanted = sorted(linked(n) | under(TITLES[n]))
        pages: dict[str, dict] = {}  # by resolved title, so two links to one page are fetched once
        for title in wanted:
            page = fetch(title)
            if page and "{{Match" in page["text"]:
                pages[page["title"]] = page
        for k, (title, page) in enumerate(sorted(pages.items()), start=1):
            key = f"s{n:02d}-{k:02d}"
            (OUT / f"{key}.wiki").write_text(page["text"], encoding="utf-8", newline="\n")
            index[key] = {
                "season": n, "title": title, "revid": page["revid"], "timestamp": page["timestamp"],
                "url": "https://liquipedia.net/starcraft/" + urllib.parse.quote(title.replace(" ", "_")),
                "license": "CC-BY-SA 3.0",
            }
        print(f"S{n}: {len(pages)} qualifier pages with matches, of {len(wanted)} titles looked at")
    index_path.write_text(json.dumps(dict(sorted(index.items())), indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")


if __name__ == "__main__":
    main(sys.argv[1:])
