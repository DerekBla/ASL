# Product Spec: Authentication (Sign Up & Sign In)

**Author**: Derek
**Status**: draft
**Last updated**: 2026-10-06 *(adapted from KeepOrMulligan.Web)*

---

## Problem

AslMarkets.Web lets fans trade play-money credits on ASL outcomes. Trading needs an
identity: balances, positions, and leaderboard ranks belong to someone. The stats half
of the site needs no account at all. The BW community lives on Discord, so asking fans
to create yet another password is unnecessary friction.

## Goal

A fan can create an account and sign in using their existing Google or Discord
account in under 30 seconds, with no passwords to manage.

## Non-Goals

- Email/password sign-up — not supported; social login only.
- Magic link / passwordless email — not in scope.
- Role-based permissions beyond "authenticated user" and a single `is_admin` flag set in the database by hand.
- Profile customization (display name, avatar) — covered in a separate Settings spec.

## Success Criteria

- [ ] A new user can sign up with Google in < 30 seconds from the landing page.
- [ ] A new user can sign up with Discord in < 30 seconds from the landing page.
- [ ] A returning user is signed back in automatically if their session is active.
- [ ] A returning user can explicitly sign in if their session has expired.
- [ ] A signed-in user can sign out from anywhere in the app.
- [ ] Protected routes redirect unauthenticated users to sign in, then return them to their original destination after.
- [ ] First sign-in creates a user, an account, and a 1,000-credit signup grant exactly once (idempotent).
- [ ] Auth state is consistent between RSC (server) and client components — no flash of unauthenticated content.

## User Stories

- As a new fan, I want to sign up with my Google account so I don't have to
  remember another password.
- As a new fan, I want to sign up with my Discord account because that's where
  the BW community lives.
- As a returning trader, I want to be kept signed in across visits so I don't have
  to sign in every time.
- As a returning trader, I want to sign out when I'm on a shared device.
- As a fan who was browsing stats or a market without an account, I want to be taken back to the
  page I was on after I sign in.

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Auth provider | Clerk | Hosted, great Next.js 15 App Router SDK, handles sessions and tokens |
| Sign-in methods | Discord + Google OAuth only | Low friction; Discord is where BW fans are |
| Display name | Discord/Google username at sign-up | Shown on leaderboard; no custom names in v1 |
| Session storage | Clerk-managed (httpOnly cookie) | Secure, no custom session logic needed |

## Open Questions

_(none — all decisions resolved)_

## Related

- ROADMAP entry: Foundation → Auth (Clerk + Google/Discord)
- Feature spec: Docs/feature-specs/auth.md *(to be written when this spec is approved)*
- UI spec: Docs/ui-specs/auth.md *(to be written when this spec is approved)*
- Integration spec: Docs/integration-specs/clerk.md *(to be written when this spec is approved)*
