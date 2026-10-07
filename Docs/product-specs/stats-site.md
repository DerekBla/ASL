# Product Spec: Stats Site

**Author**: Derek *(drafted with Claude — review before approving)*
**Status**: approved (Derek, 2026-10-07)
**Last updated**: 2026-10-07

---

## Problem

ASL history is spread across Liquipedia pages, VODs, and community memory. Derek has
built a database of all 21 seasons (placements, ELO, career stats, race matchups) that only he
can browse. The site rebuilds it from Liquipedia's season pages, which also give every series result. Fans who want to answer "how has
SnOw done across every season?" or "how does ZvP go in playoffs?" have no single place to look.

## Goal

Anyone can browse every ASL season, player, race matchup, and head-to-head record on a fast,
linkable website without an account.

## Non-Goals

- Individual games and maps (series results are in; games are a later roadmap item).
- Editing data on the site. Liquipedia, plus Derek's overrides, is the source of truth.
- Live scores or broadcast integration.
- Non-ASL leagues (KSL, starleagues before 2016).

## Success Criteria

- [ ] Every season S1–S21 has a page with finals result, prize pool, and full placements.
- [ ] Every player (85) has a page with a placement timeline, career stats, ELO, and series record.
- [ ] An ELO page shows the same columns the spreadsheet's ELO tab had: rank, player, race, current
  ELO, peak ELO, peak season, seasons, championships. (Derek, 2026-10-07)
- [ ] A head-to-head lookup shows every ASL series between any two players. (Derek, 2026-10-07)
- [ ] Race stats show titles, field share, and series matchups by stage.
- [ ] Pages are statically generated; first load < 1.5s on mobile 4G.
- [ ] Updating the site after a season is: fetch, export, commit, deploy. Nothing manual.
- [ ] Race colors match the old spreadsheet's scheme exactly.

## User Stories

- As a fan, I want to look up a player and see every season they played and how far they got.
- As a fan, I want to compare races across eras so I can settle matchup arguments.
- As a fan, I want to pick two players and see every time they met in the ASL.
- As a fan, I want an ELO ranking like Derek's spreadsheet had, to argue about who's best.
- As a fan, I want to share a link to a specific season or player page.
- As a market trader, I want to jump from a market to the players' history before I trade.
- As Derek, I want to fix a cell in Excel and have the site reflect it after one command.

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Data delivery | Static JSON generated from Liquipedia | No DB needed for stats; fast; diffable |
| ELO label | "Placement ELO" with an explainer | It's not match-based; don't overclaim |
| Identity variants | Shown separately until confirmed | Faithful to the data; avoids wrong merges |

## Open Questions

- [ ] Show estimated prize earnings publicly (Player Stats "Est. Prize")? — owner: Derek
- [ ] Domain name — owner: Derek

## Related

- ROADMAP: Feature → Stats (three items); Foundation → Stats data loader
- Data contract: Docs/foundation-specs/stats-data.md
- Feature spec: Docs/feature-specs/stats-site.md *(to be written when this spec is approved)*
- UI spec: Docs/ui-specs/stats-site.md *(to be written when this spec is approved)*
