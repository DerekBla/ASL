# Feature Spec: Pick'em

**Status**: in-progress (built and migrated 2026-10-08; decisions approved by Derek 2026-10-08; not yet deployed)
**Last updated**: 2026-10-08
**Product spec**: Docs/product-specs/pickem.md

Before a season starts, a signed in fan fills out one bracket: who advances out of every
round, down to the champion. Brackets lock at the first match, then all of them are public,
scored as results come in, ranked, and awarded achievements. No minerals move.

## Routes

| Path | Rendering | Description |
|---|---|---|
| `/pickem` | dynamic | Every season's pick'em with its status |
| `/pickem/[season]` | dynamic | Your bracket (editor while open, summary after), results so far, standings |
| `/pickem/[season]/brackets/[entryId]` | dynamic | One person's bracket: rank, points, accuracy, achievements, every pick marked |
| `/admin` | dynamic, admin | New section: create or edit a pick'em, enter results |

All three public routes work signed out. Saving a bracket needs sign in. Without the Neon and
Clerk keys they show "Pick'em is warming up", as the market pages do.

## Bracket model

A pick'em is a list of **players** and an ordered list of **rounds** (`src/lib/pickem/types.ts`).

- A round has `advance` (how many players get out of it), `points` per right pick, and for
  the first round only `perGroup`.
- A player has a first round group, or is a seed with `entersAt: 1` (joins in round two).
- A bracket is, per round, the players picked to advance. Each round is picked from the
  players advanced out of the round before, plus seeds joining there. So the round of 16
  groups, which are drawn after the round of 24, never need to be known in advance.
- Results have the same shape, entered by an admin, and may be half filled.

Standard ASL format (`ASL_ROUNDS`), 27 picks, 76 points:

| Round | Advance | Points each | Round total |
|---|---|---|---|
| Round of 24 | 12 (2 per group) | 1 | 12 |
| Round of 16 | 8 | 2 | 16 |
| Quarterfinals | 4 | 4 | 16 |
| Semifinals | 2 | 8 | 16 |
| Final | 1 (champion) | 16 | 16 |

The format is data, not code: an admin can enter different rounds for a season that differs.

## Scoring (`src/lib/pickem/scoring.ts`, pure)

- A pick is **right** when the player is in that round's results.
- A pick is **wrong** once the player is out: their round is fully decided without them, or
  in the group round their own group is. A player who is out makes every later pick of them wrong.
- Otherwise it is **pending**.
- A pick left blank counts as a miss once its round is decided.
- **Accuracy** = right / (right + wrong). **Best possible** = points plus all pending picks.
- **Rank**: points, then accuracy, then name. Equal points share a rank (1, 1, 3).

Nothing derived is stored. Scores, ranks and achievements are recomputed from picks and
results on every read, so correcting a result corrects everything.

## Achievements (`src/lib/pickem/achievements.ts`, pure, per season)

| Achievement | Earned when |
|---|---|
| Called the champion | The champion pick is right |
| Dark horse | Called the champion, and under one in five brackets did (5 brackets minimum) |
| Perfect *round* | Every pick in a round is right (each round except the final), as soon as it is decided |
| Perfect bracket | All picks right |
| Sharp eye | Accuracy of 75% or better at the end |
| Season winner | Rank 1 at the end |
| Podium finish | Rank 2 or 3 at the end |

The last four wait for the final. Shown on the bracket page and in the standings table.

## Rules enforced in the service (`src/lib/services/pickem/`)

- One bracket per user per season; saving replaces it. Unfinished brackets are allowed.
- Saves are refused once `locks_at` has passed, checked against the database clock inside
  the transaction (the same rule as market closes).
- **Other people's picks are hidden until the lock.** Before it, standings list only who has
  entered and how many picks they have made; a bracket page shows picks only to its owner.
- Picks and results are validated by `checkSelection`; a setup by `checkConfig`.
- An admin can change the title and lock time any time, but the players and rounds only until
  the first bracket is saved (`PICKEM_HAS_ENTRIES`).
- Admin status is checked in the action and again in the service transaction. Results record
  who entered them, when, and a source note.

## Data

Migration `drizzle/0001_pickem.sql`: `pickems` (one per season: title, `locks_at`, `config`
jsonb, `results` jsonb, results audit columns) and `pickem_entries` (`picks` jsonb, unique per
pick'em and user). These are not ledger tables.

## Server Actions (`src/features/pickem/actions/`)

| Action | Input | Output | Side effects |
|---|---|---|---|
| `savePicksAction` | `{ season, picks }` | `ActionResult<{ entryId, picksMade, totalPicks }>` | Upserts the viewer's bracket; revalidates the season page |
| `savePickemAction` (admin) | `{ season, title, locksAt, entrants, rounds }` | `ActionResult<{ season, created }>` | Creates or edits. Known players are stored in canonical spelling, blank races filled from the stats data |
| `saveResultsAction` (admin) | `{ season, results, note }` | `ActionResult<{ season, status }>` | Replaces the results; every bracket is rescored on the next read |

No Zustand store. The editor keeps picks in component state and saves through `useMutation`.

## States

| Situation | Behavior |
|---|---|
| Keys not set | "Pick'em is warming up" |
| No pick'em yet | Notice that one opens when the next season's players and groups are announced |
| Open, signed out | Sign in link; standings show who is in |
| Open, signed in | Bracket editor; a group closes at two picks; unpicking a player clears them from later rounds |
| Locked | Editor replaced by your rank and a link to your bracket; results and full standings shown |
| Someone else's bracket before the lock | "This bracket is hidden until the pick'em locks" |
| Save after the lock | "Brackets are locked. The season has started." |

## Decisions (approved by Derek, 2026-10-08)

1. Picks are "who advances from each round", not individual matches, because ASL groups are
   dual tournaments and the round of 16 groups are drawn late.
2. Points 1 / 2 / 4 / 8 / 16.
3. Brackets are hidden from others until the lock, so nobody copies the leader.
4. No minerals are awarded. Achievements are the only reward.
5. Achievements are per season and computed, not stored. There is no career achievements page yet.

## Not built

- A page of one user's brackets and achievements across seasons.
- Entering results automatically from Liquipedia (needs "In-progress season support").
- Replacing a withdrawn player after brackets are in.
- Rate limiting on saves (`sec-6`).
- Playwright coverage; component, page, rule and database tests exist.

## Tests

`src/lib/pickem/__tests__/pickem.test.ts` (rules, scoring, ranking, achievements),
`src/lib/services/pickem/__tests__/pickem.test.ts` (PGlite: lock, visibility, admin checks,
standings), `src/features/pickem/components/__tests__/BracketEditor.test.tsx`,
`src/features/pickem/__tests__/setup-text.test.ts`, `src/app/__tests__/pickem-pages.test.tsx`.
