# Quickstart: Field Mapping

## What this feature provides

Field-level mapping between source and destination fields within each object pair. Table-based UI with auto-match on first visit, manual link/unlink via dropdown, type compatibility checks, link status indicators (GREEN/ORANGE/RED_SOLID/RED_DASHED/BROKEN), and a live migration preview sidebar.

## How to use

### Viewing field mappings

Navigate to `/plans/[planId]/field-mapping`. The page shows tabs for each object mapping (e.g., "Account -> Company", "Contact -> Contact") with progress badges. Each tab contains a table of mapped fields and sections for unmapped source/destination fields.

### Auto-match (automatic)

On first visit to the field mapping for an object pair (when `fieldAutoMatchedAt` is null), the system automatically creates links for native field correspondences (registry + name fallback). Runs exactly once per object mapping.

```typescript
// Programmatic trigger (if needed)
const response = await fetch(`/api/plans/${planId}/field-mappings/auto-match`, {
  method: 'POST',
  body: JSON.stringify({ objectMappingId }),
})
const { result } = await response.json()
// result.createdMappings: FieldMappingRow[]
// result.alreadyMatchedAt: string | null (non-null = already ran)
```

### Manual linking

Select a destination field from the "Map to..." dropdown next to an unmapped source field. The mapping is created immediately.

```typescript
// Programmatic creation
const response = await fetch(`/api/plans/${planId}/field-mappings`, {
  method: 'POST',
  body: JSON.stringify({
    objectMappingId,
    sourceFieldName: 'FirstName',
    destinationFieldName: 'firstname',
  }),
})
const { mapping } = await response.json()
// mapping.compatibilityStatus: 'COMPATIBLE' | 'WARNING' | 'INCOMPATIBLE'
// mapping.linkStatus: computed status
```

### Removing a link

Click the delete action on a mapped field row. Migration logic (if any) is cascade-deleted.

```typescript
// Programmatic deletion
const response = await fetch(
  `/api/plans/${planId}/field-mappings/${fieldMappingId}`,
  { method: 'DELETE' }
)
const { deleted } = await response.json()
// deleted.hadMigrationLogic: boolean
```

### Checking type compatibility

```typescript
import { checkCompatibility, normalizeType } from '@/features/012-field-mapping/service/type-compatibility'

const status = checkCompatibility('picklist', 'string')  // 'COMPATIBLE'
const normalized = normalizeType('currency')               // 'number'
```

### Migration preview

The right sidebar shows a live before/after preview for a selected source record. Value equivalences (from migration logic) are applied; transformed values are highlighted in amber.

```typescript
const response = await fetch(
  `/api/plans/${planId}/field-mappings/preview?objectMappingId=${id}&recordIndex=0`
)
const { records, preview } = await response.json()
// records: list of available source records
// preview.fields: source/dest value pairs with isTransformed flag
```

## Link Status Reference

| Status | Color | Meaning |
|--------|-------|---------|
| GREEN | Green solid | Migration logic defined and validated |
| ORANGE | Orange solid | Migration logic defined but not validated |
| RED_SOLID | Red solid | No migration logic defined |
| RED_DASHED | Red dashed | Types are incompatible |
| BROKEN | Red badge "Casse" | Field/object absent from current schema |

Precedence: BROKEN > RED_DASHED > RED_SOLID > ORANGE > GREEN

## Dependencies

- **Depends on**: 011 (ObjectMapping), 005/008 (Source/Destination Fields), 000 (ConnectorField types)
- **Used by**: 013 (Migration Logic), 017 (Schema Integrity), 019/020 (Documents)
- **Consumes**: `PlanDriftContext` from 001 (for drift highlighting)
