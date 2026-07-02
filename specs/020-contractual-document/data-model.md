# Data Model: Contractual Document Generation

## Prisma Schema

### ContractualDocument (FR-010, FR-012, FR-013, FR-015)

```prisma
model ContractualDocument {
  id                String          @id @default(cuid())
  mappingPlanId     String
  plan              MigrationPlan   @relation("ContractualDocuments", fields: [mappingPlanId], references: [id], onDelete: Cascade)

  referenceNumber   String          @unique      // CARBO-YYYYMMDD-XXXX (FR-013)
  htmlContent       String          @db.Text     // Full HTML document content
  status            DocumentStatus  @default(CURRENT)  // Reuses enum from 019

  // Generation statistics
  fieldCount        Int
  ruleCount         Int
  unmappedCount     Int
  filterCount       Int
  llmCallCount      Int

  generatedAt       DateTime        @default(now())

  @@index([mappingPlanId])
  @@index([mappingPlanId, status])
  @@map("contractual_documents")
}
```

### MigrationPlan relation addition

```prisma
// Add to existing MigrationPlan model:
model MigrationPlan {
  // ... existing fields ...
  contractualDocuments  ContractualDocument[]  @relation("ContractualDocuments")  // onDelete: Cascade
}
```

**Note**: The `DocumentStatus` enum (`CURRENT`, `OUTDATED`) is defined by feature 019 and shared by both document types.

## TypeScript Types

### ContractualDocumentRecord

```typescript
// src/features/contractual-document/types.ts

interface ContractualDocumentRecord {
  id: string
  mappingPlanId: string
  referenceNumber: string
  htmlContent: string
  status: 'CURRENT' | 'OUTDATED'
  fieldCount: number
  ruleCount: number
  unmappedCount: number
  filterCount: number
  llmCallCount: number
  generatedAt: string  // ISO 8601
}

interface ContractualDocumentListItem {
  id: string
  referenceNumber: string
  status: 'CURRENT' | 'OUTDATED'
  fieldCount: number
  ruleCount: number
  unmappedCount: number
  filterCount: number
  llmCallCount: number
  generatedAt: string
}
```

### ContractualDocumentData (template input)

The fully resolved data structure passed to the HTML template function.

```typescript
interface ContractualDocumentData {
  header: {
    referenceNumber: string             // CARBO-YYYYMMDD-XXXX
    planName: string
    sourceSystemName: string
    destinationSystemName: string
    generatedAt: string                 // ISO 8601
    consultantName: string              // From plan metadata or default
  }
  scope: {
    sourceSystemName: string
    destinationSystemName: string
    objectCount: number
    fieldCount: number
    activeFilters: ScopeFilterSummary[]
  }
  objectMappings: ContractualObjectSection[]
  migrationLogicRules: ContractualRuleEntry[]   // Dedicated rules section across all objects
  exclusions: ContractualExclusionSection[]      // Per-object unmapped fields
  filters: ContractualFilterEntry[]              // All filters across all objects
  stats: ContractualGenerationStats
}

interface ContractualObjectSection {
  sourceObjectName: string
  sourceObjectApiName: string
  destinationObjectName: string
  destinationObjectApiName: string
  correspondenceTable: CorrespondenceRow[]
}

interface CorrespondenceRow {
  sourceFieldLabel: string
  sourceFieldApiName: string
  sourceDataType: string
  destinationFieldLabel: string
  destinationFieldApiName: string
  destinationDataType: string
  ruleDescription: string | null
}

interface ContractualRuleEntry {
  objectName: string                    // Context: which object mapping
  sourceFieldLabel: string
  sourceFieldApiName: string
  destinationFieldLabel: string
  destinationFieldApiName: string
  ruleType: string                      // VALUE_EQUIVALENCE, PROMPT, ERROR, INFORMATIONAL
  description: string                   // From Rule Description Engine (018)
}

interface ContractualExclusionSection {
  objectName: string
  unmappedFields: {
    fieldLabel: string
    fieldApiName: string
    dataType: string
  }[]
}

interface ContractualFilterEntry {
  objectName: string
  fieldLabel: string
  fieldApiName: string
  operator: string
  value: string
  plainDescription: string
}

interface ScopeFilterSummary {
  objectName: string
  filterDescription: string
}

interface ContractualGenerationStats {
  totalFieldCount: number
  totalRuleCount: number
  totalUnmappedCount: number
  totalFilterCount: number
  llmCallCount: number
}
```

## Field Descriptions

### ContractualDocument

| Field | Type | Description |
|-------|------|-------------|
| `id` | `String (cuid)` | Unique identifier for this document version. |
| `mappingPlanId` | `String` | FK to the parent migration plan. Cascade-deleted with the plan. |
| `referenceNumber` | `String (unique)` | Globally unique reference: `CARBO-YYYYMMDD-XXXX`. Never reused. |
| `htmlContent` | `String (Text)` | Complete self-contained HTML document with formal styling. Immutable. |
| `status` | `DocumentStatus` | `CURRENT` on generation, transitions to `OUTDATED` on reconfiguration cascade. |
| `fieldCount` | `Int` | Total field mappings in the document. |
| `ruleCount` | `Int` | Total migration logic rules described. |
| `unmappedCount` | `Int` | Total unmapped source fields listed in exclusions. |
| `filterCount` | `Int` | Total migration filters described. |
| `llmCallCount` | `Int` | Number of LLM API calls during rule description generation. |
| `generatedAt` | `DateTime` | Timestamp of document generation. |

## Relationships

```
MigrationPlan (1) ──► (N) ContractualDocument     (cascade delete)
ContractualDocument reads from:
  MigrationPlan (1) ──► (N) ObjectMapping          (via loader)
  ObjectMapping (1) ──► (N) FieldMapping            (via loader)
  FieldMapping (1) ──► (0..1) MigrationLogic       (via loader)
  ObjectMapping (1) ──► (N) MigrationFilter        (via loader)
  ObjectMapping (1) ──► (N) FieldExclusion         (via loader, for exclusions)
```

## Constraints

- `referenceNumber` has a `@unique` constraint -- globally unique across all contractual documents (FR-013).
- `htmlContent` uses `@db.Text` for potentially large HTML content.
- `status` defaults to `CURRENT` -- only reconfiguration cascades transition to `OUTDATED`.
- Cascade delete on `mappingPlanId` ensures documents are removed when a plan is deleted.
- `filterCount` is tracked separately from `ruleCount` (contractual documents have a distinct filters section).

## Indexes

- `mappingPlanId` -- query all document versions for a plan.
- `(mappingPlanId, status)` -- query current document(s) for a plan.
- `referenceNumber` unique index -- enforced by `@unique` constraint, also serves as a fast lookup by reference.
