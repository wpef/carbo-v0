# Data Model: Unmapped Fields Detection

## Prisma Schema

### FieldExclusion (FR-003, FR-004, FR-005)

```prisma
model FieldExclusion {
  id              String        @id @default(uuid())
  objectMappingId String
  sourceFieldName String
  reason          String?
  createdAt       DateTime      @default(now())

  objectMapping   ObjectMapping @relation(fields: [objectMappingId], references: [id], onDelete: Cascade)

  @@unique([objectMappingId, sourceFieldName])
}
```

> Convention: `id = String @id @default(uuid())` (not `cuid()`). No `@@map` directive — the table name is `FieldExclusion` (PascalCase, Prisma default). No separate `@@index([objectMappingId])` — the `@@unique` constraint already covers that lookup.

## Field Descriptions

### FieldExclusion

| Field | Type | Description |
|-------|------|-------------|
| `id` | `String (uuid)` | Unique identifier. |
| `objectMappingId` | `String` | FK to the parent ObjectMapping. Cascade-deleted when the object mapping is removed. |
| `sourceFieldName` | `String` | The API name of the source field that the consultant has intentionally excluded from mapping. |
| `reason` | `String?` | Optional text explaining why the field was excluded (e.g., "System field, not relevant for migration"). |
| `createdAt` | `DateTime` | Exclusion creation timestamp. |

## Relationships

```
ObjectMapping (1) ──► (N) FieldExclusion    (cascade delete)
```

**Note**: FieldExclusion is a leaf entity belonging to ObjectMapping. When an object mapping is deleted (011 FR-011), all its exclusions are cascade-deleted automatically.

## Constraints

- `@@unique([objectMappingId, sourceFieldName])` -- a source field can be excluded at most once per object mapping. Attempting to exclude an already-excluded field returns a conflict error.
- Cascade delete from ObjectMapping ensures exclusions are cleaned up when the parent mapping is removed.
- No FieldExclusion can exist for a field that is currently mapped (FR-006 auto-clear). This is enforced at the application level during field mapping creation, not by a DB constraint.

## Indexes

- `FieldExclusion.objectMappingId` -- query all exclusions for an object mapping.
- `@@unique([objectMappingId, sourceFieldName])` -- also serves as an index for the auto-clear lookup.

## Computed State: Unmapped Fields Report

The unmapped fields report is NOT stored. It is computed at read time from three data sources:

```typescript
interface UnmappedFieldsReport {
  // Source side
  unmappedSourceFields: FieldInfo[]           // allSourceFields - mappedSourceFields - excludedSourceFields
  excludedSourceFields: FieldExclusionInfo[]  // FieldExclusion records
  sourceCoverage: number                      // (mapped + excluded) / total * 100

  // Destination side
  unmappedRequiredDestFields: FieldInfo[]     // requiredDestFields - mappedDestFields
  destinationRequiredCoverage: number         // mappedRequiredDest / totalRequiredDest * 100

  // Summary
  totalSourceFields: number
  mappedSourceFields: number
  totalRequiredDestFields: number
  mappedRequiredDestFields: number
  fieldsRemainingToValidate: number           // unmappedSource.length + unmappedRequiredDest.length
  isComplete: boolean                         // sourceCoverage === 100 && destinationRequiredCoverage === 100
}

interface FieldInfo {
  apiName: string
  label: string
  dataType: string
  isRequired: boolean
}

interface FieldExclusionInfo {
  id: string
  sourceFieldName: string
  reason: string | null
  createdAt: string
}
```

### Computation Logic

```typescript
function computeUnmappedFields(
  sourceFields: ConnectorField[],
  destFields: ConnectorField[],
  fieldMappings: { sourceFieldName: string; destinationFieldName: string }[],
  exclusions: { sourceFieldName: string; reason: string | null }[]
): UnmappedFieldsReport {
  const mappedSourceNames = new Set(fieldMappings.map(fm => fm.sourceFieldName))
  const mappedDestNames = new Set(fieldMappings.map(fm => fm.destinationFieldName))
  const excludedSourceNames = new Set(exclusions.map(e => e.sourceFieldName))

  const unmappedSourceFields = sourceFields
    .filter(f => !mappedSourceNames.has(f.apiName) && !excludedSourceNames.has(f.apiName))

  const requiredDestFields = destFields.filter(f => f.isRequired)
  const unmappedRequiredDestFields = requiredDestFields
    .filter(f => !mappedDestNames.has(f.apiName))

  const mappedSourceCount = sourceFields.filter(f => mappedSourceNames.has(f.apiName)).length
  const excludedCount = sourceFields.filter(f => excludedSourceNames.has(f.apiName)).length
  const sourceCoverage = sourceFields.length > 0
    ? ((mappedSourceCount + excludedCount) / sourceFields.length) * 100
    : 100

  const mappedRequiredDestCount = requiredDestFields.filter(f => mappedDestNames.has(f.apiName)).length
  const destinationRequiredCoverage = requiredDestFields.length > 0
    ? (mappedRequiredDestCount / requiredDestFields.length) * 100
    : 100

  return {
    unmappedSourceFields,
    excludedSourceFields: exclusions,
    sourceCoverage: Math.round(sourceCoverage),
    unmappedRequiredDestFields,
    destinationRequiredCoverage: Math.round(destinationRequiredCoverage),
    totalSourceFields: sourceFields.length,
    mappedSourceFields: mappedSourceCount,
    totalRequiredDestFields: requiredDestFields.length,
    mappedRequiredDestFields: mappedRequiredDestCount,
    fieldsRemainingToValidate: unmappedSourceFields.length + unmappedRequiredDestFields.length,
    isComplete: sourceCoverage === 100 && destinationRequiredCoverage === 100,
  }
}
```

## Integration Points

### ObjectMapping relation update

The ObjectMapping model (defined in 011) needs to add the reverse relation:

```prisma
model ObjectMapping {
  // ... existing fields ...
  fieldExclusions   FieldExclusion[]
}
```

### Auto-Clear on Field Mapping Creation (FR-006)

When a FieldMapping is created for `sourceFieldName = X` on `objectMappingId = Y`, the field mapping creation service (012) must execute:

```typescript
await prisma.fieldExclusion.deleteMany({
  where: { objectMappingId: Y, sourceFieldName: X }
})
```

This is included in the same transaction as the field mapping creation.
