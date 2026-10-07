# Product Specs — StarCoins

> **What to build and why.** Product specs are written by humans (product owners,
> designers, stakeholders). Agents read them but do not author them. Agents write
> feature-specs (the *how*), which must reference a product-spec (the *why*).

## What a Product Spec Contains

A product spec answers: **What problem does this solve, for whom, and how will we
know it worked?** It does NOT describe implementation, data models, or components.

## Template

Create specs as `Docs/product-specs/<slug>.md`:

```markdown
# Product Spec: <Name>

**Author**: <name>
**Status**: draft | approved | implemented
**Last updated**: YYYY-MM-DD

## Problem

One paragraph. Who has this problem? How painful is it? What do they do today
to work around it?

## Goal

One sentence. What changes for the user when this ships?

## Non-Goals

Explicitly list what this spec does NOT address. Helps scope conversations.

## Success Criteria

How will we know this worked? Measurable where possible.
- [ ] Criterion 1
- [ ] Criterion 2

## User Stories

- As a <user type>, I want <goal> so that <reason>.

## Open Questions

Must be resolved before engineering begins.
- [ ] Question 1 — owner: <name>, due: YYYY-MM-DD

## Related

- Feature map entry: Docs/feature-map/<slug>.md
- UI spec: Docs/ui-specs/<slug>.md
- Feature spec: Docs/feature-specs/<slug>.md
```

## Status Rules

- **draft**: idea captured, open questions may exist
- **approved**: all open questions resolved; engineering may spec the how
- **implemented**: feature shipped and verified against success criteria
