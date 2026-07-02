# Quickstart: Object Mapping

## What this feature provides

Object-level mapping between source and destination systems within a migration plan. Consultants see a two-column visual layout, auto-link predictable pairs on first visit, manually link/unlink objects, and view per-object stats (record count, field progress, filter count).

## How to use

### Viewing object mappings

Navigate to `/plans/[planId]/mapping`. The two-column view displays source objects (left) and destination objects (right) with SVG links between paired objects.

### Auto-link (automatic)

On first visit to the mapping page (when `objectAutoLinkedAt` is null), the system automatically creates links for predictable pairs (e.g., Account -> Company for Salesforce -> HubSpot). This runs exactly once per plan.

```typescript
// Programmatic trigger (if needed)
const response = await fetch(`/api/plans/${planId}/object-mappings/auto-link`, {
  method: 'POST',
})
const { result } = await response.json()
// result.createdMappings: ObjectMappingRow[]
// result.alreadyLinkedAt: string | null (non-null = already ran, no-op)
```

### Manual linking

Click the connection circle on a source object card, then click the connection circle on a destination object card. The link appears immediately.

```typescript
// Programmatic creation
const response = await fetch(`/api/plans/${planId}/object-mappings`, {
  method: 'POST',
  body: JSON.stringify({
    sourceObjectName: 'Lead',
    destinationObjectName: 'Contact',
  }),
})
const { mapping, warnings } = await response.json()
// warnings may include fan-in alert
```

### Removing a link

Right-click or use the delete action on a link. Confirmation dialog warns about cascade deletion of child data (field mappings, migration logic, filters).

```typescript
// Programmatic deletion
const response = await fetch(
  `/api/plans/${planId}/object-mappings/${mappingId}`,
  { method: 'DELETE' }
)
const { deleted } = await response.json()
// deleted.fieldMappingsCount, deleted.migrationFiltersCount
```

### Object detail modal

Click any object card to open the detail modal showing:
- Object name and source/destination label
- Record count
- Fields remaining to validate (clickable — navigates to field mapping)
- Migration filter count

## Dependencies

- **Depends on**: 001 (MigrationPlan), 002 (Source Connection), 003/005 (Source Schema/Fields), 006 (Destination Connection), 007/008 (Destination Schema/Fields)
- **Used by**: 012 (Field Mapping), 013 (Migration Logic), 014 (Migration Filters), 019/020 (Documents)
- **Consumes**: `PlanDriftContext` from 001 (for drift highlighting)
