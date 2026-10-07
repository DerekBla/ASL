# Liquipedia source data

Wikitext of the 21 ASL season pages from [Liquipedia StarCraft](https://liquipedia.net/starcraft/),
plus data derived from it. Text from Liquipedia is licensed
[CC-BY-SA 3.0](https://liquipedia.net/commons/Liquipedia:Copyrights); `index.json` records the
page title, URL, and revision each file came from.

| File | What it is | Produced by |
|---|---|---|
| `sNN.wiki` | Raw wikitext of season NN's page | `scripts/liquipedia/fetch_seasons.py` |
| `index.json` | Page title, URL, revision id, timestamp per season | `fetch_seasons.py` |
| `players.json` | Each name as written → Liquipedia player page, handle, race | `scripts/liquipedia/fetch_players.py` |
| `identities.json` | Canonical name → other spellings of the same person | `scripts/liquipedia/parse_seasons.py` |
| `results.json` | Per season: dates, prize pool, payouts, every player's race and placement, group standings, bracket | `parse_seasons.py` |

Do not hand-edit. To refresh: run `fetch_seasons.py`, `parse_seasons.py`, `fetch_players.py`,
then `parse_seasons.py` again (the second pass uses `players.json` for identities and races).

Placements in `results.json` are derived from match results, not from the pages' summary
tables. See the docstring in `parse_seasons.py` for why, and `notes` in each season for the
places where Liquipedia's own tables disagree with its match results.

The fetch scripts follow Liquipedia's API terms: an identifying User-Agent, gzip, and at most
one request every 3 seconds.
