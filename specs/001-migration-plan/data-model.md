# Data Model: Migration Plan

## Prisma Schema

### MigrationPlan (FR-001, FR-002, FR-004, FR-005)

```prisma
enum PlanStatus {
  DRAFT
  READY
  BROKEN
}

enum PlanStep {
  SOURCE
  DESTINATION
  MAPPING
  FIELD_MAPPING
  DOCUMENTS
}

model MigrationPlan {
  id                      String      @id @default(cuid())
  name                    String
  description             String?
  status                  PlanStatus  @default(DRAFT)
  currentStep             PlanStep    @default(SOURCE)

  // Connection FKs (nullable — set by features 002 and 006)
  sourceConnectionId      String?     @unique
  destinationConnectionId String?     @unique

  // Auto-link gate (Principle IX — set once by feature 011)
  objectAutoLinkedAt      DateTime?

  createdAt               DateTime    @default(now())
  updatedAt               DateTime    @updatedAt

  // Relations (defined by downstream features, listed here for cascade awareness)
  // sourceConnection      Connection?  @relation("SourcePlan", fields: [sourceConnectionId], references: [id], onDelete: SetNull)
  // destinationConnection Connection?  @relation("DestPlan", fields: [destinationConnectionId], references: [id], onDelete: SetNull)
  // objectMappings        ObjectMapping[]   // onDelete: Cascade
  // fieldMappings         FieldMapping[]    // onDelete: Cascade (via ObjectMapping)
  // documents             Document[]        // onDelete: Cascade
  auditLogs               AuditLog[]

  @@map("migration_plans")
}
```

### AuditLog (FR-006, Constitution Principle VI)

```prisma
model AuditLog {
  id          String          @id @default(cuid())
  planId      String?
  plan        MigrationPlan?  @relation(fields: [planId], references: [id], onDelete: Cascade)

  action      String          // e.g. "PLAN_CREATED", "PLAN_DELETED", "STEP_ADVANCED"
  entityType  String          // e.g. "MigrationPlan", "Connection", "ObjectMapping"
  entityId    String          // ID of the affected entity
  details     Json?           // Arbitrary context (old values, new values, error details)

  createdAt   DateTime        @default(now())

  @@index([planId])
  @@index([entityType, entityId])
  @@index([createdAt])
  @@map("audit_logs")
}
```

## Field Descriptions

### MigrationPlan

| Field | Type | Description |
|-------|------|-------------|
| `id` | `String (cuid)` | Unique identifier. Plans are identified by UUID, not name (edge case: duplicate names allowed). |
| `name` | `String` | Plan name, required. No uniqueness constraint. |
| `description` | `String?` | Optional description provided at creation. |
| `status` | `PlanStatus` | Overall plan status: DRAFT (in progress), READY (all steps complete), BROKEN (schema drift broke mappings). |
| `currentStep` | `PlanStep` | Current max step reached in the workflow. Forward-only. |
| `sourceConnectionId` | `String?` | FK to the source connection. Set by feature 002. Nullable until source is connected. |
| `destinationConnectionId` | `String?` | FK to the destination connection. Set by feature 006. Nullable until destination is connected. |
| `objectAutoLinkedAt` | `DateTime?` | Timestamp of when auto-link ran for this plan. Set exactly once by feature 011. When non-null, auto-link is gated and will not re-fire (Principle IX). |
| `createdAt` | `DateTime` | Plan creation timestamp. |
| `updatedAt` | `DateTime` | Last modification timestamp. Auto-managed by Prisma. |

### AuditLog

| Field | Type | Description |
|-------|------|-------------|
| `id` | `String (cuid)` | Unique identifier. |
| `planId` | `String?` | FK to the parent plan. Nullable for system-level events. Cascade-deleted with the plan. |
| `action` | `String` | Semantic action name (e.g. `PLAN_CREATED`, `PLAN_DELETED`, `STEP_ADVANCED`, `DRIFT_DETECTED`). |
| `entityType` | `String` | Type of the affected entity (e.g. `MigrationPlan`, `Connection`). |
| `entityId` | `String` | ID of the affected entity. |
| `details` | `Json?` | Arbitrary JSON payload with context-specific data (old/new values, error info, drift summary). |
| `createdAt` | `DateTime` | Event timestamp. |

## Relationships

```
MigrationPlan (1) ──► (N) AuditLog         (cascade delete)
MigrationPlan (1) ──► (0..1) Connection     (source, via sourceConnectionId)
MigrationPlan (1) ──► (0..1) Connection     (destination, via destinationConnectionId)
MigrationPlan (1) ──► (N) ObjectMapping     (cascade delete — defined by feature 011)
MigrationPlan (1) ──► (N) Document          (cascade delete — defined by feature 019/020)
```

## Constraints

- `sourceConnectionId` and `destinationConnectionId` are `@unique` — each connection belongs to exactly one plan.
- `name` has no uniqueness constraint (edge case: duplicate names are allowed, plans are identified by `id`).
- `currentStep` defaults to `SOURCE` — new plans always start at the first step.
- `status` defaults to `DRAFT` — new plans are always in draft state.
- `objectAutoLinkedAt` is null by default — set once and never cleared.
- Cascade delete on `AuditLog.planId` ensures audit entries are removed when a plan is deleted (per FR-003).

## Indexes

- `AuditLog.planId` — query all events for a plan (document generation, audit trail display).
- `AuditLog(entityType, entityId)` — query events for a specific entity across plans.
- `AuditLog.createdAt` — chronological ordering of events.
