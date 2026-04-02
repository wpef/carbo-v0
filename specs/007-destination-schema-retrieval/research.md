# Research: Destination Schema Retrieval

## Key Decisions

### 1. Shared vs. Separate Schema Service

**Decision**: Reuse the schema retrieval service from 003.

The `schema-retrieval.service.ts` created for source schema retrieval is connection-agnostic. It takes a `connectionId`, calls the adapter's `getSchema()`, persists the snapshot, and computes the diff. The same service works for destination connections without modification.

If 003's service is not yet generic enough, the implementation task will refactor it to accept any connection (source or destination) by `connectionId` alone, without assuming a role.

### 2. Destination Objects: Selection or All?

**Decision**: All objects are available. No selection step for destination.

Per spec: "Destination objects do not need selection -- all are available for mapping." This simplifies the flow. The UI shows the full list for reference, and all objects are available when creating field mappings later.

### 3. Schema Diff for Destination

**Decision**: Same CURRENT/PREVIOUS rotation as source.

The diff logic (added/removed/modified objects) is identical. The `SchemaDiffResult` type from 000 is reused. The UI component `schema-diff.tsx` is shared.

### 4. HubSpot Schema Retrieval

**Decision**: Use `@hubspot/api-client` CRM schemas endpoint.

```typescript
// HubSpot schema retrieval via API client
const hubspot = new Client({ accessToken });
const schemas = await hubspot.crm.schemas.coreApi.getAll();
// Returns: { results: [{ name, labels, properties, ... }] }

// Standard objects (contacts, companies, deals, tickets) are retrieved separately
const standardObjects = ["contacts", "companies", "deals", "tickets"];
```

HubSpot distinguishes standard objects (contacts, companies, deals, tickets) from custom objects. Standard objects are retrieved via their specific APIs; custom objects via the schemas API. The adapter normalizes both into `ConnectorObject[]`.

### 5. Component Reuse Strategy

**Decision**: Extract shared schema UI components if not already done in 003.

| Component | Location | Used by |
|-----------|----------|---------|
| `object-list.tsx` | `src/components/schema/` | 003 (source), 007 (destination) |
| `schema-diff.tsx` | `src/components/schema/` | 003 (source), 007 (destination) |

If 003 placed these in `src/components/source/`, they should be moved to `src/components/schema/` for sharing. This is a refactoring task.

## Trade-offs

| Choice | Pro | Con |
|--------|-----|-----|
| Shared schema service | No code duplication | Must ensure 003's service is generic |
| No selection step | Simpler UX, less code | Large schema shown in full (mitigated by search/filter) |
| Component extraction | DRY, consistent UI | Requires refactoring if 003 was source-specific |
