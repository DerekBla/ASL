# Foundation Spec: Design Tokens

**Status**: implemented
**Last updated**: 2026-10-07
**Defined in**: `src/app/globals.css` (Tailwind v4 `@theme`) · guarded by `src/app/__tests__/design-tokens.test.ts`

Tokens are CSS variables that Tailwind turns into utilities. Components use the utilities.
They never write a hex value, and never use inline `style` for a color.

## Race colors

Fixed by CLAUDE.md Domain Rules. The test fails if a value changes or is defined twice.

| Race | Pale: player and data cells | Dark: section headers only |
|---|---|---|
| Terran | `bg-race-terran-pale` `#EAF3FB` | `bg-race-terran-dark` `#3A6EA8` |
| Zerg | `bg-race-zerg-pale` `#F0EAF9` | `bg-race-zerg-dark` `#6B4FA0` |
| Protoss | `bg-race-protoss-pale` `#E6F4EC` | `bg-race-protoss-dark` `#3D7A52` |

- Text on a pale race color is `text-race-ink`; text on a dark race color is `text-race-on-dark`.
  Both are fixed, so race cells stay readable in light and dark mode.
- Race is never shown by color alone: the letter or name is always present (comp-6).
- Races render through the shared `RaceBadge` (ROADMAP: Component library baseline), which is
  the only place these utilities should appear once it exists.
- Proper dark-mode variants of the race colors are a separate item (ROADMAP: Dark mode support).

## Surface colors

These follow the system light/dark setting through `prefers-color-scheme`. There is no
JavaScript theme switch.

| Utility | Use |
|---|---|
| `bg-surface` | Page background |
| `bg-surface-muted` | Cards, table header rows, the footer |
| `text-ink` | Body text |
| `text-ink-muted` | Secondary text, captions |
| `border-line` | Borders and dividers |
| `text-accent` | Links and focus rings |

Tailwind's `dark:` variant also follows the system setting, for the rare case a component
needs a one-off dark style.

## Type scale

| Utility | Size / line height | Use |
|---|---|---|
| `text-display` | 2.25rem / 2.5rem, bold | Page title (`h1` default) |
| `text-title` | 1.5rem / 2rem | Section title (`h2` default), large figures |
| `text-heading` | 1.125rem / 1.75rem | Sub-section (`h3` default) |
| `text-body` | 1rem / 1.5rem | Body (default) |
| `text-data` | 0.875rem / 1.25rem | Table cells; pair with `tabular-nums` for numbers |
| `text-caption` | 0.8125rem / 1.125rem | Captions, footer, labels |

Fonts are system stacks (`font-sans`, `font-mono`); no web fonts are loaded.

## Changing tokens

- Race colors change only when CLAUDE.md Domain Rules change. Update the test with them.
- New tokens go in `globals.css` and in this file in the same change.
- Repeated utility groups go into `@layer components` in `globals.css`, not into new CSS files.
