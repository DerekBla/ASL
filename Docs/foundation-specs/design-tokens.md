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

## Medal colors

From the old spreadsheet's placement fills. Used by `PlacementBadge`, with `text-race-ink`.

| Utility | Value | Placement |
|---|---|---|
| `bg-medal-gold` | `#FFF0B3` | 1st |
| `bg-medal-silver` | `#E8E8EC` | 2nd |
| `bg-medal-bronze` | `#F5DEC0` | 3rd and 4th |

## Liquipedia formatting (Derek, 2026-10-07)

The look follows Liquipedia, replacing the earlier soft, rounded style: Open Sans, MediaWiki
heading sizes with a rule under each `h2`, compact bordered tables with a grey header row,
flat bordered panels with 0.5rem corners, small 0.25rem corners on badges and buttons, no
pills and no shadows. Use the shared classes in `globals.css` instead of rebuilding these:

| Class | Use |
|---|---|
| `card` | Any boxed section or table: radius 0.5rem, `border-line`, `bg-card`, no shadow |
| `stat` | A small figure tile (label + number), bordered |
| `notice` | A quiet bordered message box on `bg-surface-muted` |
| `field` | Text inputs and selects: `border-line-strong`, 0.25rem corners, thin focus ring |

`DataTable` draws every cell with a `border-line-strong` rule, `px-2 py-1` padding and a
`bg-table-head` header, like a wikitable.

| Token | Light | Dark | Use |
|---|---|---|---|
| `line-strong` | `#c3c7cf` | `#44464b` | Table cell rules, `h2` underline, inputs |
| `table-head` | `#eaecf0` | `#242424` | Table header row (wikitable `th`) |

Primary buttons use `bg-accent text-on-accent` (white on light, dark blue on the light
dark-mode accent).

## Liquipedia palette (Derek, 2026-10-07)

Colors follow Liquipedia's StarCraft wiki theme, read from its saved stylesheet (its
`--clr-*` variables). Race colors are unchanged.

| Token | Light | Dark | Liquipedia source |
|---|---|---|---|
| `nav` / `on-nav` | `#3a5ba9` / white | `#003866` / white | `.main-nav` (sapphire) |
| `nav-hover` / `on-nav-hover` | `#d9e2ff` / `#00184a` | `#002d52` / white | wiki primary container |
| `surface` (page) | `#f1f4fa` | `#121212` | `--clr-surface-1` / dark background |
| `card` | `#ffffff` | `#1b1b1b` | `--clr-surface` |
| `surface-muted` | `#e3ebf5` | `#282828` | `--clr-surface-3` |
| `ink` / `ink-muted` | `#1b1b1b` / `#43474e` | `#e2e2e6` / `#b3b3b3` | on-surface / on-surface-variant |
| `line` | `#dfe2eb` | `#2f3033` | `--clr-surface-variant` |
| `accent` / `on-accent` | `#3a5ba9` / white | `#b0c5ff` / `#002b76` | `--clr-wiki-primary` |
| `link` | `#0645ad` | `#9fc9ff` | wiki link blue / dark primary |

## Surface colors

These follow the system light/dark setting through `prefers-color-scheme`. There is no
JavaScript theme switch.

| Utility | Use |
|---|---|
| `bg-surface` | Page background (blue-tinted off-white / near-black) |
| `bg-card` | Cards, tables, header, tooltips |
| `bg-surface-muted` | Notices, hovered rows, secondary buttons |
| `text-ink` | Body text |
| `text-ink-muted` | Secondary text, captions |
| `border-line` | Borders and dividers |
| `text-link` | Links |
| `text-accent` | Primary buttons and focus rings |

Tailwind's `dark:` variant also follows the system setting, for the rare case a component
needs a one-off dark style.

## Chart colors

Validated with the dataviz palette checks against `--card` in both modes. Assign in this
fixed order and never cycle: an outcome keeps its color.

| Utility | Light | Dark |
|---|---|---|
| `series-1` (also `chart-line`) | `#2a78d6` | `#3987e5` |
| `series-2` | `#eb6834` | `#d95926` |
| `series-3` | `#1baf7a` | `#199e70` |
| `series-4` | `#eda100` | `#c98500` |

Series 3 and 4 are below 3:1 against white, so any chart using them shows direct labels or a
table (the price chart does both). Charts with more than four outcomes plot the four most
likely and keep every price in the table.

## Type scale

| Utility | Size / line height | Use |
|---|---|---|
| `text-display` | 1.75rem / 2.25rem, weight 400 | Page title (`h1` default; wiki 188%) |
| `text-title` | 1.40625rem / 1.875rem, weight 400 | Section title (`h2` default, underlined; wiki 150%), large figures |
| `text-heading` | 1.2rem / 1.6rem, weight 700 | Sub-section (`h3` default; wiki 128% bold) |
| `text-body` | 0.9375rem / 1.5 | Body (default; wiki 15px) |
| `text-data` | 0.875rem / 1.3 | Table cells; pair with `tabular-nums` for numbers |
| `text-caption` | 0.8125rem / 1.25 | Captions, footer, labels |

The font is Open Sans (Liquipedia's), loaded with `next/font/google` in `layout.tsx`, which
downloads it at build time and serves it from the site. `font-sans` falls back to Segoe UI,
Roboto and Arial.

## Changing tokens

- Race colors change only when CLAUDE.md Domain Rules change. Update the test with them.
- New tokens go in `globals.css` and in this file in the same change.
- Repeated utility groups go into `@layer components` in `globals.css`, not into new CSS files.
