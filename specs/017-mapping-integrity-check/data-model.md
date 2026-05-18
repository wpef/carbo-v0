# Data Model: Mapping Integrity Check

## Prisma Schema

### IntegrityIssue (FR-001 through FR-011)

```prisma
enum IntegrityEntityType {
  OBJECT_MAPPING
  FIELD_MAPPING
  MIGRATION_FILTER
  TRANSFORMATION_RULE
}

enum IntegrityIssueType {
  SOURCE_OBJECT_DELETED
  DESTINATION_OBJECT_DELETED
  SOURCE_FIELD_DELETED
  DESTINATION_PROPERTY_DELETED
  TYPE_CHANGE_INCOMPATIBLE
  REFERENCED_FIELD_DELETED
}

model IntegrityIssue {
  id                String               @id @default(cuid())
  migrationPlanId   String
  migrationPlan     MigrationPlan        @relation(fields: [migrationPlanId], references: [id], onDelete: Cascade)

  entityType        IntegrityEntityType
  entityId          String               // ID of the affected ObjectMapping, FieldMapping, MigrationFilter, or MigrationLogic
  issueType         IntegrityIssueType
  description       String               // Human-readable: "source field 'CustomField__c' deleted"
  context           Json?                // Additional context: { oldType, newType } for TYPE_CHANGE_INCOMPATIBLE

  detectedAt        DateTime             @default(now())
  resolvedAt        DateTime?            // Null = unresolved; set when fixed

  @@unique([migrationPlanId, entityType, entityId, issueType])  // Prevent duplicate issues for same entity+type
  @@index([migrationPlanId])
  @@index([entityId])
  @@index([resolvedAt])
  @@map("integrity_issues")
}
```

### MigrationPlan Extension (status transition)

The existing `MigrationPlan` model (001 data-model) already includes `PlanStatus.BROKEN`. No schema change needed -- the integrity check engine uses the existing status field.

```prisma
// Already defined in 001:
// enum PlanStatus { DRAFT  READY  BROKEN }
//
// The integrity check:
//   - Sets status = BROKEN when unresolved issues exist
//   - Sets status = DRAFT (or READY if all steps complete) when all issues resolved
```

## Field Descriptions

### IntegrityIssue

| Field | Type | Description |
|-------|------|-------------|
| `id` | `String (cuid)` | Unique identifier. |
| `migrationPlanId` | `String` | FK to the parent migration plan. Cascade-deleted with the plan. |
| `entityType` | `IntegrityEntityType` | Which kind of entity is affected: object mapping, field mapping, filter, or rule. |
| `entityId` | `String` | ID of the specific affected entity (ObjectMapping.id, FieldMapping.id, etc.). |
| `issueType` | `IntegrityIssueType` | Classification of the issue. Maps directly to spec FR-002 through FR-008. |
| `description` | `String` | Human-readable description (e.g., "source field 'CustomField__c' deleted", "type change: string to boolean"). |
| `context` | `Json?` | Structured metadata. For TYPE_CHANGE_INCOMPATIBLE: `{ oldType: string, newType: string }`. For deletions: `{ apiName: string, side: "source" \| "destination" }`. |
| `detectedAt` | `DateTime` | When the issue was first detected. Set on creation. |
| `resolvedAt` | `DateTime?` | When the issue was resolved. Null means unresolved. Set by the resolver when the consultant fixes the mapping or a subsequent check no longer detects the issue. |

## Relationships

```
MigrationPlan (1) ──► (N) IntegrityIssue     (cascade delete)
IntegrityIssue      ──► (1) ObjectMapping     (via entityId, when entityType = OBJECT_MAPPING)
IntegrityIssue      ──► (1) FieldMapping      (via entityId, when entityType = FIELD_MAPPING)
IntegrityIssue      ──► (1) MigrationFilter   (via entityId, when entityType = MIGRATION_FILTER)
IntegrityIssue      ──► (1) MigrationLogic    (via entityId, when entityType = TRANSFORMATION_RULE)
```

Note: The `entityId` FK is polymorphic (points to different tables based on `entityType`). This is intentional -- a Prisma relation is not defined on `entityId` because it references multiple tables. Queries join manually when needed.

## Constraints

- The `@@unique([migrationPlanId, entityType, entityId, issueType])` constraint prevents duplicate issues. If the same field mapping is broken for the same reason, re-running the check does not create a second issue -- it finds the existing one and skips creation (idempotent, Principle V).
- `resolvedAt` is the sole marker of resolution. No separate "dismissed" or "acknowledged" states (spec does not distinguish).
- Cascade delete on `migrationPlanId` ensures issues are cleaned up when a plan is deleted.

## Indexes

- `migrationPlanId` -- query all issues for a plan (UI: integrity check results page, plan status computation).
- `entityId` -- query issues for a specific entity (UI: per-mapping broken badge).
- `resolvedAt` -- filter unresolved issues (`WHERE resolvedAt IS NULL`), compute plan status transition.

## DTOs

### IntegrityCheckResult

```typescript
interface IntegrityCheckResult {
  planId: string
  planStatus: 'DRAFT' | 'READY' | 'BROKEN'
  checkedAt: string               // ISO 8601
  totalIssues: number
  unresolvedIssues: number
  issues: IntegrityIssueDTO[]
}
```

### IntegrityIssueDTO

```typescript
interface IntegrityIssueDTO {
  id: string
  entityType: 'OBJECT_MAPPING' | 'FIELD_MAPPING' | 'MIGRATION_FILTER' | 'TRANSFORMATION_RULE'
  entityId: string
  issueType: 'SOURCE_OBJECT_DELETED' | 'DESTINATION_OBJECT_DELETED' | 'SOURCE_FIELD_DELETED' | 'DESTINATION_PROPERTY_DELETED' | 'TYPE_CHANGE_INCOMPATIBLE' | 'REFERENCED_FIELD_DELETED'
  description: string
  context: Record<string, unknown> | null
  detectedAt: string
  resolvedAt: string | null

  // Enriched fields for UI display
  entityLabel: string             // e.g., "Contact → Contacts" for object mapping, "Email → email" for field mapping
  actionRequired: string          // e.g., "Delete this mapping or remap to a valid field"
}
```
