# Quickstart: Destination Connection

## What this feature provides

Allows a consultant to connect a destination system (HubSpot or demo) to a migration plan, auto-retrieve the destination schema after OAuth, refresh the schema on demand, and reconfigure the connection with impact-aware cascade logic.

## Prerequisites

- Feature 000 (Connector Interface) — types + adapter registry
- Feature 001 (Migration Plan) — plan entity with `destinationConnectionId` FK
- A running Neon Postgres instance with Prisma migrations applied
- For HubSpot: valid OAuth app credentials in environment variables

## How to connect a destination (happy path)

### 1. Open the destination step

Navigate to `/plans/[planId]/destination`. The page shows available adapters if no connection exists.

### 2. Select an adapter and authenticate

```typescript
// Client-side: POST to connect
const res = await fetch(`/api/plans/${planId}/destination`, {
  method: 'POST',
  body: JSON.stringify({ adapterType: 'hubspot', config: { accessToken: 'pat-xxx' } }),
})
// For demo mode:
// body: JSON.stringify({ adapterType: 'demo-destination', config: {} })
```

### 3. Auto-retrieval after OAuth callback

After HubSpot OAuth completes, the callback redirects to `/plans/[planId]/destination?connected=hubspot`. The page auto-triggers schema+fields retrieval:

```typescript
// In the destination page component (simplified)
useEffect(() => {
  const params = new URLSearchParams(window.location.search)
  const connectedAdapter = params.get('connected')
  if (connectedAdapter) {
    triggerRefresh(planId)  // POST /api/plans/[planId]/destination/refresh
  }
}, [])
```

### 4. Manual refresh

Once connected, the "Rafraichir le schema" button calls:

```typescript
const res = await fetch(`/api/plans/${planId}/destination/refresh`, { method: 'POST' })
```

## How to reconfigure a destination

### 1. Preview the impact

```typescript
const preview = await fetch(
  `/api/plans/${planId}/destination/reconfigure?mode=preview`,
  {
    method: 'POST',
    body: JSON.stringify({ adapterType: 'hubspot', config: { accessToken: 'pat-new' } }),
  }
)
const { schemaDiff, impactReport, stepRollbackTo } = await preview.json()

if (impactReport.isEmpty) {
  // Apply silently (FR-011)
  await applyReconfiguration(planId, body)
} else {
  // Show confirmation dialog (FR-010)
  showReconfigurationDialog({ schemaDiff, impactReport, stepRollbackTo })
}
```

### 2. Confirm (if impact is non-empty)

```typescript
const result = await fetch(
  `/api/plans/${planId}/destination/reconfigure?mode=confirm`,
  {
    method: 'POST',
    body: JSON.stringify({ adapterType: 'hubspot', config: { accessToken: 'pat-new' } }),
  }
)
```

## Using the destination connection service

```typescript
import {
  connectDestination,
  disconnectDestination,
  refreshDestinationSchema,
  previewReconfiguration,
  applyReconfiguration,
} from '@/lib/services/destination-connection'

// Connect
const connection = await connectDestination(planId, 'hubspot', { accessToken: 'pat-xxx' })

// Refresh schema (MVP: silent overwrite)
const refreshResult = await refreshDestinationSchema(planId)

// Preview reconfiguration
const { schemaDiff, impactReport } = await previewReconfiguration(planId, 'hubspot', newConfig)

// Apply reconfiguration (atomic)
const result = await applyReconfiguration(planId, 'hubspot', newConfig)
```

## Dependencies

- **Depends on**: 000 (ConnectorAdapter types + registry), 001 (MigrationPlan entity)
- **Used by**: 007 (Destination Schema Browse — if separate), 011 (Object Mapping), 012 (Field Mapping), 013 (Migration Logic), 015 (Migration Filters), 017 (Link Status), 019/020 (Documents)

## Environment Variables

```env
# HubSpot OAuth (required for real connections)
HUBSPOT_CLIENT_ID=xxx
HUBSPOT_CLIENT_SECRET=xxx
HUBSPOT_REDIRECT_URI=http://localhost:3000/api/auth/hubspot/callback

# Neon Postgres (required)
DATABASE_URL=postgresql://...
```
