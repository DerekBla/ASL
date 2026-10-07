# Product Spec: Stats Site

**Author**: Derek *(drafted with Claude — review before approving)*
**Status**: draft
**Last updated**: 2026-10-06

---

## Problem

ASL history is spread across Liquipedia pages, VODs, and community memory. Derek has
built a cleaned, cross-checked database of all 21 seasons (placements, ELO, career stats,
race matchups) in a spreadsheet that only he can browse. Fans who want to answer "how has
SnOw done across every season?" or "how does ZvP go in playoffs?" have no single place to look.

## Goal

Anyone can browse every ASL season, player, and race matchup from Derek's database on a fast,
linkable website without an account.

## Non-Goals

- Match-level data (individual games, maps, VODs). The database is placement-level.
- Editing data on the site. The workbook is the only source of truth.
- Live scores or broadcast integration.
- Non-ASL leagues (KSL, starleagues before 2016).

## Success Criteria

- [ ] Every season S1–S21 has a page with finals result, prize pool, and full placements.
- [ ] Every player in the database (90 today) has a page with a placement timeline and career stats.
- [ ] Every table on the Race Stats tab is presented on the site.
- [ ] Pages are statically generated; first load < 1.5s on mobile 4G.
- [ ] Updating the site after a workbook change is: export, commit, deploy. Nothing manual.
- [ ] Race colors match the workbook scheme exactly.

## User Stories

- As a fan, I want to look up a player and see every season they played and how far they got.
- As a fan, I want to compare races across eras so I can settle matchup arguments.
- As a fan, I want to share a link to a specific season or player page.
- As a market trader, I want to jump from a market to the players' history before I trade.
- As Derek, I want to fix a cell in Excel and have the site reflect it after one command.

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Data delivery | Static JSON generated from the workbook | No DB needed for stats; fast; diffable |
| ELO label | "Placement ELO" with an explainer | It's not match-based; don't overclaim |
| Identity variants | Shown separately until confirmed | Faithful to the data; avoids wrong merges |

## Open Questions

- [ ] Resolve the 14 exporter validation warnings before public launch? — owner: Derek
- [ ] Show estimated prize earnings publicly (Player Stats "Est. Prize")? — owner: Derek
- [ ] Domain name — owner: Derek

## Related

- ROADMAP: Feature → Stats (three items); Foundation → Stats data loader
- Data contract: Docs/foundation-specs/stats-data.md
- Feature spec: Docs/feature-specs/stats-site.md *(to be written when this spec is approved)*
- UI spec: Docs/ui-specs/stats-site.md *(to be written when this spec is approved)*
