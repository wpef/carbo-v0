# Data Model: Source Connection

## Overview

Feature 002 does not create new entities. It operates on `ConnectorConnection` (persisted via Prisma, linked from `MigrationPlan.sourceConnectionId`) and `SchemaSnapshot` (owned by 003 but written at connection/refresh time). This document defines the Prisma schema additions and the TypeScript types used by the feature's service layer.

## Prisma Schema

### ConnectorConnection

```prisma
model ConnectorConnection {
  id          String           @id @default(uuid())
  adapterType String                                // e.g. "salesforce", "hubspot", "demo"
  name        String                                // display name of the connection
  status      ConnectionStatus @default(CONNECTED)
  config      String           @default("{}")       // non-secret config as JSON string
  secretsRef  String?                               // reference to encrypted secrets store (not inline)
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt

  // Reverse relations (each plan can have at most one source and one destination connection — @unique FKs)
  sourcePlan      MigrationPlan? @relation("SourceConnection")
  destinationPlan MigrationPlan? @relation("DestinationConnection")
  schemaSnapshots SchemaSnapshot[]
}

enum ConnectionStatus {
  CONNECTED
  EXPIRED
  ERROR
}
```

> Note: `PENDING` was removed from `ConnectionStatus` — the code only persists a connection after it is confirmed as `CONNECTED`. No pending state is stored in the database.

### MigrationPlan (relevant fields)

```prisma
model MigrationPlan {
  id                      String     @id @default(uuid())
  name                    String
  description             String?
  status                  PlanStatus @default(DRAFT)
  currentStep             PlanStep   @default(SOURCE)
  sourceConnectionId      String?    @unique
  destinationConnectionId String?    @unique
  objectAutoLinkedAt      DateTime?
  createdAt               DateTime   @default(now())
  updatedAt               DateTime   @updatedAt

  sourceConnection      ConnectorConnection? @relation("SourceConnection", fields: [sourceConnectionId], references: [id])
  destinationConnection ConnectorConnection? @relation("DestinationConnection", fields: [destinationConnectionId], references: [id])
  // ... other relations (objectMappings, integrityIssues, textDocuments, contractualDocuments, auditLogs)
}

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
```

> Convention: `id = String @id @default(uuid())` throughout the schema (not `cuid()`). No `@@map` directives — table names are PascalCase (Prisma default).

### SchemaSnapshot (owned by 003, written by 002)

```prisma
model SchemaSnapshot {
  id           String         @id @default(uuid())
  connectionId String
  side         SnapshotSide                         // SOURCE or DESTINATION
  status       SnapshotStatus @default(CURRENT)     // CURRENT or PREVIOUS
  fetchedAt    DateTime       @default(now())

  connection   ConnectorConnection @relation(fields: [connectionId], references: [id], onDelete: Cascade)
  objects      SchemaObject[]

  @@unique([connectionId, side, status])            // at most one CURRENT and one PREVIOUS per connection+side
}

enum SnapshotSide {
  SOURCE
  DESTINATION
}

enum SnapshotStatus {
  CURRENT
  PREVIOUS
}
```

> The schema is **normalised**: objects are persisted as `SchemaObject` rows (not stored as a `data Json` blob). `objectCount` is computed at query time from the objects relation.

## TypeScript Types (service layer)

### SchemaDiffResult (extends 000 FR-008)

```typescript
/** Output of computeSchemaDiff(). Extends the 000 interface with field-level detail. */
interface SchemaDiffResult {
  addedObjects: string[]
  removedObjects: string[]
  addedFields: Record<string, string[]>       // objectApiName -> fieldApiNames
  removedFields: Record<string, string[]>     // objectApiName -> fieldApiNames
  typeChangedFields: TypeChangedField[]
}

interface TypeChangedField {
  objectApiName: string
  fieldApiName: string
  oldNormalizedType: string
  newNormalizedType: string
}
```

### ImpactReport

```typescript
/** Output of computeImpactReport(). Used by the confirmation dialog (FR-011). */
interface ImpactReport {
  objectMappingsToDelete: { id: string; sourceObjectName: string; destObjectName: string }[]
  fieldMappingsToDelete: { id: string; sourceFieldName: string; destFieldName: string; objectMappingId: string }[]
  fieldMappingsToBreak: { id: string; sourceFieldName: string; reason: string }[]
  rulesToDelete: { id: string; name: string; referencedField: string }[]
  rulesToFlag: { id: string; name: string; reason: string }[]
  filtersToDelete: { id: string; fieldApiName: string }[]
  documentsToOutdate: { id: string; title: string }[]
  suggestedStepRollback: PlanStep | null
  isEmpty: boolean
}
```

### ReconfigurationPayload

```typescript
/** Input to the reconfigure/apply endpoint. */
interface ReconfigurationPayload {
  adapterType: string
  config: Record<string, unknown>
  /** New schema already fetched during preview step. */
  newSchemaSnapshot: ConnectorSchema
  /** Client confirms they accept the impact. */
  confirmedImpact: boolean
}
```

## Relationships

```
MigrationPlan (1) ──► (0..1) ConnectorConnection  [sourceConnectionId @unique]
MigrationPlan (1) ──► (0..1) ConnectorConnection  [destinationConnectionId @unique]
ConnectorConnection (1) ──► (0..2) SchemaSnapshot  [CURRENT + PREVIOUS, per side]
SchemaSnapshot      (1) ──► (N)    SchemaObject
```

## Cascade Rules

| Trigger | Action |
|---------|--------|
| Disconnect source | Delete `SchemaSnapshot` where connectionId + side=SOURCE; set `MigrationPlan.sourceConnectionId = null`; cascade-delete downstream selections |
| Reconfiguration (confirmed) | Rotate snapshots (old CURRENT → PREVIOUS, new objects inserted as CURRENT); delete/flag mappings per impact report; update `MigrationPlan.currentStep` per FR-015 |
| Delete `ConnectorConnection` | `SchemaSnapshot` cascade-deleted (Prisma `onDelete: Cascade`) |
| Delete `MigrationPlan` | `ConnectorConnection` FK set null (not deleted — connection may be reusable) |
