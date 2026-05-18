# Quickstart: Text Document Generation

## What this feature provides

Generation of a human-readable HTML document summarizing an entire migration plan for client review. Includes field mapping tables, migration logic rule descriptions, unmapped fields warnings, and migration filter descriptions.

## Prerequisites

- Feature 013 (Migration Logic) implemented
- Feature 016 (Unmapped Fields Detection) implemented
- Feature 018 (Rule Description Engine) implemented
- Prisma migrated with `TextDocument` model
- A migration plan with at least one object mapping and field mappings

## How to use

### 1. Generate a text document

```bash
curl -X POST http://localhost:3000/api/plans/{planId}/documents/text
```

Response:
```json
{
  "id": "clx_doc_001",
  "mappingPlanId": "clx_plan_001",
  "status": "CURRENT",
  "fieldCount": 42,
  "ruleCount": 8,
  "unmappedCount": 5,
  "llmCallCount": 2,
  "generatedAt": "2026-05-18T14:30:00.000Z"
}
```

### 2. List all document versions

```bash
curl http://localhost:3000/api/plans/{planId}/documents/text
```

Response: array of document summaries, ordered by most recent first.

### 3. View full document HTML

```bash
curl http://localhost:3000/api/plans/{planId}/documents/text/{documentId}
```

Response includes `htmlContent` -- the full self-contained HTML document.

### 4. UI preview

Navigate to `/plans/{planId}/documents` in the application. The documents page lists generated text documents with a "Generate" button and a preview pane that renders the HTML in a sandboxed iframe.

## Document Structure

The generated HTML document contains:

1. **Summary section**: plan name, description, source/destination systems, counts (objects, fields, rules), generation timestamp
2. **Table of contents** (when 3+ object mappings): links to each object section
3. **Per-object sections**:
   - Object heading (source name -> destination name)
   - Field mapping table (source field, destination field, types, rule description)
   - Migration filters subsection
   - Unmapped fields warning subsection
4. **Generation stats footer**: total counts for audit reference

## Using the service function directly (for feature 021)

```typescript
import { generateTextDocument } from '@/features/text-document/services/text-document-service'

// Generate and persist a new text document
const doc = await generateTextDocument(planId)
// doc.id can be used to fetch the HTML for PDF export
```

## Dependencies

- **Depends on**: 013 (Migration Logic), 016 (Unmapped Fields Detection), 018 (Rule Description Engine)
- **Used by**: 021 (PDF Export)
