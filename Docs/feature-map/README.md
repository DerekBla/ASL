# Feature Map — StarCoins

> **Engineering lens**: every buildable unit, its dependencies, and its status.
> Where the experience-graph describes what users see, the feature map describes
> what engineers build and in what order.

## File Format

Each feature is its own file: `Docs/feature-map/<slug>.md`

```markdown
# Feature: <Name>

**Status**: draft | approved | in-progress | implemented
**Depends on**: (list features that must ship first, or "none")
**Enables**: (list features that become possible after this ships)
**Spec**: Docs/feature-specs/<slug>.md
**Estimate**: XS | S | M | L | XL

## Scope

What is included. What is explicitly excluded (equally important).

## Acceptance Criteria

Bullet list. Every criterion must be independently testable.
- [ ] Criterion 1
- [ ] Criterion 2
```

---

## Dependency Graph

```
Stats data loader ──► Stats pages (seasons, players, races, ELO)
                              │
DB schema ─► Ledger service ─┐│
Auth ────────────────────────┼┴─► Markets (list, detail, trade) ─► Portfolio
                             │                                 └─► Leaderboard
                             └──► Admin (create, resolve, void)
```

---

## How to Add a Feature

1. Create `Docs/feature-map/<slug>.md` using the template above.
2. Add a `draft` entry to ROADMAP.md under the matching category.
3. Link the feature-map file from the relevant product-spec and feature-spec.
4. A human must promote the ROADMAP entry to `approved` before work begins.
5. When the feature ships, update status to `implemented` in both this file and ROADMAP.md.
