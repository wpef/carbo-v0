# Data Model: Source Connection

## Overview

Feature 002 does not create new entities. It operates on `ConnectorConnection` (persisted via Prisma, linked from `MigrationPlan.sourceConnectionId`) and `SchemaSnapshot` (owned by 003 but written at connection/refresh time). This document defines the Prisma schema additions and the TypeScript types used by the feature's service layer.

## Prisma Schema

### ConnectorConnection

```prisma
model ConnectorConnection {
  id          String   @id @default(cuid())
  adapterType String                          // e.g. "salesforce", "hubspot", "demo"
  status      ConnectionStatus @default(PENDING)
  config      Json     @default("{}")         // non-secret config (instanceUrl, sandbox flag, etc.)
  secretsRef  String?                         // reference to encrypted secrets store (not inline)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Reverse relations
  sourcePlans      MigrationPlan[] @relation("SourceConnection")
  destinationPlans MigrationPlan[] @relation("DestinationConnection")
  schemaSnapshots  SchemaSnapshot[]
}

enum ConnectionStatus {
  PENDING
  CONNECTED
  EXPIRED
  ERROR
}
```

### MigrationPlan (relevant fields)

```prisma
model MigrationPlan {
  id                     String    @id @default(cuid())
  name                   String
  description            String?
  status                 PlanStatus @default(DRAFT)
  currentStep            PlanStep   @default(SOURCE)
  sourceConnectionId     String?
  destinationConnectionId String?
  objectAutoLinkedAt     DateTime?
  createdAt              DateTime  @default(now())
  updatedAt              DateTime  @updatedAt

  sourceConnection      ConnectorConnection? @relation("SourceConnection", fields: [sourceConnectionId], references: [id], onDelete: SetNull)
  destinationConnection ConnectorConnection? @relation("DestinationConnection", fields: [destinationConnectionId], references: [id], onDelete: SetNull)
  // ... other relations (objectMappings, fieldMappings, etc.)
}

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
```

### SchemaSnapshot (owned by 003, written by 002)

```prisma
model SchemaSnapshot {
  id           String   @id @default(cuid())
  connectionId String
  side         SnapshotSide            // SOURCE or DESTINATION
  data         Json                    // Full ConnectorSchema as JSON
  fetchedAt    DateTime @default(now())

  connection   ConnectorConnection @relation(fields: [connectionId], references: [id], onDelete: Cascade)

  @@unique([connectionId, side])
}

enum SnapshotSide {
  SOURCE
  DESTINATION
}
```

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
MigrationPlan (1) ──► (0..1) ConnectorConnection  [sourceConnectionId]
MigrationPlan (1) ──► (0..1) ConnectorConnection  [destinationConnectionId]
ConnectorConnection (1) ──► (0..1) SchemaSnapshot  [per side, unique constraint]
```

## Cascade Rules

| Trigger | Action |
|---------|--------|
| Disconnect source | Delete `SchemaSnapshot` where connectionId + side=SOURCE; set `MigrationPlan.sourceConnectionId = null`; cascade-delete downstream selections |
| Reconfiguration (confirmed) | Replace `SchemaSnapshot.data`; delete/flag mappings per impact report; update `MigrationPlan.currentStep` per FR-015 |
| Delete `ConnectorConnection` | `SchemaSnapshot` cascade-deleted (Prisma `onDelete: Cascade`) |
| Delete `MigrationPlan` | `ConnectorConnection` set null (not deleted -- connection may be reusable) |
