# Data Model: Object Mapping

## Prisma Schema

### ObjectMapping (FR-004, FR-005, FR-006, FR-007, FR-011)

```prisma
model ObjectMapping {
  id                    String    @id @default(uuid())
  planId                String
  sourceObjectName      String                    // apiName of the source object (from SchemaObject)
  destinationObjectName String                    // apiName of the destination object (from SchemaObject)
  autoCreated           Boolean   @default(false) // true if created by auto-link (FR-004)
  fieldAutoMatchedAt    DateTime?                 // set once by 012 when field-level auto-match runs

  // Relations
  plan          MigrationPlan    @relation(fields: [planId], references: [id], onDelete: Cascade)
  fieldMappings FieldMapping[]
  filters       MigrationFilter[]
  exclusions    FieldExclusion[]

  @@unique([planId, sourceObjectName, destinationObjectName])  // FR-006: no duplicate pairs
}
```

> Convention : `id = String @id @default(uuid())` — pas de `@@map` (noms de tables PascalCase par défaut).
> `ObjectMapping` n'a pas de colonne `status` : la broken-ness est dérivée des `IntegrityIssue` (feature 017).

### MigrationPlan (updated — relation added)

```prisma
model MigrationPlan {
  // ... existing fields from 001 data-model ...
  objectAutoLinkedAt    DateTime?     // FR-004: set once by auto-link, gates re-triggering

  // Relations (added by this feature)
  objectMappings        ObjectMapping[]  // onDelete: Cascade
}
```

## Field Descriptions

### ObjectMapping

| Field | Type | Description |
|-------|------|-------------|
| `id` | `String (uuid)` | Unique identifier for the object mapping. |
| `planId` | `String` | FK to the parent MigrationPlan. Cascade-deleted with the plan. |
| `sourceObjectName` | `String` | apiName of the source object (e.g., "Account", "Contact"). Matches `SchemaObject.apiName` from the source snapshot. |
| `destinationObjectName` | `String` | apiName of the destination object (e.g., "Company", "Contact"). Matches `SchemaObject.apiName` from the destination snapshot. |
| `autoCreated` | `Boolean` | Whether this mapping was created by auto-link (true) or manually by the consultant (false). Informational only — both types are treated identically for deletion and editing. |
| `fieldAutoMatchedAt` | `DateTime?` | Timestamp of when field-level auto-match ran for this object mapping. Set exactly once by feature 012. When non-null, auto-match will not re-fire (Principle IX). |

> Note: `ObjectMapping` has no `createdAt`/`updatedAt` columns and no `status` column. Broken-ness is derived from `IntegrityIssue` records (feature 017), not stored on the mapping itself.

## TypeScript Types

### ObjectMapping (API/service layer)

```typescript
interface ObjectMappingRow {
  id: string
  planId: string
  sourceObjectName: string
  destinationObjectName: string
  autoCreated: boolean
  fieldAutoMatchedAt: string | null  // ISO datetime string
}
```

### PredictablePair (auto-link registry)

```typescript
interface PredictablePair {
  sourceObjectApiName: string
  destObjectApiName: string
}
```

### ObjectMappingWithStats (detail modal)

```typescript
interface ObjectMappingWithStats {
  id: string
  sourceObjectName: string
  destinationObjectName: string
  autoCreated: boolean
  /** Total source fields for this object */
  totalSourceFields: number
  /** Number of fields already mapped */
  mappedFieldCount: number
  /** Number of fields with validated migration logic */
  validatedFieldCount: number
  /** Number of migration filters on this object mapping */
  filterCount: number
  /** Record count for the source object (fetched on-demand) */
  sourceRecordCount: number
  /** Record count for the destination object (fetched on-demand) */
  destRecordCount: number
}
```

### AutoLinkResult

```typescript
interface AutoLinkResult {
  createdMappings: ObjectMappingRow[]
  skippedPairs: { source: string; dest: string; reason: string }[]
  alreadyLinkedAt: string | null  // non-null if auto-link was already run
}
```

## Relationships

```
MigrationPlan (1) ──► (N) ObjectMapping     (cascade delete)
ObjectMapping (1) ──► (N) FieldMapping      (cascade delete — defined by 012)
ObjectMapping (1) ──► (N) MigrationFilter   (cascade delete — defined by 015)
ObjectMapping (1) ──► (N) FieldExclusion    (cascade delete — defined by 016)
```

## Constraints

- `@@unique([planId, sourceObjectName, destinationObjectName])` prevents duplicate pairs within a plan (FR-006).
- `sourceObjectName` and `destinationObjectName` are NOT foreign keys to `SchemaObject`. They store the apiName string. This allows mappings to survive schema refreshes (the mapping references names, not IDs). If the referenced object is removed from the schema, IntegrityIssue records mark it as broken (feature 017) rather than cascade-deleting the mapping.
- `fieldAutoMatchedAt` is null by default. Set once by feature 012 and never cleared.
- `autoCreated` is informational only. Auto-created and manual links are treated identically for all operations except audit trail logging (which records the creation method).
- No `status` column: the broken-ness of a mapping is computed from `IntegrityIssue` records (feature 017).

## Indexes

- `@@unique([planId, sourceObjectName, destinationObjectName])` — also serves as a lookup index for plan mappings.

## Cascade Rules

| Trigger | Action |
|---------|--------|
| Delete `MigrationPlan` | All `ObjectMapping` cascade-deleted |
| Delete `ObjectMapping` | All `FieldMapping` cascade-deleted (which cascades to MigrationLogic, ValueEquivalence, ClassificationPrompt) + all `MigrationFilter` + all `FieldExclusion` cascade-deleted |
| Disconnect source/destination | ObjectMappings remain (orphaned by name). IntegrityIssue records mark them as broken (feature 017). Consultant must resolve manually (Principle IX). |
