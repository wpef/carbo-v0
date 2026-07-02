# Quickstart: Contractual Document Generation

## What this feature provides

Generation of a formal contractual HTML document with unique reference number, correspondence tables, migration logic rules section, exclusions listing, filter tables, and signature block for client sign-off before migration execution.

## Prerequisites

- Feature 013 (Migration Logic) implemented
- Feature 016 (Unmapped Fields Detection) implemented
- Feature 018 (Rule Description Engine) implemented
- Feature 019 (Text Document) implemented (for shared `DocumentStatus` enum)
- Prisma migrated with `ContractualDocument` model
- A migration plan with at least one object mapping and field mappings

## How to use

### 1. Generate a contractual document

```bash
curl -X POST http://localhost:3000/api/plans/{planId}/documents/contractual
```

Response:
```json
{
  "id": "clx_cdoc_001",
  "mappingPlanId": "clx_plan_001",
  "referenceNumber": "CARBO-20260518-0001",
  "status": "CURRENT",
  "fieldCount": 42,
  "ruleCount": 8,
  "unmappedCount": 5,
  "filterCount": 2,
  "llmCallCount": 2,
  "generatedAt": "2026-05-18T14:30:00.000Z"
}
```

### 2. List all document versions

```bash
curl http://localhost:3000/api/plans/{planId}/documents/contractual
```

Response: array of document summaries with reference numbers, ordered by most recent first.

### 3. View full document HTML

```bash
curl http://localhost:3000/api/plans/{planId}/documents/contractual/{documentId}
```

Response includes `htmlContent` -- the full self-contained formal HTML document.

### 4. UI preview

Navigate to `/plans/{planId}/documents` in the application. The documents page lists both text and contractual documents. The contractual document section includes a "Generate" button and preview pane with formal styling.

## Document Structure

The generated HTML document contains (all sections always present per FR-014):

1. **Header**: reference number, plan name, source/destination systems, generation date, consultant name
2. **Table of contents** (when 3+ object mappings): links to all sections
3. **Scope section**: migration perimeter description (systems, counts, active filters)
4. **Correspondence tables** (per object): one row per field mapping with source field, destination field, types, rule description
5. **Migration logic rules section**: all rules listed with field references, type, and plain language description
6. **Exclusions section**: "Will NOT be migrated" -- all unmapped fields per object, or "All source fields are mapped -- no exclusions"
7. **Filter table**: all filters with object, field, operator, value, and plain language effect
8. **Signature block**: client approval, name, date, and signature fields (print-and-sign)

## Reference Number Format

Each contractual document receives a unique reference: `CARBO-YYYYMMDD-XXXX` (e.g., `CARBO-20260518-0001`). The number is globally unique across all plans and never reused.

## Using the service function directly (for feature 021)

```typescript
import { generateContractualDocument } from '@/features/contractual-document/services/contractual-document-service'

// Generate and persist a new contractual document
const doc = await generateContractualDocument(planId)
// doc.id can be used to fetch the HTML for PDF export
```

## Dependencies

- **Depends on**: 013 (Migration Logic), 016 (Unmapped Fields Detection), 018 (Rule Description Engine), 019 (DocumentStatus enum)
- **Used by**: 021 (PDF Export)
