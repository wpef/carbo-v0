# Data Model: Field Mapping

## Prisma Schema

### FieldMapping (FR-004, FR-005, FR-006, FR-011)

```prisma
enum CompatibilityStatus {
  COMPATIBLE
  WARNING
  INCOMPATIBLE
}

model FieldMapping {
  id                   String              @id @default(uuid())
  objectMappingId      String
  sourceFieldName      String                    // apiName of the source field
  destinationFieldName String                    // apiName of the destination field
  sourceFieldType      String              @default("") // raw dataType from source connector
  destinationFieldType String              @default("") // raw dataType from destination connector
  compatibilityStatus  CompatibilityStatus @default(COMPATIBLE) // computed at creation from type matrix
  autoCreated          Boolean             @default(false) // true if created by auto-match (FR-006)

  // Relations
  objectMapping  ObjectMapping   @relation(fields: [objectMappingId], references: [id], onDelete: Cascade)
  migrationLogic MigrationLogic?  // 0..1, defined by 013 (onDelete: Cascade)

  @@unique([objectMappingId, sourceFieldName])      // FR-005: one source field per object mapping
  @@unique([objectMappingId, destinationFieldName])  // FR-005: one destination per object mapping
}
```

> Convention : `id = String @id @default(uuid())` — pas de `@@map`. Pas de `createdAt`/`updatedAt` sur `FieldMapping`.
> `linkStatus` (5 états : GREEN/ORANGE/RED_SOLID/RED_DASHED/BROKEN) est **calculé** côté service via `computeLinkStatus()`, il n'est **pas stocké** en base.

### ObjectMapping (updated — relation added from 011)

```prisma
model ObjectMapping {
  // ... existing fields from 011 data-model ...
  fieldAutoMatchedAt    DateTime?  // FR-006: set once by auto-match, gates re-triggering

  // Relations (added/updated by this feature)
  fieldMappings         FieldMapping[]  // onDelete: Cascade
}
```

## Field Descriptions

### FieldMapping

| Field | Type | Description |
|-------|------|-------------|
| `id` | `String (uuid)` | Unique identifier for the field mapping. |
| `objectMappingId` | `String` | FK to the parent ObjectMapping. Cascade-deleted with the object mapping. |
| `sourceFieldName` | `String` | apiName of the source field (e.g., "FirstName", "Email"). Matches `ObjectField.apiName` from the source snapshot. |
| `destinationFieldName` | `String` | apiName of the destination field (e.g., "firstname", "email"). Matches `ObjectField.apiName` from the destination snapshot. |
| `sourceFieldType` | `String` | Raw dataType from the source connector (e.g., "string", "picklist", "double"). Preserved as-is for display and audit. Defaults to `""` if not yet resolved. |
| `destinationFieldType` | `String` | Raw dataType from the destination connector. Preserved as-is. Defaults to `""` if not yet resolved. |
| `compatibilityStatus` | `CompatibilityStatus` | Computed at creation time from the type compatibility matrix. COMPATIBLE (direct copy), WARNING (needs migration logic), INCOMPATIBLE (types cannot be linked). Default: COMPATIBLE. |
| `autoCreated` | `Boolean` | Whether this mapping was created by auto-match (true) or manually (false). Informational only. |

> Note: `FieldMapping` has no `createdAt`/`updatedAt` columns.
> `linkStatus` is **not stored**. It is computed by `computeLinkStatus()` in the service layer and returned in enriched API responses as `FieldMappingWithStatus.linkStatus`.

## TypeScript Types

### FieldMappingRow

```typescript
interface FieldMappingRow {
  id: string
  objectMappingId: string
  sourceFieldName: string
  destinationFieldName: string
  sourceFieldType: string
  destinationFieldType: string
  compatibilityStatus: 'COMPATIBLE' | 'WARNING' | 'INCOMPATIBLE'
  autoCreated: boolean
}
```

### LinkStatus

```typescript
enum LinkStatus {
  GREEN = 'GREEN',           // logic validated
  ORANGE = 'ORANGE',         // logic defined, not validated
  RED_SOLID = 'RED_SOLID',   // no logic defined
  RED_DASHED = 'RED_DASHED', // incompatible types
  BROKEN = 'BROKEN',         // field/object absent from current schema
}
```

**Precedence** (highest to lowest): `BROKEN > RED_DASHED > RED_SOLID > ORANGE > GREEN`

### FieldMappingWithStatus

