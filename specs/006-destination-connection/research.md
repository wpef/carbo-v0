# Research: Destination Connection

## Key Decisions

### 1. Reuse vs. Separate Connection Entity

**Decision**: Reuse `ConnectorConnection` from 002.

The `ConnectorConnection` entity (id, planId, role, adapterType, status, config, createdAt) is generic. The `role` field distinguishes source from destination. No new table needed.

### 2. Adapter Registry: Shared or Separate?

**Decision**: Single shared registry with role filtering.

Each registered adapter declares which roles it supports (source, destination, or both). The UI filters the registry by role when displaying available adapters. HubSpot is registered as a destination adapter; Salesforce as a source adapter. Demo adapters exist for both roles.

```typescript
// Registry entry shape
interface AdapterRegistryEntry {
  type: string;            // "salesforce", "hubspot", "demo"
  label: string;           // "Salesforce", "HubSpot", "Demo Data"
  roles: ("source" | "destination")[];
  capabilities: { canRead: boolean; canWrite: boolean; canWriteSchema: boolean };
  factory: (config: unknown) => ConnectorAdapter;
}
```

### 3. Disconnect Cascade

**Decision**: Disconnecting the destination cascades to: schema snapshots, schema objects, object fields. Does NOT affect source-side data or object mappings (those are cleaned up by the mapping feature if applicable).

The service calls `prisma.schemaSnapshot.deleteMany({ where: { connectionId } })` with cascade deletes on related objects/fields.

### 4. Demo Mode

**Decision**: "Use Demo Data" creates a `ConnectorConnection` with `adapterType: "demo-destination"` and `status: CONNECTED`. The demo adapter returns a pre-seeded HubSpot-like schema. Same pattern as source demo mode from 002.

### 5. HubSpot Authentication

**Decision**: OAuth 2.0 via `@hubspot/api-client`. The adapter stores the access token in the connection's `config` JSON field. Token refresh is handled by the adapter internally. For v0 (local-first), we use a private app access token (simpler than full OAuth flow).

## Trade-offs

| Choice | Pro | Con |
|--------|-----|-----|
| Shared adapter registry | Single source of truth, no duplication | Registry grows with each adapter |
| Private app token (HubSpot) | Simpler setup for v0 | Not production-grade (no OAuth consent) |
| Reuse ConnectorConnection | No schema changes | Role field must be checked consistently |

## API Specifics

### HubSpot Private App Token

- Created in HubSpot Developer Portal > Private Apps
- Scopes needed: `crm.objects.contacts.read`, `crm.schemas.contacts.read`, etc.
- Passed as Bearer token in API calls
- `@hubspot/api-client` accepts it via `new Client({ accessToken })`
