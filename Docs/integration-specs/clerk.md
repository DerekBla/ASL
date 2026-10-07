# Integration Spec: Clerk

**Status**: implemented
**Last updated**: 2026-10-07
**Pinned**: @clerk/nextjs 7.9.11 (Clerk Core 3)
**Package**: `@clerk/nextjs` (pin at scaffold; record in `references/clerk-reference.md`)
**Auth**: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
**Product spec**: `Docs/product-specs/auth.md`

## Scope

- Social login only: Discord and Google. Configure both in the Clerk dashboard; disable
  email/password and magic links.
- `clerkMiddleware()` in `middleware.ts`. Protect `/portfolio` and `/admin/*` and all
  trade/admin Server Actions. Stats and market pages stay public.

## User provisioning

Lazy, in our database, on the first authenticated **write** (trade) or portfolio visit:

```
ensureUser(clerkUserId):
  INSERT INTO users (id, display_name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING
  if inserted: create account + ledger.grantCredits(SIGNUP_GRANT_CREDITS /* 100 */, 'signup_grant')   -- same transaction
```

Idempotent by primary key, so concurrent first requests can't double-grant. A Clerk
webhook (`user.created`) can replace this later; keep `ensureUser` as the fallback.

## Admin

`users.is_admin` in our database, set by hand in SQL. Do **not** rely on Clerk metadata alone
for admin checks. Server Actions read `is_admin` from Postgres.

## Gotchas

- Clerk 7 removed `SignedIn` / `SignedOut`; use `<Show when="signed-in">`.
- Without both keys the site skips `ClerkProvider` and the middleware lets everything through,
  so the stats site keeps working (and stays statically rendered).

- `auth()` is async in recent `@clerk/nextjs` versions: `const { userId } = await auth()`.
- Display names come from Discord/Google at sign-up; store a copy (leaderboards must not call
  Clerk per row).
