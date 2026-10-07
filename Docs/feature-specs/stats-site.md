# Feature Spec: Stats Site

**Status**: implemented
**Last updated**: 2026-10-07
**Product spec**: Docs/product-specs/stats-site.md
**Data**: Docs/foundation-specs/stats-data.md (read only through `src/lib/services/stats/`)

## Routes

| Path | Rendering | Description |
|---|---|---|
| `/seasons` | static | Every season: champion, runner-up, final score, dates, prize pool. Newest first |
| `/seasons/[season]` | static, 21 pages (`dynamicParams = false`) | Final, playoff series, all placements with prize, every group-stage series, Liquipedia source link |
| `/players` | static | Career table for every player, sortable on every number |
| `/players/[slug]` | static, one page per player | Career figures, ELO (current, peak, rank), season-by-season placements, series record overall and by opponent race, every opponent with a head-to-head link, other spellings |
| `/elo` | static | ELO table with the old spreadsheet's columns: Rank, Player, Race, Current ELO, Peak ELO, Peak season, Seasons, Championships. Explains that it is placement-based |
| `/races` | static | Titles and field share by race, series matchup matrices (all stages, playoffs, finals), race counts per season |
| `/head-to-head?a=&b=` | dynamic (reads search params) | Two-player lookup: series record, every series, seasons both entered with placements |

Player slugs come from `playerSlug(name)` (`src/lib/utils/slug.ts`): lowercase, runs of other
characters become one hyphen (`force(Name)` → `force-name`). The loader refuses to start if two
players would share a slug.

## Building blocks

- Feature components live in `src/features/stats/components/` and are exported from
  `src/features/stats/index.ts`. Routes stay thin: look up, 404 if missing, render.
- Shared components: `DataTable`, `RaceBadge`, `PlacementBadge`, `Button`, `SiteHeader`
  (see `Docs/components/`).
- Formatting goes through `src/lib/utils/format.ts` (₩ amounts, ELO with one decimal,
  percentages, en-dash scores and ranges, date ranges).

## States

| Situation | Behavior |
|---|---|
| Unknown season or player URL | 404 page (`notFound()`); no other paths are generated |
| Head-to-head with no players chosen | Form only |
| Head-to-head with an unknown name | Form keeps the input; alert: `No ASL player called "X". Pick a name from the list.` |
| Head-to-head with the same player twice (including an old spelling) | Alert: `Pick two different players.` |
| Two players who never met | Record `0–0`, "They have never met in an ASL series.", shared seasons still listed |
| Season without a third-place match | Both semifinal losers are 3rd, with a note under the playoffs |
| Player with no race | `RaceBadge` shows `?` titled "Race unknown" (none today) |
| Contract mismatch in `data/generated/` | Build fails with `StatsDataError` |

There are no loading states: everything except head-to-head is static HTML, and head-to-head
renders on the server in one pass from bundled data.

## Interactions

- Table sorting is the only client-side code (`DataTable`, about 1 KB). Each sortable header is
  a button; `aria-sort` reflects the state; a first click on a number column sorts high to low;
  blank values sort last in both directions.
- The head-to-head form is a plain `GET` form with a `<datalist>` of player names, so it works
  without JavaScript and the result URL can be shared. Aliases and any letter case are accepted.

## Tests

`src/app/__tests__/stats-pages.test.tsx` renders every route (including the 404 and error
states); `src/lib/services/stats/__tests__/lookups.test.ts` covers slugs and head-to-head;
component tests cover `DataTable` sorting and the badges.
