# Quickstart: Client Documents

**Feature**: 004-client-documents
**Date**: 2026-03-19

## Integration Scenario 1: Generate Text Document

**Actor**: Consultant with a completed mapping plan ready for client review.

1. Consultant navigates to the mapping plan "SF → HS Q1 Migration"
2. Clicks "Generate Text Document"
3. System shows generation progress (processing mappings, describing rules via LLM)
4. After ~20 seconds, the HTML preview appears in-app
5. Consultant reads through: summary, Contact→Contacts section with all field descriptions
6. Sees the "Unmapped Fields" section listing 22 fields that won't be migrated
7. Clicks "Download PDF" — a professional PDF is generated and downloaded

**Result**: A client-ready document describing the entire migration plan in plain language.

## Integration Scenario 2: Generate Contractual Document

**Actor**: Consultant preparing formal documentation for client sign-off.

1. Consultant clicks "Generate Contractual Document" on the same plan
2. System generates the structured document with all sections
3. Preview shows: header (project info), scope (filters, record counts), correspondence table,
   transformation rules, validation rules, exclusions, and signature block
4. Consultant verifies the correspondence table is complete
5. Downloads PDF and sends to client for approval

**Result**: A formal document the client can review and sign before migration execution.

## Integration with Upstream Features

### ← Feature 003: Mapping Plan

Documents consume the complete mapping plan data:
- MappingPlan metadata (name, source/destination info)
- ObjectMappings with completion stats
- FieldMappings with source/destination type info
- TransformationRules and ValidationRules (described in natural language)
- MigrationFilters with estimated record counts
- Unmapped source fields list (Constitution Principle III — no silent omissions)

### ← Features 001 + 002: Connectors

Documents include connector metadata:
- Source org/portal name and connection details
- Schema snapshot timestamps (when the mapping was based on this schema)

### Audit Trail (Constitution Principle VI)

Every document generation is logged:
- When generated, by whom, from which plan
- How many mappings/rules/unmapped fields included
- How many LLM calls were made
- This audit data feeds into the contractual document itself — the document is self-documenting.
