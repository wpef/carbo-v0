# Quickstart: Source Schema Retrieval

## What this feature provides

- Prisma models for `SchemaSnapshot` and `SchemaObject` (shared by source and destination)
- Service functions: `retrieveSchema`, `computeSchemaDiff`, `detectLiveDrift`
- API routes for triggering retrieval, reading snapshots, viewing diffs, and running drift detection
- TypeScript types: `DriftReport`, `DriftChange`, `DriftModificationType` (canonical taxonomy)

## Prerequisites

- Feature 000 (Connector Interface) — types and adapter registry
- Feature 002 (Source Connection) — active connection with `status: 'CONNECTED'`
- Feature 001 (Migration Plan) — plan context for API routes
- Prisma migrations applied (SchemaSnapshot + SchemaObject tables)

## How to use

### 1. Trigger schema retrieval

```typescript
// From the source page (002) after connection
const res = await fetch(`/api/plans/${planId}/source/schema`, { method: 'POST' })
const { snapshot, diff, integrityResult } = await res.json()
// snapshot.objects contains all retrieved objects
// diff is null on first retrieval, or { addedObjects, removedObjects, modifiedObjects }
// integrityResult reports any broken mappings
```

### 2. Read the current snapshot

```typescript
const res = await fetch(`/api/plans/${planId}/source/schema`)
const { snapshot } = await res.json()
// snapshot.objects: SchemaObject[] with apiName, label, description, isCustom
```

### 3. View the diff

```typescript
const res = await fetch(`/api/plans/${planId}/source/schema/diff`)
const { diff, hasPrevious } = await res.json()
if (hasPrevious && diff) {
  // diff.addedObjects, diff.removedObjects, diff.modifiedObjects
}
```

### 4. Run drift detection (plan reopen)

```typescript
// Called by plan layout (001) on plan visit
const res = await fetch(`/api/plans/${planId}/source/drift`)
const driftReport: DriftReport = await res.json()
if (driftReport.status === 'drift') {
  // driftReport.changes contains categorized DriftChange[]
  // driftReport.severitySummary.critical > 0 → show banner
}
if (driftReport.status === 'unavailable') {
  // driftReport.reason explains why (network, rate limit, expired token)
  // Show degraded banner with manual refresh option
}
```

### 5. Import types for downstream features

```typescript
import type {
  DriftReport,
  DriftChange,
  DriftModificationType,
  DriftSeverity,
} from '@/features/003-source-schema-retrieval/types/drift'

import { DRIFT_MODIFICATION_TYPES } from '@/features/003-source-schema-retrieval/types/drift'
```

## Dependencies

- **Depends on**: 000 (ConnectorAdapter), 001 (MigrationPlan, audit trail), 002 (ConnectorConnection)
- **Used by**: 004 (Object Selection — reads SchemaObject list), 005 (Field Retrieval — populates ObjectField), 007 (Destination Schema — shares models + drift types), 001 (Plan layout — drift banner + sidebar badges), 011/012 (Mapping pages — contextual drift highlighting), 017 (Integrity Check — triggered after retrieval)

## Integration scenarios

### Scenario A: First-time retrieval after source connection

1. Consultant connects source via 002
2. Post-OAuth auto-trigger calls `POST /api/plans/:id/source/schema`
3. Objects are fetched and stored as the CURRENT snapshot
4. `diff` is `null` (no previous snapshot)
5. `integrityResult` reports zero broken mappings (no mappings exist yet)

### Scenario B: Schema refresh with changes

1. Consultant clicks "Rafraichir le schema" on the source page
2. `POST /api/plans/:id/source/schema` fetches new objects
3. Old CURRENT becomes PREVIOUS; new data becomes CURRENT
4. `diff` shows `removedObjects: ["OldObject__c"]`
5. `integrityResult` reports 1 broken mapping; plan status becomes BROKEN
6. Consultant sees broken mapping badge and resolves manually

### Scenario C: Drift detection on plan reopen

1. Consultant navigates to a plan after being on the home page
2. Plan layout (001) calls `GET /api/plans/:id/source/drift`
3. Returns `{ status: 'drift', changes: [{ type: 'FIELD_REMOVED', ... }] }`
4. Banner renders: "Le schema a evolue : 1 changement critique"
5. Consultant clicks "Rafraichir" which triggers the full chain (Scenario B)
