# Connector SDK — Evolution Recommendations

**Date**: 2026-03-27
**Based on**: Research of 6 connectors (Zoho, Act!, Airtable, Pipedrive, Dynamics 365, Google Sheets) + 2 existing (Salesforce, HubSpot)
**Purpose**: Identify gaps in the current `ConnectorAdapter` interface and propose changes for v2

## Current Interface Recap

```typescript
interface ConnectorAdapter {
  type: string;
  capabilities: ConnectorCapabilities; // { canRead, canWrite, canWriteSchema }
  connect(config: Record<string, unknown>): Promise<ConnectorConnection>;
  disconnect(connectionId: string): Promise<void>;
  getObjects(connectionId: string): Promise<ConnectorObject[]>;
  getFields(connectionId: string, objectApiName: string): Promise<ConnectorField[]>;
  getRecords(connectionId: string, objectApiName: string, options: { offset: number; limit: number }): Promise<PaginatedRecords>;
  getRecordCount(connectionId: string, objectApiName: string): Promise<number>;
  refreshSchema(connectionId: string): Promise<SchemaDiffResult>;
}
```

---

## Gap 1: Pagination Model (CRITICAL — 4/6 connectors)

### Problem
`PaginatedRecords` uses numeric `offset`. Airtable, Pipedrive, Dynamics 365 use **opaque cursor tokens**. Zoho's COQL also has offset limitations (max 2000).

### Affected
- **Airtable**: opaque string tokens, no jump-to-page
- **Pipedrive v2**: opaque `next_cursor`, no total_count
- **Dynamics 365**: server-driven `@odata.nextLink` (full URL)
- **Zoho COQL**: offset capped at 2000
- **Google Sheets**: range-based, numeric offset works
- **Salesforce/HubSpot**: offset-based, numeric works

### Recommendation
Support both models. Replace `offset: number` with a union:

```typescript
interface PaginatedRecords {
  records: Record<string, unknown>[];
  totalCount: number | null;         // null when count is unavailable/expensive
  pageSize: number;
  cursor: string | null;             // opaque cursor for next page (null if no more)
  hasMore: boolean;
}

// In getRecords options:
interface GetRecordsOptions {
  limit: number;
  cursor?: string;                   // pass cursor from previous response
  offset?: number;                   // for adapters that support numeric offset
}
```

`totalCount: number | null` — explicitly allow null for connectors that cannot provide it cheaply (Airtable, Pipedrive, Sheets).

---

## Gap 2: Partial Schema-Write Capabilities (HIGH — 3/6)

### Problem
`WritableConnectorAdapter` extends with both `createField()` and `createObject()`. But:
- **Pipedrive**: can create fields, CANNOT create objects (no custom objects)
- **Act!/Sheets**: neither (source-only, but even if they were writable)
- **Airtable**: both
- **Dynamics/Zoho/HubSpot**: both

### Recommendation
Split `canWriteSchema` into two flags:

```typescript
interface ConnectorCapabilities {
  canRead: boolean;
  canWrite: boolean;
  canWriteSchema: boolean;           // keep for backward compat: true if either below is true
  canCreateFields: boolean;          // can create custom fields/properties
  canCreateObjects: boolean;         // can create custom objects/entities/tables
}
```

This lets Pipedrive declare `canCreateFields: true, canCreateObjects: false`.

---

## Gap 3: Static vs Dynamic Object Discovery (HIGH — 2/6)

### Problem
`getObjects()` implies dynamic discovery from the API. But Act! and Pipedrive have a **fixed set of known entities** with no list-all-objects endpoint.

### Impact
Not a code-level issue (adapters can return hardcoded lists), but a **spec-level distinction**: the UI/UX should indicate whether the object list is exhaustive (Salesforce, HubSpot, Zoho, Airtable, Dynamics) or a known subset (Act!, Pipedrive).

### Recommendation
Add a flag to `AdapterRegistryEntry`:

```typescript
interface AdapterRegistryEntry {
  // ... existing fields
  objectDiscovery: "dynamic" | "static";  // dynamic = API-discovered, static = hardcoded
}
```

No interface change needed — `getObjects()` already works for both cases. The flag is informational for the UI.

---

## Gap 4: totalCount Unavailable (HIGH — 3/6)

### Problem
`getRecordCount()` returns `Promise<number>`, but:
- **Airtable**: no count endpoint, must paginate all records
- **Pipedrive v2**: no count in cursor responses
- **Google Sheets**: must read entire column A

### Recommendation
Allow null: `getRecordCount(): Promise<number | null>`. Return null when counting is expensive (>5s). The UI shows "—" instead of a number. Let the caller decide if they want to trigger an expensive count.

Alternatively, add a `countStrategy` to capabilities:
```typescript
interface ConnectorCapabilities {
  // ... existing
  countStrategy: "instant" | "expensive" | "unavailable";
}
```

---

## Gap 5: Region/Environment Context (MEDIUM — 2/6)

### Problem
Zoho has 8 regional datacenters, Dynamics has per-org URLs. The base API URL varies per connection.

### Impact
Not an interface gap per se — each adapter resolves its own base URL from config. But the `connect(config)` config object should be documented per adapter.

### Recommendation
No interface change. Add `authConfig` type per adapter in the registry:

```typescript
interface AdapterRegistryEntry {
  // ... existing
  configSchema: Record<string, { type: string; required: boolean; description: string }>;
}
```

This lets the UI dynamically render the connection form based on the adapter's config requirements.

---

## Gap 6: Compound/Structured Field Types (MEDIUM — 2/6)

