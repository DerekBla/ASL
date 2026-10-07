"""Download the wikitext of every ASL season page from Liquipedia's MediaWiki API.

Writes data/source/liquipedia/sNN.wiki plus index.json (title, revision id, timestamp).
Liquipedia content is CC-BY-SA 3.0; index.json records where each file came from.

API terms (https://liquipedia.net/api-terms-of-use): identify yourself with a User-Agent,
accept gzip, and make at most one request every 2 seconds. This script waits 3.

Usage: python scripts/liquipedia/fetch_seasons.py [season ...]
"""

from __future__ import annotations

import gzip
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

API = "https://liquipedia.net/starcraft/api.php"
USER_AGENT = "StarCoinsFanSite/0.1 (https://github.com/DerekBla/ASL; fan stats project)"
OUT = Path(__file__).resolve().parents[2] / "data" / "source" / "liquipedia"

TITLES = {
    **{n: f"AfreecaTV/StarCraft League Brood War/{n}" for n in (1, 2, 3)},
    **{n: f"AfreecaTV/StarCraft League Remastered/{n}" for n in range(4, 18)},
    18: "SOOP/StarCraft League/2024/AUTUMN",
    19: "ASL/19",
    20: "ASL/20",
    21: "ASL/21",
}


def fetch(title: str) -> dict:
    query = urllib.parse.urlencode({
        "action": "query", "format": "json", "formatversion": "2", "redirects": "1",
        "prop": "revisions", "rvprop": "content|timestamp|ids", "rvslots": "main", "titles": title,
    })
    req = urllib.request.Request(f"{API}?{query}", headers={"User-Agent": USER_AGENT, "Accept-Encoding": "gzip"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        raw = resp.read()
        if resp.headers.get("Content-Encoding") == "gzip":
            raw = gzip.decompress(raw)
    page = json.loads(raw)["query"]["pages"][0]
    if page.get("missing"):
        raise SystemExit(f"page not found: {title}")
    rev = page["revisions"][0]
    return {"title": page["title"], "revid": rev["revid"], "timestamp": rev["timestamp"],
            "text": rev["slots"]["main"]["content"]}


def main(argv: list[str]) -> None:
    seasons = [int(a) for a in argv] or sorted(TITLES)
    OUT.mkdir(parents=True, exist_ok=True)
    index_path = OUT / "index.json"
    index = json.loads(index_path.read_text(encoding="utf-8")) if index_path.exists() else {}
    for i, n in enumerate(seasons):
        if i:
            time.sleep(3)
        page = fetch(TITLES[n])
        (OUT / f"s{n:02d}.wiki").write_text(page["text"], encoding="utf-8", newline="\n")
        index[f"s{n:02d}"] = {
            "season": n, "title": page["title"], "revid": page["revid"], "timestamp": page["timestamp"],
            "url": "https://liquipedia.net/starcraft/" + urllib.parse.quote(page["title"].replace(" ", "_")),
            "license": "CC-BY-SA 3.0",
        }
        print(f"S{n}: {page['title']} rev {page['revid']} ({len(page['text']):,} chars)")
    index_path.write_text(json.dumps(dict(sorted(index.items())), indent=2) + "\n", encoding="utf-8", newline="\n")


if __name__ == "__main__":
    main(sys.argv[1:])
