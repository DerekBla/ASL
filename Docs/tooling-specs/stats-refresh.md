# Tooling Spec: Scheduled Stats Refresh

**File**: `scripts/refresh/refresh_season.py` · **Command**: `pnpm stats:refresh` · **Status**: built
(Derek, 2026-10-09: "a scheduled refresh during a live season")

Keeps the season in progress up to date without anyone running the pipeline by hand.

## What one run does

1. Reads `data/generated/seasons.json`. No season in progress: stops, with no network request.
2. Refuses to run unless the repo is on `main` with no uncommitted changes to tracked files.
3. Downloads the season's page: one Liquipedia request. Same revision as stored: stops.
4. Looks for new casts on YouTube, parses, exports with `--strict`.
5. Stops and restores `data/` if the export reports a problem **or prints a note it did not print
   before**. A new note needs a person: a new spelling of a player is never merged without Derek.
6. Runs the parser tests, exporter tests, typecheck and Vitest. Any failure: restore, stop.
7. Commits `data/` to `main` ("Refresh S22 from Liquipedia (revision N)") and deploys with
   `npx vercel deploy --prod --yes`, trying twice.

Nothing public changes unless every step before it passed. If the commit is made but the deploy
fails, `.logs/deploy-pending` is left behind and the next run deploys first.

Every run appends to `.logs/stats-refresh.log` (ignored by git). Read it when the site looks stale.

## The schedule

A Windows scheduled task, "StarCoins stats refresh", runs it every 3 hours while Derek is logged
in on his PC (it uses his Vercel login). After the final is played the season is complete and
every later run stops at step 1.

| Command | What it does |
|---|---|
| `python scripts/refresh/refresh_season.py --schedule [hours]` | Create or replace the task (default every 3 hours) |
| `python scripts/refresh/refresh_season.py --unschedule` | Remove the task |
| `pnpm stats:refresh` | Run once now |
| `pnpm stats:refresh --force --no-deploy` | Run every step even if the page is unchanged, without deploying |

## What it does not do

- Start a new season. Season 23 needs its page title in `TITLES` in
  `scripts/liquipedia/fetch_seasons.py`, a first export, and a look at the notes.
- Resolve markets or enter pick'em results. Those stay with an admin.
- Refresh qualifier pages or player pages.
- A season caught in the middle of a group stage has not been tried (see stats-data.md). Expect
  the first such run to stop at step 5 with new notes.

## Rules for tests

The refresh runs the tests before publishing, so a test must not quote today's results (the
newest series, a current ELO). Read expected values from the data.
