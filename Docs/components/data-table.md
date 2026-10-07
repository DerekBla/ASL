# Component: DataTable

**File**: `src/components/DataTable.tsx` · **Status**: built (client component)

Sortable table with a sticky header. Cells are rendered on the server and passed in as React
nodes; only sorting runs in the browser.

| Prop | Type | Notes |
|---|---|---|
| `caption` | `string` | Required; names the table for screen readers |
| `captionVisible` | `boolean` | Default `true` |
| `columns` | `{ key, header, align?, sortable?, firstSort? }[]` | `sortable` defaults to true; `firstSort: "desc"` for numbers |
| `rows` | `{ id, cells: Record<key, ReactNode>, sort: Record<key, string \| number \| null> }[]` | Sort values are plain data; `null` sorts last in both directions |
| `initialSort` | `{ key, dir }` | Optional |

Accessibility: each sortable header is a `<button>` inside a `<th scope="col">` with `aria-sort`.
Text sorting ignores case and orders digits numerically. Ties fall back to row `id`.
