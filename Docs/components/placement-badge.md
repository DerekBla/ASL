# Component: PlacementBadge

**File**: `src/components/PlacementBadge.tsx` · **Status**: built

Renders an exported `PlacementValue` (`{ label, best, worst }`). It never parses the label.

| Tier (by `best`) | Look |
|---|---|
| 1 | Gold medal token, bold |
| 2 | Silver medal token, bold |
| 3–4 | Bronze medal token |
| 5–8 | Muted surface |
| 9+ | Muted text |

The medal colors are the old spreadsheet's placement fills (`bg-medal-gold`, `-silver`,
`-bronze`). The label carries the meaning, so color is never the only signal.