### Problem
- **Pipedrive**: monetary (value + currency), daterange (start + end), address (multi-component)
- **Dynamics 365**: OptionSets (integer-backed, need label resolution)
- **Zoho**: subforms (inline child records)
- **Airtable**: multipleRecordLinks (array of IDs)

`ConnectorField.dataType` is a plain string. It doesn't express compound types.

### Recommendation
Keep `dataType: string` as the primary type. Add optional metadata:

```typescript
interface ConnectorField {
  // ... existing
  dataType: string;
  structuredType?: {
    kind: "compound" | "enum" | "array" | "subform";
    subfields?: ConnectorField[];     // for compound types
    options?: { label: string; value: string | number }[];  // for enums/picklists
    referencedObjectApiName?: string; // for array-of-references
  };
}
```

This is backward-compatible — existing adapters don't set `structuredType` and everything works as before.

---

## Gap 7: Schema Reliability Level (MEDIUM — 1/6)

### Problem
Google Sheets has no real schema — it's inferred from data. Salesforce has authoritative metadata. The interface doesn't distinguish.

### Recommendation
Add to `AdapterRegistryEntry`:

```typescript
interface AdapterRegistryEntry {
  // ... existing
  schemaReliability: "authoritative" | "inferred";
}
```

When `inferred`, the UI shows a warning: "Schema is inferred from data and may not be accurate."

---

## Gap 8: Auth Pattern Diversity (LOW — 1/6)

### Problem
Act! uses username/password auth, not OAuth2 or API keys. The interface's `connect(config: Record<string, unknown>)` is flexible enough, but there's no guidance for the UI.

### Recommendation
Covered by Gap 5's `configSchema` on `AdapterRegistryEntry`. The auth method is just part of the config. No interface change needed.

---

## Gap 9: Multi-Name Objects (LOW — 1/6)

### Problem
Dynamics 365 entities have 3 names (LogicalName, SchemaName, EntitySetName). `ConnectorObject.apiName` is one string.

### Recommendation
Keep `apiName` as the primary name used for API calls (EntitySetName for Dynamics). Add optional display aliases:

```typescript
interface ConnectorObject {
  // ... existing
  apiName: string;                   // used in API calls
  aliases?: Record<string, string>;  // optional: { logicalName: "account", schemaName: "Account" }
}
```

Only Dynamics would populate this. Minimal impact on other adapters.

---

## Gap 10: Post-Write Actions (LOW — 1/6)

### Problem
Dynamics requires `PublishXml` after creating entities/attributes. The `createField()`/`createObject()` interface doesn't have a publish concept.

### Recommendation
**No interface change.** Each adapter handles post-write actions internally. The Dynamics adapter calls `PublishXml` as the last step of `createField()`/`createObject()`. The caller doesn't need to know.

---

## Priority Matrix

| Gap | Severity | Effort | Recommendation |
|-----|----------|--------|----------------|
| 1. Pagination cursor | Critical | Medium | Extend PaginatedRecords + GetRecordsOptions |
| 2. Partial schema-write | High | Low | Add canCreateFields/canCreateObjects flags |
| 3. Static object discovery | High | Low | Add objectDiscovery flag to registry |
| 4. totalCount unavailable | High | Low | Allow null return from getRecordCount |
| 5. Region/environment | Medium | Medium | Add configSchema to registry |
| 6. Compound field types | Medium | Medium | Add optional structuredType to ConnectorField |
| 7. Schema reliability | Medium | Low | Add schemaReliability flag to registry |
| 8. Auth diversity | Low | — | Covered by Gap 5 |
| 9. Multi-name objects | Low | Low | Add optional aliases to ConnectorObject |
| 10. Post-write actions | Low | — | No change (adapter-internal) |

## Implementation Order

1. **Gaps 1 + 4** (pagination + totalCount) — these block any adapter that uses cursors
2. **Gap 2** (partial schema-write) — unblocks Pipedrive as destination
3. **Gaps 3 + 5 + 7** (registry metadata) — informational, unblocks dynamic UI
4. **Gap 6** (compound types) — needed for full Pipedrive/Dynamics mapping fidelity
5. **Gap 9** (aliases) — nice-to-have for Dynamics

## Connector Summary Table

| Connector | Role | Auth | Object Discovery | Pagination | Count | Schema Write | Key Challenge |
|-----------|------|------|-----------------|------------|-------|-------------|---------------|
| Salesforce | source | OAuth2 PKCE | dynamic | offset | instant | no | — (reference impl) |
| HubSpot | destination | Private App token | dynamic | offset | instant | fields + objects | — (reference impl) |
| Zoho CRM | both | OAuth2 + region | dynamic | page-based (offset capped) | instant | fields + objects | 8 regional endpoints |
| Pipedrive | both | API token / OAuth2 | static (hardcoded) | cursor | unavailable | fields only | no custom objects, hash field keys |
| Dynamics 365 | both | Azure AD OAuth2 | dynamic | cursor (@odata.nextLink) | instant ($count) | fields + objects + publish | 3 naming systems, Azure AD setup |
| Airtable | both | PAT / OAuth2 | dynamic | cursor (opaque tokens) | expensive | fields + tables | 5 req/sec, 10 record batch |
| Act! CRM | source-only | username/password | static (hardcoded) | offset | unreliable | no | no SDK, legacy data quality |
| Google Sheets | source-only | Google OAuth2 | dynamic (sheets=tabs) | range-based (offset works) | expensive | no | no schema, no types, no IDs |
