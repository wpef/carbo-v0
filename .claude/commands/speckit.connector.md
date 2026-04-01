---
description: Research a new connector's API, generate spec + stub adapter implementing ConnectorAdapter v2. Provide the service name and optionally its API docs URL.
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty). The text after `/speckit.connector` is the service name (e.g., "Freshdesk", "Notion", "Monday.com") and optionally a link to API docs.

## Context

You are generating a new connector adapter for the Carbo data migration platform. Every connector implements the `ConnectorAdapter` interface defined in `src/types/connector.ts`.

### Before you start, read these files (mandatory):
1. `src/types/connector.ts` — the ConnectorAdapter v2 interface (source of truth)
2. `src/lib/connectors/registry.ts` — adapter registry with all existing connectors
3. `specs/connectors/sdk-evolution.md` — SDK gaps and design decisions from research

### Architecture

Carbo connects source and destination systems, plans object/field mappings with rules, then executes the migration. Connectors are the bridge to external systems.

```
src/types/connector.ts          ← abstract interface (DO NOT MODIFY)
src/lib/connectors/registry.ts  ← register your adapter here
src/lib/connectors/{type}/      ← adapter implementation directory
specs/connectors/{type}.md      ← API research documentation
```

### SDK Interface v2 — Key Design Decisions

These decisions were made after researching 8 connectors (Salesforce, HubSpot, Zoho, Pipedrive, Dynamics 365, Airtable, Act!, Google Sheets). Respect them.

**Pagination is dual-mode:**
- `GetRecordsOptions` accepts both `cursor?: string` and `offset?: number`
- `PaginatedRecords` returns `cursor: string | null` (for cursor-based APIs) and `totalCount: number | null` (null when count is expensive)
- Your adapter decides which mode it uses. Document it.

**Capabilities are granular:**
- `canCreateFields` and `canCreateObjects` are separate booleans
- Pipedrive can create fields but NOT objects. Act!/Sheets can do neither.
- `canWriteSchema` = `canCreateFields || canCreateObjects`

**Schema reliability varies:**
- `"authoritative"` = the API returns definitive metadata (most CRMs)
- `"inferred"` = schema is guessed from data (Google Sheets, CSV sources)

**Object discovery varies:**
- `"dynamic"` = API has a "list all objects" endpoint
- `"static"` = hardcoded list of known entities (Act!, Pipedrive)

**Structured field types:**
- Use `structuredType` on ConnectorField for compound types (value+currency), enums (picklists with label+value), arrays (linked records), subforms (inline children)
- Don't use it for simple types (string, number, date, boolean)

**Config schema drives UI:**
- `configSchema` on the registry entry defines what the connection form shows
- Support types: `"string"`, `"password"`, `"select"`, `"number"`

### Common Pain Points to Watch For

From 8 connectors, these issues appear repeatedly:

| Pattern | How to Handle |
|---------|---------------|
| Cursor-based pagination (no numeric offset) | Use cursor in GetRecordsOptions, return cursor in PaginatedRecords |
| No total record count | Return `null` from `getRecordCount()` |
| No "list all objects" endpoint | Return hardcoded list, set `objectDiscovery: "static"` |
| Cannot create custom objects | Set `canCreateObjects: false` |
| Auto-generated field API names | Document in spec, read back after createField() |
| Region-specific API URLs | Add region to configSchema, resolve base URL in connect() |
| Integer-backed picklists | Use structuredType.kind = "enum" with numeric values |
| Compound fields (address, monetary) | Use structuredType.kind = "compound" with subfields |
| Auth: not OAuth2 | Fine — connect(config) accepts any shape. Document the auth flow. |
| Rate limits | Document in spec. No rate limit handling in the interface itself. |

## Execution Steps

### Step 1: Research the API

Search the web for the service's API documentation. Produce a research report covering:

1. **API Overview**: base URL, versioning, rate limits
2. **Authentication**: method (OAuth2, API key, token, etc.), scopes, refresh flow
3. **Data Model**: core objects/entities, fields/properties, custom fields, relationships
4. **Schema Discovery**: list objects endpoint, get fields endpoint, field metadata available
5. **Record Operations**: list/paginate, create/update, batch support
6. **Schema Write**: can create fields? objects? Any post-write steps?
7. **SDK**: official npm package? Quality?
8. **Connector Role**: source-only, destination-only, or both?
9. **ConnectorAdapter Mapping**: how each interface method maps to the API
10. **Pain Points**: what doesn't fit the interface cleanly?

### Step 2: Write the spec

Save the research as `specs/connectors/{type}.md` following the format of existing specs (see `specs/connectors/zoho-crm.md` as reference).

### Step 3: Register the adapter

Add the new adapter type to `AdapterType` union in `src/types/connector.ts` and add its full `AdapterRegistryEntry` to `src/lib/connectors/registry.ts` with:
- Accurate capabilities
- objectDiscovery / schemaReliability
- Complete configSchema

### Step 4: Write the stub adapter

Create `src/lib/connectors/{type}/stub-adapter.ts` that:
- Implements `ConnectorAdapter` (or `FieldWritableAdapter` / `FullyWritableAdapter` if schema write)
- Returns realistic mock data exercising the service's specific behaviors
- Uses the correct pagination mode (cursor or offset)
- Documents service-specific quirks in comments
- Exports a named const (e.g., `notionAdapter`)
- Type-checks cleanly with no `any`

### Step 5: Commit

Commit all files with message format:
```
docs: add {Service} connector research + stub adapter

{One-line summary of role, auth, key characteristic.}
Key SDK behaviors: {list 2-3 notable points}

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

## Output

When done, print a summary table:

```
| Field | Value |
|-------|-------|
| Service | {name} |
| Role | {source/destination/both} |
| Auth | {method} |
| Object Discovery | {dynamic/static} |
| Schema Reliability | {authoritative/inferred} |
| Pagination | {cursor/offset/range} |
| Record Count | {instant/expensive/unavailable} |
| Schema Write | {fields+objects / fields-only / none} |
| Key Pain Point | {main friction with SDK} |
| Files Created | {list} |
```
