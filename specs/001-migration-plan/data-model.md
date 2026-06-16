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
  OBJECT_MAPPING
  FIELD_MAPPING
  DOCUMENTS
}

model MigrationPlan {
  id                      String      @id @default(uuid())
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

  // Relations (defined by downstream features)
  sourceConnection        ConnectorConnection? @relation("SourceConnection", fields: [sourceConnectionId], references: [id])
  destinationConnection   ConnectorConnection? @relation("DestinationConnection", fields: [destinationConnectionId], references: [id])
  objectMappings          ObjectMapping[]       // onDelete: Cascade
  integrityIssues         IntegrityIssue[]      // onDelete: Cascade (defined by 017)
  textDocuments           TextDocument[]        // onDelete: Cascade (defined by 019)
  contractualDocuments    ContractualDocument[] // onDelete: Cascade (defined by 020)
  auditLogs               AuditLog[]
}
```

> Convention : `id = String @id @default(uuid())` — pas de `@@map` (noms de tables PascalCase par défaut).

### AuditLog (FR-006, Constitution Principle VI)

```prisma
model AuditLog {
  id        String          @id @default(uuid())
  planId    String?
  plan      MigrationPlan?  @relation(fields: [planId], references: [id], onDelete: Cascade)

  action    String          // e.g. "PLAN_CREATED", "PLAN_DELETED", "STEP_ADVANCED"
  entity    String          // type of the affected entity (e.g. "MigrationPlan", "ObjectMapping")
  entityId  String?         // ID of the affected entity (nullable for plan-level events)
  details   String          @default("{}") // JSON-serialized context (stored as String, not Json)

  createdAt DateTime        @default(now())
}
```

## Field Descriptions

### MigrationPlan

| Field | Type | Description |
|-------|------|-------------|
| `id` | `String (uuid)` | Unique identifier. Plans are identified by UUID, not name (edge case: duplicate names allowed). |
| `name` | `String` | Plan name, required. No uniqueness constraint. |
| `description` | `String?` | Optional description provided at creation. |
| `status` | `PlanStatus` | Overall plan status: DRAFT (in progress), READY (all steps complete), BROKEN (schema drift broke mappings). |
| `currentStep` | `PlanStep` | Current max step reached in the workflow. Forward-only. Values: SOURCE, DESTINATION, OBJECT_MAPPING, FIELD_MAPPING, DOCUMENTS. |
| `sourceConnectionId` | `String?` | FK to the source ConnectorConnection. Set by feature 002. Nullable until source is connected. @unique. |
| `destinationConnectionId` | `String?` | FK to the destination ConnectorConnection. Set by feature 006. Nullable until destination is connected. @unique. |
| `objectAutoLinkedAt` | `DateTime?` | Timestamp of when auto-link ran for this plan. Set exactly once by feature 011. When non-null, auto-link is gated and will not re-fire (Principle IX). |
| `createdAt` | `DateTime` | Plan creation timestamp. |
| `updatedAt` | `DateTime` | Last modification timestamp. Auto-managed by Prisma. |

### AuditLog

| Field | Type | Description |
|-------|------|-------------|
| `id` | `String (uuid)` | Unique identifier. |
| `planId` | `String?` | FK to the parent plan. Nullable for system-level events. Cascade-deleted with the plan. |
| `action` | `String` | Semantic action name (e.g. `PLAN_CREATED`, `PLAN_DELETED`, `STEP_ADVANCED`, `DRIFT_DETECTED`). |
| `entity` | `String` | Type of the affected entity (e.g. `MigrationPlan`, `ObjectMapping`). Note: field is named `entity`, not `entityType`. |
| `entityId` | `String?` | ID of the affected entity. Nullable for plan-level events. |
| `details` | `String` | JSON-serialized context payload (stored as String, default `"{}"`). Contains old/new values, error info, drift summary, etc. |
| `createdAt` | `DateTime` | Event timestamp. |

## Relationships

```
MigrationPlan (1) ──► (N) AuditLog              (cascade delete)
MigrationPlan (1) ──► (0..1) ConnectorConnection (source, via sourceConnectionId)
MigrationPlan (1) ──► (0..1) ConnectorConnection (destination, via destinationConnectionId)
MigrationPlan (1) ──► (N) ObjectMapping          (cascade delete — defined by feature 011)
MigrationPlan (1) ──► (N) IntegrityIssue         (cascade delete — defined by feature 017)
MigrationPlan (1) ──► (N) TextDocument           (cascade delete — defined by feature 019)
MigrationPlan (1) ──► (N) ContractualDocument    (cascade delete — defined by feature 020)
```

## Constraints

- `sourceConnectionId` and `destinationConnectionId` are `@unique` — each connection belongs to exactly one plan.
- `name` has no uniqueness constraint (edge case: duplicate names are allowed, plans are identified by `id`).
- `currentStep` defaults to `SOURCE` — new plans always start at the first step.
- `status` defaults to `DRAFT` — new plans are always in draft state.
- `objectAutoLinkedAt` is null by default — set once and never cleared.
- Cascade delete on `AuditLog.planId` ensures audit entries are removed when a plan is deleted (per FR-003).

## Indexes

AuditLog has no explicit `@@index` declarations in the implemented schema. Queries are done via `planId` through the Prisma relation.
