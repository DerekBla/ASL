# Integration References — StarCoins

> Lookup catalogs for external systems. Files here are **read-only for agents** —
> they are curated by humans and capture stable facts about external APIs: endpoint
> lists, error codes, rate limits, and SDK version notes. Agents grep these files
> rather than calling external documentation sites.

## What Goes Here

- API endpoint catalogs (path, method, auth requirement, rate limit)
- SDK version compatibility notes
- Error code registries (third-party code → internal error model mapping)
- Webhook event type catalogs
- Data shape snapshots for critical API responses

## File Naming Convention

```
<system>-reference.md
```

Examples: `clerk-reference.md`, `neon-reference.md`, `liquipedia-reference.md` (data source notes only; no scraping in the app)

## Reference File Template

```markdown
# <System> Reference

**SDK**: <package>@<version>
**Auth**: <method and env var name>
**Docs**: <official docs URL>
**Rate limits**: <requests/second or requests/month>

## Endpoints Used

| Endpoint | Method | Auth required | Rate limit | Purpose |
|---|---|---|---|---|
| /v1/resource | POST | Bearer token | 100/min | Create resource |

## Error Codes

| Code | Meaning | Internal error code | Handling |
|---|---|---|---|
| resource_not_found | Resource does not exist | NOT_FOUND | Return 404 to client |

## Webhook Events (if applicable)

| Event | Payload shape | Handler location |
|---|---|---|
| resource.created | { id, ... } | lib/webhooks/<system>.ts |

## Known Gotchas

- List any non-obvious behaviours, undocumented limits, or bugs in the SDK.
```

## Keeping References Current

Update a reference file when:
- The SDK version is pinned to a new major version.
- An endpoint is deprecated or a new one is adopted.
- A new error code is encountered in production.

Reference files do not need to be exhaustive — only document what the app actually uses.
