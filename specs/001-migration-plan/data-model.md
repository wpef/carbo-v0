# Data Model: Migration Plan

## Prisma Schema

### MigrationPlan

The top-level container for an entire migration project.

```prisma
model MigrationPlan {
  id                     String    @id @default(uuid())
  name                   String
  description            String?
  status                 String    @default("DRAFT")  // DRAFT | READY | BROKEN
  currentStep            String    @default("SOURCE_CONNECTION")
  sourceConnectionId     String?
  destinationConnectionId String?
  objectAutoLinkedAt     DateTime?  // Set once when 011 auto-link runs; gates re-triggering (Principle IX)
  createdAt              DateTime  @default(now())
  updatedAt              DateTime  @updatedAt

  auditLogs              AuditLog[]
}
```

**Fields**:
- `id`: UUID primary key
- `name`: Plan name (required, not unique — duplicates allowed per spec)
- `description`: Optional text description
- `status`: DRAFT (in progress), READY (pre-Run steps complete), BROKEN (schema change broke mappings)
- `currentStep`: Tracks progress — one of: SOURCE_CONNECTION, OBJECT_SELECTION, DESTINATION_CONNECTION, MAPPING, DOCUMENTS, RUN
- `sourceConnectionId`: Nullable FK to future connection entity (set by feature 002)
- `destinationConnectionId`: Nullable FK to future connection entity (set by feature 006)
- `objectAutoLinkedAt`: Nullable timestamp set exactly once when feature 011's auto-link runs for this plan. Acts as a persistent guard so re-opening the Object Mapping page never re-triggers auto-link, even if the consultant has manually deleted every ObjectMapping (Principle IX — auto-link is a one-shot bootstrap, not a recurring assist).
- `createdAt`, `updatedAt`: Timestamps

### AuditLog

Persistent audit trail for all significant operations (Constitution Principle VI).

```prisma
model AuditLog {
  id        String   @id @default(uuid())
  planId    String?
  action    String
  details   String?  // JSON string for structured data
  createdAt DateTime @default(now())

  plan      MigrationPlan? @relation(fields: [planId], references: [id], onDelete: Cascade)
}
```

**Fields**:
- `id`: UUID primary key
- `planId`: Nullable FK to MigrationPlan (nullable for system-level events)
- `action`: Action identifier (e.g., "PLAN_CREATED", "PLAN_DELETED", "CONNECTION_ESTABLISHED")
- `details`: JSON string with additional context (e.g., plan name, error messages)
- `createdAt`: Timestamp

## Relationships

```
MigrationPlan 1 --- * AuditLog (cascade delete)
```

When a plan is deleted, all its audit logs are cascade-deleted.

## Step Constants (not in DB)

The step workflow is a UI concern. Steps are defined as a constant array:

```typescript
export const PLAN_STEPS = [
  { id: 'SOURCE_CONNECTION', label: 'Source Connection', order: 1 },
  { id: 'OBJECT_SELECTION', label: 'Object Selection', order: 2 },
  { id: 'DESTINATION_CONNECTION', label: 'Destination Connection', order: 3 },
  { id: 'MAPPING', label: 'Object & Field Mapping', order: 4 },
  { id: 'DOCUMENTS', label: 'Documents', order: 5 },
  { id: 'RUN', label: 'Run Migration', order: 6 },
] as const;
```

## Future Extensions

Features 002-008 will add related entities (Connection, SchemaSnapshot, ObjectSelection, FieldMapping, etc.) that reference `MigrationPlan.id` as a foreign key. The cascade delete on the plan ensures all related data is cleaned up.
