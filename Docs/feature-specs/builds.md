# Feature Spec: Build orders from replays

**Status**: in-progress
**Last updated**: 2026-10-12
**Requested by**: Derek, 2026-10-12

Recent ladder replays of ASL players, stored on the site, each with a build order read from
the replay: what was built, when, and at about what supply.

## Routes

| Path | Segment type | Description |
|---|---|---|
| `/builds` | static | Every stored replay, grouped by pro, with a link to its build order and a download |
| `/builds/[id]` | static (`generateStaticParams`) | One game: both players' build orders side by side, download, link to cwal.gg |
| `/replays/<pro>/<id>.rep` | static file (`public/`) | The replay itself |

## Data flow

```
cwal.gg API → pnpm replays:fetch → public/replays/<pro>/*.rep + data/source/cwal/replays.json
    ↓
pnpm replays:export (screp-js parses each replay; lib/replay estimates the build order)
    ↓
data/generated/builds.json (committed) → lib/services/builds (Zod) → RSC pages
```

No database and no client fetching. Both scripts are run by hand; nothing is scheduled.

## Which replays

Set in `scripts/replays/fetch-cwal.ts`: the players (`PLAYERS`, by cwal.gg pro id), ten games
each (`GAMES_PER_PLAYER`), newest first across every ladder account cwal.gg lists for that
pro, whatever race was played. Games under two minutes (`MIN_DURATION_SECONDS`) are skipped
as instant leaves. A fetch replaces the stored set: replays that fall out of the newest ten
are deleted.

## The build order estimate

`src/lib/replay/buildOrder.ts` (pure; its header comment is the full account). A replay holds
commands, not outcomes, so:

- **Times and order are exact.** Frames times 42 ms, the in game clock on Fastest.
- **Whether a step happened is a judgement.** Refused clicks and the fake build commands good
  players spam are filtered by rules: last attempt per larva and per Drone (Zerg), the SCV
  must stay on the job (Terran), the building must be affordable in a simple income model
  (Terran, Protoss), and the tech tree puts back a building a later command proves.
- **Supply is an estimate** and runs high once units die. Every page that shows it says so.
- Build orders stop at ten minutes (`MAX_FRAME` in the export script).
- Shown steps: every building and research, the first of each army unit, every Overlord.

## Rules

- Credit cwal.gg and link it wherever the replays are listed.
- Supply is always labeled a rough guide. Never present it as read from the replay.
- `screp-js` is a dev dependency used only by the export script and tests. It is unmaintained
  on npm (it wraps the Go parser `screp`); if it breaks, the replacement is another build of
  screp, not a rewrite.

## Not built yet

- Uploading your own replay for a build order (the estimator is pure and can run in the
  browser; `screp-js` would then move to a runtime dependency, loaded only on that page).
- A scheduled refresh.
