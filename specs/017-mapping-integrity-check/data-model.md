# Data Model: Mapping Integrity Check

## Prisma Schema

### IntegrityIssue (FR-001 through FR-011)

```prisma
enum IntegrityEntityType {
  OBJECT_MAPPING
  FIELD_MAPPING
  MIGRATION_LOGIC
  MIGRATION_FILTER
}

enum IntegrityIssueType {
  UNMAPPED_REQUIRED_FIELD
  INCOMPATIBLE_TYPE
  MISSING_LOGIC
  INVALID_FILTER
  BROKEN_REFERENCE
  MISSING_EQUIVALENCE
}

model IntegrityIssue {
  id         String              @id @default(uuid())
  planId     String
  entityType IntegrityEntityType
  entityId   String
  issueType  IntegrityIssueType
  severity   String              @default("ERROR")
  message    String
  resolved   Boolean             @default(false)
  resolvedAt DateTime?
  createdAt  DateTime            @default(now())

  plan MigrationPlan @relation(fields: [planId], references: [id], onDelete: Cascade)

  @@unique([planId, entityType, entityId, issueType])
}
```

### IntegrityIssueType taxonomy

| Value | Detected on | Meaning |
|---|---|---|
| `BROKEN_REFERENCE` | OBJECT_MAPPING, FIELD_MAPPING | Source or destination object/field no longer exists in the CURRENT snapshot |
| `UNMAPPED_REQUIRED_FIELD` | OBJECT_MAPPING | A required (non-read-only) destination field has no FieldMapping |
| `INCOMPATIBLE_TYPE` | FIELD_MAPPING | Current field types are INCOMPATIBLE per the 012 type-compatibility matrix |
| `INVALID_FILTER` | MIGRATION_FILTER | Filter references a source field no longer present in the CURRENT snapshot |
| `MISSING_LOGIC` | FIELD_MAPPING | (Reserved — not yet emitted by the engine) |
| `MISSING_EQUIVALENCE` | MIGRATION_LOGIC | (Reserved — not yet emitted by the engine) |

### MigrationPlan Extension (status transition)

The existing `MigrationPlan` model (001 data-model) already includes `PlanStatus.BROKEN`. No schema change needed. The `checkAndUpdatePlanStatus(planId)` function calls `checkIntegrity(planId)` after every CRUD on ObjectMapping or FieldMapping and updates `MigrationPlan.status`:

```prisma
// Already defined in 001:
// enum PlanStatus { DRAFT  READY  BROKEN }
//
// checkAndUpdatePlanStatus:
//   - Sets status = BROKEN when unresolvedIssues > 0
//   - Sets status = READY if unresolvedIssues = 0 AND currentStep = DOCUMENTS AND previous status was READY
//   - Sets status = DRAFT otherwise
```

## Field Descriptions

### IntegrityIssue

| Field | Type | Description |
|-------|------|-------------|
| `id` | `String (uuid)` | Unique identifier. |
| `planId` | `String` | FK to the parent migration plan. Cascade-deleted with the plan. |
| `entityType` | `IntegrityEntityType` | Which kind of entity is affected: OBJECT_MAPPING, FIELD_MAPPING, MIGRATION_LOGIC, or MIGRATION_FILTER. |
| `entityId` | `String` | ID of the specific affected entity. Polymorphic — no Prisma relation defined (references multiple tables). |
| `issueType` | `IntegrityIssueType` | Classification of the issue. |
| `severity` | `String` | "ERROR" or "WARNING". Defaults to "ERROR". |
| `message` | `String` | Human-readable description (e.g., `Source object "Contact" no longer exists in the current schema`). |
| `resolved` | `Boolean` | `false` = active issue; `true` = resolved (manually or auto-resolved). |
| `resolvedAt` | `DateTime?` | Timestamp when the issue was resolved. Null means still active. |
| `createdAt` | `DateTime` | When the issue was first detected. |

## Relationships

```
MigrationPlan (1) ──► (N) IntegrityIssue     (cascade delete)
IntegrityIssue      ──► (1) ObjectMapping     (via entityId, when entityType = OBJECT_MAPPING)
IntegrityIssue      ──► (1) FieldMapping      (via entityId, when entityType = FIELD_MAPPING)
IntegrityIssue      ──► (1) MigrationFilter   (via entityId, when entityType = MIGRATION_FILTER)
IntegrityIssue      ──► (1) MigrationLogic    (via entityId, when entityType = MIGRATION_LOGIC)
```

Note: `entityId` is polymorphic — Prisma does not declare a typed relation on it; service code queries each table manually by entityType.

## Constraints

- `@@unique([planId, entityType, entityId, issueType])` prevents duplicate issues. Re-running the check upserts (idempotent): existing unresolved issues are updated in-place; newly absent issues are auto-resolved.
- `resolved` + `resolvedAt` together mark resolution. `resolved = false` means active. Auto-resolution sets `resolved = true, resolvedAt = NOW()`.
- Cascade delete on `planId` ensures issues are cleaned up when a plan is deleted.
- No explicit `@@index` directives in the implemented schema beyond the unique constraint.

## DTOs

### IntegrityCheckResult

```typescript
interface IntegrityCheckResult {
  planId: string
  planStatus: 'DRAFT' | 'READY' | 'BROKEN'
  checkedAt: string               // ISO 8601
  totalIssues: number             // All issues (resolved + unresolved)
  unresolvedIssues: number        // Only unresolved
  issues: IntegrityIssueDTO[]     // All currently unresolved issues
}
```

### IntegrityIssueDTO

```typescript
interface IntegrityIssueDTO {
  id: string
  entityType: 'OBJECT_MAPPING' | 'FIELD_MAPPING' | 'MIGRATION_LOGIC' | 'MIGRATION_FILTER'
  entityId: string
  issueType:
    | 'UNMAPPED_REQUIRED_FIELD'
    | 'INCOMPATIBLE_TYPE'
    | 'MISSING_LOGIC'
    | 'INVALID_FILTER'
    | 'BROKEN_REFERENCE'
    | 'MISSING_EQUIVALENCE'
  severity: string        // "ERROR" or "WARNING"
  message: string         // Human-readable description
  resolved: boolean
  resolvedAt: string | null
  detectedAt: string      // ISO 8601 (maps to IntegrityIssue.createdAt)
}
```

### RepairResult

```typescript
interface RepairResult {
  deletedObjectMappings: number
  deletedFieldMappings: number
  planStatus: 'DRAFT' | 'READY' | 'BROKEN'
}
```