```typescript
interface FieldMappingWithStatus extends FieldMappingRow {
  /** Computed link status (not stored) */
  linkStatus: LinkStatus
  /** Whether migration logic exists for this mapping */
  hasLogic: boolean
  /** Whether migration logic is validated */
  isLogicValidated: boolean
  /** Section type for migration logic modal (D1/D2/D3/D4) */
  logicSectionType: 'VALUE_EQUIVALENCE' | 'PROMPT' | 'ERROR' | 'INFORMATIONAL' | null
  /** Drift flag (orthogonal to linkStatus, from PlanDriftContext) */
  driftFlag: DriftFlag | null
}
```

### DriftFlag

```typescript
interface DriftFlag {
  typeId: string             // e.g., 'FIELD_TYPE_CHANGED', 'FIELD_BECAME_REQUIRED'
  severity: 'info' | 'warning' | 'critical'
  label: string              // e.g., "Type modifie", "Desormais obligatoire"
  tooltip: string            // e.g., "string -> number"
  side: 'source' | 'destination'
}
```

### CompatibilityMatrix

```typescript
type NormalizedType = 'text' | 'number' | 'date' | 'picklist' | 'boolean'

interface CompatibilityEntry {
  status: 'COMPATIBLE' | 'WARNING' | 'INCOMPATIBLE'
}

type CompatibilityMatrix = Record<NormalizedType, Record<NormalizedType, CompatibilityEntry>>
```

### AutoMatchResult

```typescript
interface AutoMatchResult {
  createdMappings: FieldMappingRow[]
  skippedFields: { source: string; dest: string; reason: string }[]
  alreadyMatchedAt: string | null  // non-null if auto-match already ran (no-op)
}
```

### NativeFieldPair

```typescript
interface NativeFieldPair {
  sourceFieldApiName: string
  destFieldApiName: string
}
```

### UnmappedField

```typescript
interface UnmappedField {
  apiName: string
  label: string
  dataType: string
  isRequired: boolean
  isReadOnly: boolean
}
```

### MigrationPreviewRecord

```typescript
interface MigrationPreviewRecord {
  recordId: string
  label: string              // auto-generated from first text values
  fields: {
    sourceFieldName: string
    sourceValue: unknown
    destFieldName: string
    destValue: unknown        // transformed value (via equivalences) or raw pass-through
    isTransformed: boolean    // true if value was changed by an equivalence rule
  }[]
}
```

## Relationships

```
ObjectMapping (1) ──► (N) FieldMapping      (cascade delete)
FieldMapping  (1) ──► (0..1) MigrationLogic (cascade delete — defined by 013)
```

## Constraints

- `@@unique([objectMappingId, sourceFieldName])` enforces one destination per source field within an object mapping (FR-005).
- `@@unique([objectMappingId, destinationFieldName])` enforces one source per destination field within an object mapping (FR-005).
- The same source field CAN appear in different object mappings (e.g., `Email` mapped in both Contact->Contact and Contact->Lead object mappings).
- `sourceFieldName` and `destinationFieldName` are NOT foreign keys to `ObjectField`. They store the apiName string. If the referenced field disappears after a schema refresh, `linkStatus` becomes `BROKEN` rather than cascade-deleting the mapping (Principle IX).
- `compatibilityStatus` is set at creation time and re-evaluated on schema refresh if field types change.

## Type Normalization

The mapping from raw connector types to the 5 canonical categories:

```typescript
const TYPE_NORMALIZATION: Record<string, NormalizedType> = {
  // Salesforce
  string: 'text', textarea: 'text', url: 'text', email: 'text',
  phone: 'text', id: 'text', reference: 'text', address: 'text',
  encryptedstring: 'text',
  int: 'number', double: 'number', currency: 'number',
  percent: 'number', long: 'number',
  date: 'date', datetime: 'date', time: 'date',
  picklist: 'picklist', multipicklist: 'picklist', combobox: 'picklist',
  boolean: 'boolean',

  // HubSpot
  number: 'number',
  enumeration: 'picklist',
  bool: 'boolean',

  // Fallback: unknown types default to 'text'
}
```

## Indexes

- `@@unique([objectMappingId, sourceFieldName])` — also serves as a lookup index.
- `@@unique([objectMappingId, destinationFieldName])` — also serves as a lookup index.

## Cascade Rules

| Trigger | Action |
|---------|--------|
| Delete `ObjectMapping` | All `FieldMapping` cascade-deleted (which cascades to MigrationLogic, ValueEquivalence, ClassificationPrompt) |
| Delete `FieldMapping` | `MigrationLogic` cascade-deleted (defined by 013) |
| Schema refresh removes a field | FieldMapping remains. `linkStatus` becomes BROKEN. Consultant must delete or remap manually (Principle IX). |
| Schema refresh changes field type | `compatibilityStatus` re-evaluated. If now INCOMPATIBLE and logic exists, `linkStatus` becomes BROKEN. Otherwise drift flag shown. |
