# Component: RaceBadge

**File**: `src/components/RaceBadge.tsx` · **Status**: built

Shows a race as a letter chip (`T` / `Z` / `P`, with the full name read out to screen readers)
or as the full name. The only way a race is shown on the site.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `race` | `Race \| null` | — | `null` renders `?` titled "Race unknown" |
| `display` | `"letter" \| "name"` | `"letter"` | Letter in tables, name in headings and summaries |
| `tone` | `"pale" \| "dark"` | `"pale"` | Dark is for section headers only (data-4) |

Rules: always text plus color, never color alone (comp-6). Colors come from the race tokens in
`Docs/foundation-specs/design-tokens.md`; text on pale is `text-race-ink`, on dark
`text-race-on-dark`.
