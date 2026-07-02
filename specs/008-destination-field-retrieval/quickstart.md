# Quickstart: Destination Field Retrieval

## What this feature provides

After the destination schema is retrieved (007), this feature fetches and persists field metadata for every destination object. The consultant can then browse destination fields per object, seeing labels, API names, data types, and constraint badges (required, read-only, unique). This data feeds downstream mapping (011/012).

## Prerequisites

- Feature 000 (ConnectorAdapter interface) implemented
- Feature 006 (Destination Connection) implemented -- connection exists and is CONNECTED
- Feature 007 (Destination Schema Retrieval) implemented -- CURRENT snapshot with objects exists

## How to use

### 1. Trigger field retrieval (part of full chain)

Field retrieval is normally triggered as the second step of the destination full chain. After schema retrieval (007) completes:

```typescript
// In the destination schema service (007), after persisting objects:
import { retrieveDestinationFields } from '@/features/destination/services/destination-field-service'

const result = await retrieveDestinationFields({
  connectionId: connection.id,
  snapshotId: snapshot.id,
  planId: plan.id,
})

console.log(`Retrieved ${result.totalFields} fields across ${result.objectResults.length} objects`)
```

### 2. Read persisted fields for a destination object

```typescript
import { getDestinationFieldsByObject } from '@/features/destination/services/destination-field-service'

const fields = await getDestinationFieldsByObject({
  snapshotId: currentSnapshot.id,
  objectId: selectedObject.id,
})

// Each field has: apiName, label, dataType, isRequired, isReadOnly, isUnique, isAccessible, referenceTo, relationshipType
```

### 3. Display fields in the UI

```tsx
import { DestinationFieldList } from '@/features/destination/components/destination-field-list'

// Inside a destination object detail view:
<DestinationFieldList objectId={object.id} snapshotId={snapshot.id} />
```

The component renders a table with columns: Label, API Name, Type, and badge indicators for Required, Read-Only, Unique, and No Access.

### 4. API route usage

```bash
# Trigger retrieval
POST /api/plans/{planId}/destination/fields

# Get all fields for a specific object
GET /api/plans/{planId}/destination/objects/{objectId}/fields

# Get all destination fields (optionally filtered)
GET /api/plans/{planId}/destination/fields?objectApiName=contacts
```

## Key behaviors

- **No object selection**: Unlike source (005), destination retrieves fields for ALL objects. No selection step.
- **Full chain only**: Field retrieval always runs as part of schema -> fields. The page must never show objects without fields (007 FR-004).
- **Partial failure handling**: If field retrieval fails for one object, it succeeds for others. The failed object is reported in the response.
- **Audit logging**: Every retrieval is logged with object count, field count, and failed objects (FR-003).

## Dependencies

- **Depends on**: 000 (ConnectorAdapter.getFields), 006 (destination connection), 007 (destination schema/snapshot)
- **Used by**: 011 (Object Mapping), 012 (Field Mapping), 017 (Mapping Integrity Check)
