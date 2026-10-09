"""Build data/source/youtube/videos.json: the YouTube videos the season pages can link to.

Two sources, both public pages read without an account:

1. Every YouTube video a stored Liquipedia season page links as a VOD is checked against
   YouTube's oEmbed endpoint, which answers with the title and channel when the video still
   exists. Videos that are gone are listed under "gone" and never linked.
2. The SOOP esports EN channel (the English ASL casts) is read two ways, so that seasons where
   Liquipedia only links the Korean broadcast can be matched by title (see title_slot in
   scripts/liquipedia/parse_seasons.py): its season playlists, which are complete but only
   exist for some seasons, and a search of the channel once per season and stage.

The script waits between requests. Run it by hand when a season ends; the result is committed.

Usage: python scripts/youtube/fetch_vods.py [season ...]
"""

from __future__ import annotations

import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WIKI = ROOT / "data" / "source" / "liquipedia"
OUT = ROOT / "data" / "source" / "youtube" / "videos.json"
CHANNEL = "SOOP esports EN"
CHANNEL_URL = "https://www.youtube.com/@SOOPesports_EN"
BROWSER = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
QUERIES = ("ASL Season{n} Ro.24 Group", "ASL Season{n} Ro.16 Group", "ASL S{n} Ro.8 Ro.4 Match", "ASL Season{n} Finals")
# Seasons the channel titles by another name (see TITLE_SEASONS in parse_seasons.py).
EXTRA_QUERIES = {18: ("2024 SSL AUTUMN Ro.24 Group", "2024 SSL AUTUMN Ro.16 Group", "2024 SSL AUTUMN Ro.8 Ro.4 Match",
                      "2024 SSL AUTUMN Finals")}
ID = re.compile(r"(?:youtu\.be/|youtube\.com/watch\?(?:[^\s#|}]*&)?v=)([A-Za-z0-9_-]{11})")


def get(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": BROWSER, "Accept-Language": "en-US,en",
                                               "Cookie": "CONSENT=YES+1"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", "replace")


def oembed(video: str) -> dict | None:
    """Title and channel of a video, or None when YouTube says it is gone or private."""
    target = urllib.parse.quote(f"https://www.youtube.com/watch?v={video}", safe="")
    try:
        data = json.loads(get(f"https://www.youtube.com/oembed?format=json&url={target}"))
    except urllib.error.HTTPError as error:
        if error.code in (400, 401, 403, 404):
            return None
        raise
    return {"title": data["title"], "channel": data["author_name"]}


def search(query: str) -> dict[str, str]:
    """Video id -> title for one search of the channel's own videos (first page of results)."""
    html = get(f"{CHANNEL_URL}/search?query={urllib.parse.quote(query)}")
    found = re.search(r"var ytInitialData = (\{.*?\});</script>", html, re.S)
    if not found:
        raise SystemExit(f"YouTube's page layout changed: no data block for {query!r}")
    out: dict[str, str] = {}

    def walk(node: object) -> None:
        if isinstance(node, dict):
            video = node.get("videoRenderer")
            if isinstance(video, dict) and "videoId" in video and "title" in video:
                out[video["videoId"]] = "".join(run["text"] for run in video["title"].get("runs", []))
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for value in node:
                walk(value)

    walk(json.loads(found.group(1)))
    return out


def initial_data(html: str, what: str) -> object:
    found = re.search(r"var ytInitialData = (\{.*?\});</script>", html, re.S)
    if not found:
        raise SystemExit(f"YouTube's page layout changed: no data block for {what}")
    return json.loads(found.group(1))


def lockups(node: object, kind: str, out: dict[str, str]) -> dict[str, str]:
    """Content id -> title of every playlist or video card under a page's data."""
    if isinstance(node, dict):
        card = node.get("lockupViewModel")
        if isinstance(card, dict) and str(card.get("contentType", "")).endswith(kind):
            try:
                out[card["contentId"]] = card["metadata"]["lockupMetadataViewModel"]["title"]["content"]
            except KeyError:
                pass
        for value in node.values():
            lockups(value, kind, out)
    elif isinstance(node, list):
        for value in node:
            lockups(value, kind, out)
    return out


def season_playlists() -> dict[str, str]:
    """Playlist id -> title for the channel's ASL playlists (the first page of its playlists)."""
    found = lockups(initial_data(get(f"{CHANNEL_URL}/playlists"), "the playlists page"), "PLAYLIST", {})
    return {pid: title for pid, title in found.items() if re.search(r"\bASL\b|\bSSL\b", title)}


def playlist(pid: str) -> dict[str, str]:
    """Video id -> title for one playlist (its first page, which holds a whole season)."""
    return lockups(initial_data(get(f"https://www.youtube.com/playlist?list={pid}"), f"playlist {pid}"), "VIDEO", {})


def main(argv: list[str]) -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    old = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {"videos": {}, "gone": []}
    videos: dict[str, dict] = dict(old["videos"])
    gone: set[str] = set(old["gone"])
    pages = sorted(WIKI.glob("s[0-9][0-9].wiki"))
    seasons = [int(a) for a in argv] or [int(p.stem[1:]) for p in pages]

    linked = sorted({m for p in pages if int(p.stem[1:]) in seasons for m in ID.findall(p.read_text(encoding="utf-8"))})
    todo = [v for v in linked if v not in videos and v not in gone]
    print(f"{len(linked)} videos linked from Liquipedia, {len(todo)} to check")
    for video in todo:
        info = oembed(video)
        if info:
            videos[video] = info
        else:
            gone.add(video)
        time.sleep(0.7)

    if not argv:
        for pid, title in season_playlists().items():
            time.sleep(2)
            found = playlist(pid)
            new = sum(video not in videos for video in found)
            for video, video_title in found.items():
                videos.setdefault(video, {"title": video_title, "channel": CHANNEL})
            print(f"playlist {title}: {len(found)} videos, {new} new")

    for n in seasons:
        new = 0
        for query in QUERIES + EXTRA_QUERIES.get(n, ()):
            for video, title in search(query.format(n=n)).items():
                new += video not in videos
                videos.setdefault(video, {"title": title, "channel": CHANNEL})
            time.sleep(2)
        print(f"S{n}: {new} more videos from the channel")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {"channel": CHANNEL, "channelUrl": CHANNEL_URL, "videos": dict(sorted(videos.items())),
               "gone": sorted(gone - set(videos))}
    OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
    print(f"{len(videos)} videos, {len(payload['gone'])} gone -> {OUT}")


if __name__ == "__main__":
    main(sys.argv[1:])
