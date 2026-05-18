# Quickstart: Source Connection

## What this feature provides

The source connection step within a migration plan: adapter selection, authentication, schema retrieval (auto + manual), demo mode, disconnect, and reconfiguration with schema-diff-based impact analysis.

## Prerequisites

- Feature 000 (Connector Interface): types at `@/lib/types/connector`, adapter registry, demo adapter
- Feature 001 (Migration Plan): `MigrationPlan` model with `sourceConnectionId`, plan layout with sidebar

## How to use

### 1. Connect a source (initial)

```typescript
// Client: POST to connect
const res = await fetch(`/api/plans/${planId}/source`, {
  method: 'POST',
  body: JSON.stringify({
    adapterType: 'demo',    // or 'salesforce'
    config: {},
    credentials: {},
  }),
})
const { connection } = await res.json()
// connection.status === 'CONNECTED'
```

### 2. Auto-recovery after OAuth

The source page detects `?connected=salesforce` in the URL and automatically triggers schema retrieval. No manual action needed.

```typescript
// In source-page-client.tsx (simplified)
useEffect(() => {
  const params = new URLSearchParams(window.location.search)
  const connectedAdapter = params.get('connected')
  if (connectedAdapter) {
    window.history.replaceState({}, '', window.location.pathname)
    refreshSchema()
  }
}, [])
```

### 3. Refresh schema manually

```typescript
// Client: POST to refresh
const res = await fetch(`/api/plans/${planId}/source/refresh`, { method: 'POST' })
const { schemaSnapshot } = await res.json()
// schemaSnapshot.objectCount, schemaSnapshot.fieldCount updated
```

### 4. Reconfigure (change adapter or credentials)

Two-step flow: preview then apply.

```typescript
// Step 1: Preview impact
const preview = await fetch(`/api/plans/${planId}/source/reconfigure/preview`, {
  method: 'POST',
  body: JSON.stringify({ adapterType: 'salesforce', config: {...}, credentials: {...} }),
})
const { schemaDiff, impact, newSchemaSnapshot } = await preview.json()

if (impact.isEmpty) {
  // Silent apply (FR-012)
}

// Step 2: Apply after user confirmation
const apply = await fetch(`/api/plans/${planId}/source/reconfigure/apply`, {
  method: 'POST',
  body: JSON.stringify({
    adapterType: 'salesforce',
    config: {...},
    credentials: {...},
    newSchemaSnapshot,
    confirmedImpact: true,
  }),
})
```

### 5. Disconnect

```typescript
const res = await fetch(`/api/plans/${planId}/source`, { method: 'DELETE' })
// Cascade-deletes schema snapshot + selections, resets step to SOURCE
```

## Key service functions

| Function | Location | Purpose |
|----------|----------|---------|
| `connectSource(planId, payload)` | `services/connect-source.ts` | Authenticate + create connection |
| `disconnectSource(planId)` | `services/connect-source.ts` | Delete connection + cascade |
| `fetchSchema(connectionId)` | `services/fetch-schema.ts` | Chain: schema -> objects -> fields |
| `computeSchemaDiff(old, new)` | `services/schema-diff.ts` | Pure diff between two snapshots |
| `computeImpactReport(diff, planId)` | `services/impact-report.ts` | Query downstream for impact |
| `applyReconfiguration(planId, payload)` | `services/apply-reconfiguration.ts` | Atomic transaction |
| `normalizeType(rawType)` | `lib/normalize-type.ts` | Type bucketing for compatibility |

## Dependencies

- **Depends on**: 000 (Connector Interface), 001 (Migration Plan)
- **Used by**: 003 (Source Schema browsing), 011 (Object Mapping), 012 (Field Mapping)

## Integration with plan layout

The source page is rendered at `/plans/[planId]/source` inside the plan layout (001 FR-007). The sidebar shows the SOURCE step as active. The "Reconfigurer" button (FR-006) appears in the connected state alongside the connection status display.
