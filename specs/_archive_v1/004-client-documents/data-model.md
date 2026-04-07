# Data Model: Client Documents

**Feature**: 004-client-documents
**Date**: 2026-03-19

## Entities

### DocumentGeneration

Records a document generation event for audit trail purposes.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| planId | UUID | FK → MappingPlan, required | The mapping plan used to generate the document |
| documentType | enum | required | TEXT, CONTRACTUAL |
| status | enum | required | GENERATING, COMPLETE, FAILED |
| generatedAt | datetime | nullable | When generation completed |
| fieldMappingCount | integer | required | Number of field mappings included |
| unmappedFieldCount | integer | required | Number of unmapped fields reported |
| ruleCount | integer | required | Number of rules described |
| llmCallCount | integer | required | Number of LLM calls made for rule descriptions |
| createdAt | datetime | required | Record creation timestamp |

**Relationships**: One DocumentGeneration has one GeneratedDocument.

---

### GeneratedDocument

The generated document content stored for retrieval.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| generationId | UUID | FK → DocumentGeneration, required, unique | Parent generation event |
| htmlContent | text | required | Full HTML content of the document |
| title | string | required | Document title for display |
| createdAt | datetime | required | Record creation timestamp |

**Notes**:
- PDF is generated on demand from `htmlContent` via Puppeteer — not stored.
- Old documents are preserved for audit trail even after regeneration.

## Entity Relationship Diagram (text)

```
MappingPlan (1) ──── (many) DocumentGeneration
                                 │
                                 └── (1) GeneratedDocument

DocumentGeneration ──── (many) AuditLog
```
