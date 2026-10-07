# UI Specs — AslMarkets.Web

> **Component and feature design packages.** UI specs sit between product specs
> (the *why*) and feature specs (the engineering *how*). They describe visual
> design, interaction behaviour, copy, and all UI states — without dictating
> implementation.

## What a UI Spec Contains

- Wireframe or mockup references (Figma links or embedded images)
- Every UI state: empty, loading, error, populated, partial, edge cases
- All copy: headings, labels, button text, error messages, empty state strings
- Interaction behaviour: click, hover, focus, keyboard, drag
- Responsive breakpoints and layout shifts
- Accessibility notes: contrast, focus order, ARIA roles

## Design Constants

- Race colors are fixed (CLAUDE.md Domain Rules). Pale = player/data cells, dark = section
  headers only. Every race color pairing must also show the race letter or name.
- Prices: whole percent in lists (`62%`), one decimal in the trade panel (`62.4%`).
- Credits: thousands separators, max 2 decimals (`1,240.50 credits`). Never "$".
- Copy uses "trade", "position", "payout", "credits". Never "bet", "wager", "cash", or "win money".

## Template

Create specs as `Docs/ui-specs/<slug>.md`:

```markdown
# UI Spec: <Feature or Component Name>

**Designer**: <name>
**Status**: draft | approved | implemented
**Figma**: <link>
**Last updated**: YYYY-MM-DD
**Product spec**: Docs/product-specs/<slug>.md
**Feature spec**: Docs/feature-specs/<slug>.md

## States

### Default / Empty
[Description and mockup reference or Figma frame link]

### Loading
[Skeleton layout description — which elements animate, which are static]

### Populated
[Description and mockup reference]

### Error
[Error message copy, visual treatment, recovery action]

### Edge Cases
- Max items in list: [how overflow is handled]
- Long text: [truncation rules]
- Mobile (< 640px): [layout changes]

## Copy

| Element | Text |
|---|---|
| Page heading | "" |
| Primary CTA | "" |
| Empty state heading | "" |
| Empty state body | "" |
| Error message | "" |
| Success message | "" |

## Interactions

| Trigger | Result |
|---|---|
| Click primary CTA | ... |
| Press Escape | ... |
| Tab key | ... |
| Submit with invalid input | ... |

## Accessibility

- Focus order: [describe the tab sequence]
- ARIA roles: [list non-standard roles used]
- Minimum contrast: 4.5:1 (WCAG AA) for body text, 3:1 for large text and UI components
- Keyboard: all interactive elements reachable and operable without a mouse
```
