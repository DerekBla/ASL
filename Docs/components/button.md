# Component: Button

**File**: `src/components/Button.tsx` · **Status**: built (primary, secondary)

| Prop | Type | Default |
|---|---|---|
| `variant` | `"primary" \| "secondary"` | `"primary"` |
| `type` | `"button" \| "submit" \| "reset"` | `"button"`, so it never submits a form by accident |

All other `<button>` attributes pass through. `className` is not accepted: variants are the API.
Still to come with markets: destructive and ghost variants, sizes, and a loading state with
`aria-busy`.
