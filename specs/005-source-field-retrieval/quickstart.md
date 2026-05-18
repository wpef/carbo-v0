# Quickstart: Source Field Retrieval

## What this feature provides

Retrieves and persists field metadata (type, constraints, relationships, accessibility) for selected source objects. Displays fields per object with badges for required, read-only, unique, inaccessible, and relationship info.

## Prerequisites

- Feature 001 (Migration Plan) — plan exists
- Feature 002 (Source Connection) — source connected (status CONNECTED)
- Feature 003 (Source Schema Retrieval) — CURRENT snapshot with objects
- Feature 004 (Source Object Selection) — at least one object with `isSelected=true`

## How to trigger field retrieval

Field retrieval is triggered after object selection confirmation. In the auto-setup flow (002), it runs automatically as part of the connection chain (schema → objects → fields).

```typescript
// Programmatic trigger (from service layer)
import { retrieveFieldsForSelectedObjects } from '@/features/005-source-field-retrieval/services/field-retrieval-service'

const summary = await retrieveFieldsForSelectedObjects(planId)
// summary: { totalObjects, succeeded, failed, totalFields, failures }
```

```typescript
// Via API route
const res = await fetch(`/api/plans/${planId}/source/fields`, { method: 'POST' })
const { summary } = await res.json()
```

## How to read persisted fields

```typescript
// All fields for all selected objects
const res = await fetch(`/api/plans/${planId}/source/fields`)
const { objects } = await res.json()
// objects: [{ objectApiName, objectLabel, fieldCount, fields: ObjectField[] }]

// Fields for a single object
const res = await fetch(`/api/plans/${planId}/source/fields/Account`)
const { fields } = await res.json()
```

## Key types

```typescript
// ObjectField (Prisma model — persisted)
interface ObjectField {
  id: string
  objectId: string
  snapshotId: string
  apiName: string
  label: string
  dataType: string
  isRequired: boolean
  isReadOnly: boolean
  isUnique: boolean
  isAccessible: boolean
  referenceTo: string | null
  relationshipType: string | null  // "lookup" | "master-detail" | "external"
}
```

## UI behavior

- Fields are displayed in a table per object: columns are Label, API Name, Type, Required, Read-only, Unique, Relationship
- Inaccessible fields show a "No Access" badge (FR-004)
- Relationship fields show the target object name and type (FR-003)
- Unknown/system-specific data types display as-is with a "special type" indicator
- Objects with 100+ fields: all fields rendered, no truncation (FR-005 / acceptance scenario 5)
- Partial failure: failed objects show an error message; succeeded objects display fields normally (FR-006)

## Dependencies

- **Depends on**: 000 (ConnectorAdapter.getFields), 001 (MigrationPlan), 002 (ConnectorConnection), 003 (SchemaSnapshot, SchemaObject), 004 (object selection isSelected flag)
- **Used by**: 011 (Object Mapping — knows which fields exist per object), 012 (Field Mapping — maps source fields to destination fields), 003 (drift detection — field-level diff)
