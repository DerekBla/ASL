# Tooling Spec: Scheduled Replays Refresh

**File**: `scripts/refresh/refresh_replays.py` · **Command**: `pnpm replays:refresh` · **Status**: built
(Derek, 2026-10-12: keep the stored replays fresh)

Keeps `/builds` showing each pro's newest ladder games without anyone running the scripts by
hand. It is separate from the season refresh (`stats-refresh.md`) because that one stops for
good once a season is complete, and the ladder never stops.

## What one run does

1. Refuses to run unless the repo is on `main` with no uncommitted changes to tracked files.
2. Runs `pnpm replays:fetch`. It asks cwal.gg for each pro's match list and downloads only
   replays not already stored. Same ten games as before: stops.
3. Runs `pnpm replays:export` to read the build orders.
4. Runs the typecheck and Vitest. Any failure: restores the files, stops.
5. Commits `data/source/cwal/`, `data/generated/builds.json` and `public/replays/` to `main`
   ("Refresh ladder replays from cwal.gg") and deploys, trying twice.

It shares the log (`.logs/stats-refresh.log`), the deploy step and the `deploy-pending` marker
with the season refresh, so either one finishes a deploy the other could not.

## The schedule

A Windows scheduled task, "StarCoins replays refresh", runs it every Monday at 09:15 while Derek
is logged in on his PC. Weekly, not daily, on purpose: every refresh commits up to 2 MB of
replay files, and git keeps every one of them. Daily would add several hundred MB a year.

| Command | What it does |
|---|---|
| `python scripts/refresh/refresh_replays.py --schedule [day]` | Create or replace the task (`MON` by default) |
| `python scripts/refresh/refresh_replays.py --unschedule` | Remove the task |
| `pnpm replays:refresh` | Run once now |
| `pnpm replays:refresh --no-deploy` | Commit, but leave the deploy to a person |

## What it does not do

- Add or remove players, or change how many games are kept: edit `PLAYERS` and
  `GAMES_PER_PLAYER` in `scripts/replays/fetch-cwal.ts`.
- Judge the build orders. A game with a doubtful build order is published like any other.

## Rules for tests

The same as the season refresh: tests run before publishing, so none may quote the stored
games. The replay tests use the two fixtures in `src/lib/replay/__tests__/fixtures/`.
