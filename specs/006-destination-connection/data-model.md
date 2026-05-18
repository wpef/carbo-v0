# Data Model: Destination Connection

## Overview

No new entities are introduced. Feature 006 uses the existing `ConnectorConnection` model (defined in feature 000/002) linked to `MigrationPlan` via the `destinationConnectionId` FK. This document describes the relevant Prisma schema and the relationship.

## Prisma Schema

### ConnectorConnection (existing, shared with 002)

```prisma
model ConnectorConnection {
  id          String   @id @default(cuid())
  adapterType String                          // e.g. "hubspot", "demo-destination"
  status      ConnectionStatus @default(PENDING)
  config      Json     @default("{}")         // adapter-specific config (secrets encrypted at rest)
  schemaSnapshot Json?                        // full schema snapshot (ConnectorSchema shape)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Reverse relations
  plansAsSource      MigrationPlan[] @relation("SourceConnection")
  plansAsDestination MigrationPlan[] @relation("DestinationConnection")
}

enum ConnectionStatus {
  PENDING
  CONNECTED
  EXPIRED
  ERROR
}
```

### MigrationPlan (relevant fields only)

```prisma
model MigrationPlan {
  id                      String   @id @default(cuid())
  name                    String
  description             String?
  status                  PlanStatus @default(DRAFT)
  currentStep             PlanStep   @default(SOURCE)

  sourceConnectionId      String?  @unique
  sourceConnection        ConnectorConnection? @relation("SourceConnection", fields: [sourceConnectionId], references: [id])

  destinationConnectionId String?  @unique
  destinationConnection   ConnectorConnection? @relation("DestinationConnection", fields: [destinationConnectionId], references: [id])

  objectAutoLinkedAt      DateTime?
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt
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

## Relationships

```
MigrationPlan (1) ──► (0..1) ConnectorConnection  [as sourceConnection]
MigrationPlan (1) ──► (0..1) ConnectorConnection  [as destinationConnection]

ConnectorConnection (1) ──► (1) SchemaSnapshot     [stored as JSON in schemaSnapshot column]
```

- Each plan has at most one destination connection (1:0..1).
- The `@unique` constraint on `destinationConnectionId` ensures a connection belongs to exactly one plan.
- `schemaSnapshot` stores the full `ConnectorSchema` (list of objects with their fields) as a JSON column, replaced atomically on refresh or reconfiguration.

## Schema Diff Types (runtime, not Prisma)

Used by the reconfiguration cascade (FR-008, FR-009). Defined in `src/lib/types/schema-diff.ts`:

```typescript
/** Output of computeSchemaDiff() — FR-008 */
interface SchemaDiff {
  addedObjects: string[]
  removedObjects: string[]
  addedFields: { objectApiName: string; fieldApiName: string }[]
  removedFields: { objectApiName: string; fieldApiName: string }[]
  typeChangedFields: {
    objectApiName: string
    fieldApiName: string
    oldType: string
    newType: string
  }[]
}

/** Output of computeImpactReport() — FR-009 */
interface ImpactReport {
  objectMappingsToDelete: { id: string; sourceObject: string; destObject: string }[]
  fieldMappingsToDelete: { id: string; sourceField: string; destField: string }[]
  fieldMappingsToFlagBroken: { id: string; sourceField: string; destField: string; reason: string }[]
  rulesToDelete: { id: string; description: string }[]
  rulesToFlagNeedsReview: { id: string; description: string }[]
  filtersToDelete: { id: string; description: string }[]  // no-op for destination side
  documentsToMarkOutdated: { id: string; title: string }[]
  isEmpty: boolean
}
```

## Audit Trail Entry (for FR-013)

Reconfiguration events are logged as `AuditEntry` rows (feature 001):

```typescript
{
  planId: string
  action: 'DESTINATION_CONNECTED' | 'DESTINATION_DISCONNECTED' | 'DESTINATION_RECONFIGURED' | 'DESTINATION_SCHEMA_REFRESHED'
  details: {
    adapterType: string
    previousAdapterType?: string
    schemaDiffSummary?: { added: number; removed: number; typeChanged: number }
    impactSummary?: { mappingsDeleted: number; mappingsBroken: number; rulesAffected: number; documentsOutdated: number }
  }
  timestamp: DateTime
}
```
