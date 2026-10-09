# Component: SiteHeader

**File**: `src/components/SiteHeader.tsx` · **Status**: built

The logo and site name (link home) and the main navigation, in `<nav aria-label="Main">`. Rendered
once by `src/app/layout.tsx`. One row of links with no group labels (Derek, 2026-10-08), stats pages
first and then the games (`NAV_ITEMS`). The links sit on their own row; the logo row holds the
`search` slot (the player search box) and the `account` slot on the right, both supplied by the
layout. Each label matches the heading of the page it opens. Add a
page by adding an entry.

The logo is `src/components/Logo.tsx`: a gold coin with a star, drawn in SVG with the `coin` color
tokens. The same drawing is the browser tab icon, `src/app/icon.svg`.
