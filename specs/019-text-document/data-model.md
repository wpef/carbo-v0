# Data Model: Text Document Generation

## Prisma Schema

### TextDocument (FR-008, FR-009, FR-013)

```prisma
enum DocumentStatus {
  CURRENT
  OUTDATED
}

model TextDocument {
  id              String          @id @default(cuid())
  mappingPlanId   String
  plan            MigrationPlan   @relation("TextDocuments", fields: [mappingPlanId], references: [id], onDelete: Cascade)

  htmlContent     String          @db.Text        // Full HTML document content
  status          DocumentStatus  @default(CURRENT)

  // Generation statistics (FR-009)
  fieldCount      Int
  ruleCount       Int
  unmappedCount   Int
  llmCallCount    Int

  generatedAt     DateTime        @default(now())

  @@index([mappingPlanId])
  @@index([mappingPlanId, status])
  @@map("text_documents")
}
```

### MigrationPlan relation addition

```prisma
// Add to existing MigrationPlan model:
model MigrationPlan {
  // ... existing fields ...
  textDocuments   TextDocument[]  @relation("TextDocuments")   // onDelete: Cascade
}
```

## TypeScript Types

### TextDocumentRecord

```typescript
// src/features/text-document/types.ts

interface TextDocumentRecord {
  id: string
  mappingPlanId: string
  htmlContent: string
  status: 'CURRENT' | 'OUTDATED'
  fieldCount: number
  ruleCount: number
  unmappedCount: number
  llmCallCount: number
  generatedAt: string  // ISO 8601
}

interface TextDocumentListItem {
  id: string
  status: 'CURRENT' | 'OUTDATED'
  fieldCount: number
  ruleCount: number
  unmappedCount: number
  llmCallCount: number
  generatedAt: string
}
```

### TextDocumentData (template input)

The fully resolved data structure passed to the HTML template function. Built by `text-document-loader.ts`.

```typescript
interface TextDocumentData {
  plan: {
    name: string
    description: string | null
    sourceSystemName: string        // e.g. "Salesforce"
    destinationSystemName: string   // e.g. "HubSpot"
  }
  generatedAt: string               // ISO 8601
  objectMappings: ObjectMappingSection[]
  stats: GenerationStats
}

interface ObjectMappingSection {
  sourceObjectName: string
  sourceObjectApiName: string
  destinationObjectName: string
  destinationObjectApiName: string
  fieldMappings: FieldMappingRow[]
  migrationFilters: FilterDescription[]
  unmappedSourceFields: UnmappedFieldEntry[]
}

interface FieldMappingRow {
  sourceFieldLabel: string
  sourceFieldApiName: string
  sourceDataType: string
  destinationFieldLabel: string
  destinationFieldApiName: string
  destinationDataType: string
  ruleDescription: string | null    // From feature 018; null if no rule
  ruleSource: 'template' | 'llm' | 'fallback' | null
}

interface FilterDescription {
  fieldLabel: string
  fieldApiName: string
  operator: string
  value: string
  plainDescription: string          // e.g. "Only records where CreatedDate is after 2020-01-01"
}

interface UnmappedFieldEntry {
  fieldLabel: string
  fieldApiName: string
  dataType: string
}

interface GenerationStats {
  totalFieldCount: number
  totalRuleCount: number
  totalUnmappedCount: number
  llmCallCount: number
}
```

## Field Descriptions

### TextDocument

| Field | Type | Description |
|-------|------|-------------|
| `id` | `String (cuid)` | Unique identifier for this document version. |
| `mappingPlanId` | `String` | FK to the parent migration plan. Cascade-deleted with the plan. |
| `htmlContent` | `String (Text)` | Complete self-contained HTML document. Immutable after creation. |
| `status` | `DocumentStatus` | `CURRENT` on generation, transitions to `OUTDATED` on reconfiguration cascade. |
| `fieldCount` | `Int` | Total number of field mappings included in the document. |
| `ruleCount` | `Int` | Total number of migration logic rules described in the document. |
| `unmappedCount` | `Int` | Total number of unmapped source fields warned about. |
| `llmCallCount` | `Int` | Number of LLM API calls made during rule description generation (via feature 018). |
| `generatedAt` | `DateTime` | Timestamp of document generation. |

## Relationships

```
MigrationPlan (1) ──► (N) TextDocument         (cascade delete)
TextDocument reads from:
  MigrationPlan (1) ──► (N) ObjectMapping      (via loader)
  ObjectMapping (1) ──► (N) FieldMapping        (via loader)
  FieldMapping (1) ──► (0..1) MigrationLogic   (via loader)
  ObjectMapping (1) ──► (N) MigrationFilter    (via loader)
  ObjectMapping (1) ──► (N) FieldExclusion     (via loader, for unmapped computation)
```

## Constraints

- `htmlContent` uses `@db.Text` for potentially large HTML content (no 191-char VARCHAR limit).
- `status` defaults to `CURRENT` -- only reconfiguration cascades transition to `OUTDATED`.
- `generatedAt` is set at creation time and never updated.
- Cascade delete on `mappingPlanId` ensures documents are removed when a plan is deleted.
- No uniqueness constraint on `mappingPlanId` -- multiple document versions per plan are expected.

## Indexes

- `mappingPlanId` -- query all document versions for a plan.
- `(mappingPlanId, status)` -- query current document for a plan (most common query).
