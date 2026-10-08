# Feature Spec: Drafts (fantasy ASL)

**Status**: implemented (deployed 2026-10-08; decisions approved by Derek 2026-10-08)
**Last updated**: 2026-10-08
**Requested by**: Derek, 2026-10-08. Scoring rule and the Liquipedia fetch are his.

A signed in user starts a private draft league for a coming season and invites friends with a
link. They draft the season's players in snake order with 60 seconds per pick. Each team scores
1 point for every game (map) its players win, plus bonus points for deep runs. The best team at the end is the Draft champion.
No minerals move.

## Routes

| Path | Rendering | Description |
|---|---|---|
| `/drafts` | dynamic | What drafts are, a form to start one, the reader's leagues |
| `/drafts/[id]` | dynamic, polled | The league: lobby, live draft room, then standings. Public to view |
| `/drafts/join/[code]` | dynamic | Invite page with a Join button |
| `/api/drafts/[id]` | route handler | League state for polling. Settles an expired pick clock |
| `/admin` | dynamic, admin | Per season: fetch game wins from Liquipedia, check, save |

## How a draft runs

1. **Create** (`createLeague`): needs a season whose players are set up (its pick'em exists)
   and which has not locked. The league stores its own copy of the player list, ordered by ELO.
2. **Invite**: members see an invite link (`/drafts/join/<code>`, a random 12 character code).
   Anyone signed in with the link can join while the league is in the lobby. 2 to 12 managers.
3. **Start** (`startDraft`, owner only): the owner picks the team size from 1 up to
   `floor(players / managers)`, so the choices depend on how many joined (28 players and 4
   managers: up to 7 each). The order is drawn at random. Refused once the season has locked.
4. **Pick** (`makePick`): snake order (1 2 3, 3 2 1, ...). 60 seconds per pick
   (`PICK_SECONDS`).
5. **Your pick**: the page plays a short two note sound each time a pick becomes yours
   (`useTurnDing`). Managers can switch it off with a checkbox in the draft room; the choice
   is kept in the browser. The page must be open, and a browser may hold the first sound back
   until the page has been clicked once.
6. **Clock runs out**: the highest rated player still free is picked for that manager, marked
   "picked by the clock".
7. **Drafted**: when every team is full. Standings then follow the season.

### The pick clock without a background worker

The site has no always running process, so `advanceDraft` settles the clock lazily: every pick,
and any read that finds the deadline passed (`readLeague`, used by the page and the polling
route), first makes the picks that timed out. Each timed out pick starts the next clock where
the last one ended, so the outcome is the same whenever the catching up happens, including a
draft everyone walked away from. It runs under a row lock on the league and uses the database
clock. Browsers count down from the server's time, not their own.

The league page polls every 2 seconds while drafting and every 4 in the lobby, and stops once
drafted.

## Scoring

- 1 point per game won by a player on the team, for the whole season (Derek, 2026-10-08).
- 1 bonus point each time a player reaches the round of 8, the round of 4, the final, and wins
  the title (Derek, 2026-10-08): up to 4 per player. Read from the season's pick'em results,
  as one point for each round a player advances out of that leaves 8 or fewer standing
  (`BONUS_FIELD`). So bonuses appear when the admin enters results, with no extra step.
- Game wins live in `pickems.game_wins` (player to number), one table per season.
- An admin fills them from `/admin`: **Fetch game wins from Liquipedia** reads the season's
  page live (`src/lib/services/liquipedia/`), counts each `{{Map|winner=}}` to its winner, maps
  page spellings to the season's players (through the stats aliases, so `JD` is Jaedong), and
  fills the form. Names it cannot match are listed. Nothing is saved until the admin presses
  **Save game wins**, and the numbers can be corrected by hand first.
- Teams level on points share a rank. Eliminated players are marked "(out)" from the pick'em results.
- **Draft champion**: the rank 1 team once the season's final is decided in the pick'em
  results. Shown on the league page and in the reader's list of drafts. Computed, not stored.

## Data

Migration `drizzle/0002_drafts.sql`: `draft_leagues` (season's pick'em, name, invite code,
owner, status `lobby | drafting | drafted`, team size, player pool, order, clock start),
`draft_members`, `draft_picks` (one row per pick, a player at most once per league), and the
`game_wins` column on `pickems`. Written only by `lib/services/draft` and
`lib/services/pickem`.

## Server Actions (`src/features/draft/actions/draft.ts`)

| Action | Input | Notes |
|---|---|---|
| `createLeagueAction` | `{ season, name }` | Any signed in user |
| `joinLeagueAction` | `{ code }` | Joining twice is harmless |
| `startDraftAction` | `{ leagueId, teamSize }` | Owner only, checked in the service |
| `makePickAction` | `{ leagueId, player }` | Must be the manager on the clock |
| `fetchGameWinsAction` (admin) | `{ season, page }` | One request to Liquipedia; saves nothing |
| `saveGameWinsAction` (admin) | `{ season, gameWins }` | Replaces the season's table |

## Decisions (approved by Derek, 2026-10-08)

1. A draft needs the season's player list, which comes from that season's pick'em setup. So
   the admin sets up the pick'em first, and both features share one player list and one set of results.
2. Drafts must start before the season locks (the pick'em lock time).
3. Invites are a link, not a search for usernames. Anyone with the link and an account can join.
4. League pages are public to view; only members see the invite link.
5. The clock picks by ELO rating. Players with no ELO come last, in listed order.
6. Fetching from Liquipedia fills the form for review instead of saving directly.
7. No leaving a league, removing a manager, pausing, or trades after the draft.

## Not built

- Automatic refresh of game wins on a schedule (it is a button).
- A notification that reaches you when the page is closed (the sound needs the page open).
- Leaving or deleting a league.
- Rate limiting (`sec-6`). Playwright coverage.

## Tests

`src/lib/draft/__tests__/draft.test.ts`, `src/lib/services/draft/__tests__/draft.test.ts`
(PGlite: invites, start rules, snake order, the clock, standings),
`src/lib/services/liquipedia/__tests__/parse-games.test.ts` (against the stored S21 page),
`src/features/draft/components/__tests__/LeagueLive.test.tsx`,
`src/app/__tests__/draft-pages.test.tsx`.
