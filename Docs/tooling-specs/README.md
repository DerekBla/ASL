# Tooling Specs — StarCoins

> Specs for agent-facing tooling: scripts, code generators, CLI helpers, and
> automation that agents use during development. Tooling specs describe what a
> tool does, its interface, and when agents should use it instead of doing the
> equivalent manually.

## What Goes Here

- **[export-stats.md](export-stats.md)**: Liquipedia → JSON stats pipeline (implemented)
- Feature scaffold generators (create a new feature folder with boilerplate)
- Component stub generators
- Database seeding scripts for local development and test environments
- Migration helper scripts
- Automation hooks not covered by `code-validation.md` (CI steps, release scripts)

## Template

Create specs as `Docs/tooling-specs/<tool-slug>.md`:

```markdown
# Tooling Spec: <Tool Name>

**Status**: draft | approved | implemented
**Invocation**: `pnpm <command> [args]`
**Location**: scripts/<tool-name>.ts

## Purpose

One paragraph. What problem does this tool solve for an agent?
Why is it better than doing the equivalent manually?

## Interface

```bash
pnpm scaffold:feature --name <domain> [--with-store] [--with-e2e]
```

### Arguments

| Argument | Required | Description |
|---|---|---|
| `--name` | yes | Feature domain name (kebab-case) |
| `--with-store` | no | Generate a Zustand slice alongside |
| `--with-e2e` | no | Generate a Playwright spec stub |

## Output

Exact list of files created or modified by this tool.

## Agent Usage Notes

- When to use this vs. creating files manually.
- Any gotchas or post-run steps required.
- What the agent must still do after running the tool.
```
