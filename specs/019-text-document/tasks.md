# Tasks: Text Document Generation

**Input**: `specs/019-text-document/`
**Prerequisites**: 013-migration-logic, 016-unmapped-fields-detection, 018-rule-description-engine

---

## Phase 1: Schema & Types

**Purpose**: Database model and TypeScript types for text document persistence.

- [ ] T001 Add `TextDocument` model to `prisma/schema.prisma` per data-model.md: id, mappingPlanId (FK to MigrationPlan, cascade delete), htmlContent (@db.Text), status (DocumentStatus enum: CURRENT, OUTDATED), fieldCount, ruleCount, unmappedCount, llmCallCount, generatedAt. Add indexes on mappingPlanId and (mappingPlanId, status). Add `textDocuments TextDocument[]` relation to MigrationPlan model. Run `npx prisma migrate dev --name add-text-document`.
- [ ] T002 [P] Create `src/features/text-document/types.ts`: export `TextDocumentRecord`, `TextDocumentListItem`, `GenerateTextDocumentResponse`, `TextDocumentData`, `ObjectMappingSection`, `FieldMappingRow`, `FilterDescription`, `UnmappedFieldEntry`, `GenerationStats` per data-model.md.

**Checkpoint**: Prisma migrated, types compile, `npx prisma studio` shows empty `text_documents` table.

---

## Phase 2: Data Loader

**Purpose**: Load complete plan data into a typed structure ready for template rendering.

- [ ] T003 Create `src/features/text-document/services/text-document-loader.ts`. Implement `loadTextDocumentData(planId: string): Promise<TextDocumentData>`. Single Prisma query with nested includes: plan (name, description), sourceConnection (adapterType for system name), destinationConnection (adapterType for system name), objectMappings with fieldMappings (include sourceField and destField snapshot data), migrationLogic with valueEquivalences and classificationPrompts, migrationFilters, and fieldExclusions. Compute unmapped source fields per object (all source schema fields minus mapped fields minus excluded fields). Map Prisma result to `TextDocumentData` structure. Throw if plan not found. Console.log: "Loaded plan data: N objects, N fields, N rules, N unmapped" (Principle VII).

**Checkpoint**: Loader returns correct `TextDocumentData` for a plan with multiple object mappings. Types match template input interface.

---

## Phase 3: HTML Template

**Purpose**: Pure function that converts `TextDocumentData` into self-contained HTML.

- [ ] T004 Create `src/features/text-document/templates/text-document-template.ts`. Export `renderTextDocument(data: TextDocumentData): string`. Generate complete HTML document with embedded `<style>` block. Structure per FR-002 through FR-012: summary section (plan name, description, systems, counts, timestamp), table of contents (if 3+ object mappings, FR-012), per-object sections with field mapping tables (columns: source field label+apiName, dest field label+apiName, source type, dest type, rule description), migration logic rules subsection (descriptions from 018), filter descriptions subsection, unmapped fields warning subsection (amber styling, warning icon). Style: clean professional layout, readable fonts, alternating table row colors, warning styling for unmapped fields and fallback descriptions. Fallback rule descriptions (source="fallback") shown in monospace with warning styling per edge case spec. "No field mappings defined" message if object has zero field mappings. "No rule defined" for fields without migration logic.
- [ ] T005 [P] Create `src/features/text-document/templates/text-document-styles.ts`. Export `TEXT_DOCUMENT_CSS` constant: embedded CSS for the text document template. Professional styling: system fonts, A4-optimized widths, table styling, warning/info boxes, section headings, responsive for iframe preview. Keep as a separate file from the template for maintainability.

**Checkpoint**: Template produces valid self-contained HTML. Opening the HTML in a browser shows a professional, readable document.

---

## Phase 4: Generation Service

**Purpose**: Orchestrate the full generation pipeline: load → describe rules → render → persist.

- [ ] T006 Create `src/features/text-document/services/text-document-service.ts`. Implement `generateTextDocument(planId)`: (1) call `loadTextDocumentData(planId)`, (2) build `DescriptionBatchInput` from the loaded rules, (3) call `generateDescriptions()` from feature 018, (4) merge descriptions into the template data (match by ruleId), (5) call `renderTextDocument()`, (6) persist to database with stats (fieldCount, ruleCount, unmappedCount, llmCallCount from 018 batch stats), (7) call `logAudit()` with action "TEXT_DOCUMENT_GENERATED" including stats and generation time. Console.log: "Text document generated: {id} in {time}ms" (Principle VII). Abort and throw on any mid-generation error -- no partial document persisted.
- [ ] T007 [P] In the same file, implement `markTextDocumentsOutdated(planId)`: update all TextDocument records with `status: CURRENT` for the given planId to `status: OUTDATED`. Return count of updated documents. Call `logAudit()` with action "TEXT_DOCUMENTS_OUTDATED". Console.log: "Marked N text documents as OUTDATED for plan {planId}".

**Checkpoint**: Full generation pipeline works end-to-end. Document is persisted with correct stats.

---

## Phase 5: API Routes

**Purpose**: HTTP endpoints for document generation, listing, and retrieval.

- [ ] T008 Create `src/app/api/plans/[planId]/documents/text/route.ts`. POST handler: validate plan exists, call `generateTextDocument(planId)`, return 201 with document metadata (without htmlContent). GET handler: query TextDocument where mappingPlanId, order by generatedAt desc, return array of `TextDocumentListItem` (without htmlContent).
- [ ] T009 [P] Create `src/app/api/plans/[planId]/documents/text/[documentId]/route.ts`. GET handler: query TextDocument by id, verify it belongs to the plan (planId match), return full record including htmlContent. Return 404 if not found or plan mismatch.

**Checkpoint**: API routes respond correctly. POST generates a document, GET list returns versions, GET single returns full HTML.

---

## Phase 6: UI Components

**Purpose**: Documents page with generation button, version list, and HTML preview.

- [ ] T010 Create `src/features/text-document/hooks/use-text-documents.ts`. Custom hook wrapping `fetch('/api/plans/[planId]/documents/text')`. Returns `{ documents, isLoading, error, mutate }`.
- [ ] T011 [P] Create `src/features/text-document/hooks/use-text-document.ts`. Custom hook wrapping `fetch('/api/plans/[planId]/documents/text/[documentId]')`. Returns `{ document, isLoading, error }`. Fetches full HTML content.
- [ ] T012 Create `src/features/text-document/components/generate-button.tsx`. Button labeled "Generer le document texte". On click: POST to generate endpoint, show loading spinner during generation, on success: call `mutate()` to refresh list, show success toast. On error: show error toast. If plan has zero object mappings: button disabled with tooltip "Aucun objet mappe".
- [ ] T013 [P] Create `src/features/text-document/components/generation-stats.tsx`. Display generation stats: "N champs, N regles, N champs non mappes, N appels LLM". Compact inline format for use in the document list.
- [ ] T014 Create `src/features/text-document/components/text-document-list.tsx`. List of generated text document versions. Each row: generation date (relative), status badge (CURRENT green / OUTDATED amber with banner text), stats summary via `<GenerationStats>`. Clicking a row selects it for preview. Most recent document pre-selected. Shows "Aucun document genere" empty state.
- [ ] T015 Create `src/features/text-document/components/text-document-preview.tsx`. Sandboxed iframe rendering the selected document's HTML. Uses `srcdoc` attribute with the full `htmlContent`. Sandbox attributes: `allow-same-origin` (for anchor links). Shows "Selectionnez un document" placeholder when no document selected. If document status is OUTDATED: show amber banner above iframe "Ce document ne reflete plus le plan actuel. Regenerez pour obtenir une version a jour."
- [ ] T016 Integrate into documents page at `src/app/plans/[planId]/documents/page.tsx`. Layout: left panel (generate button + document list), right panel (document preview). Use `useTextDocuments()` to fetch list. Pass selected document ID to `<TextDocumentPreview>`. Page title: "Documents". This page will later also include contractual documents (feature 020).

**Checkpoint**: Documents page renders. Consultant can generate, view list, and preview documents in iframe.

---

## Phase 7: Tests

**Purpose**: Validate template rendering, generation pipeline, and API routes.

- [ ] T017 Create `tests/fixtures/text-document/plan-fixtures.ts`: export realistic `TextDocumentData` objects: (a) plan with 2 objects, 15+10 fields, 5 rules (mixed types), 3 unmapped fields, 1 filter; (b) plan with 4 objects (triggers TOC); (c) plan with zero field mappings; (d) plan with fallback rule descriptions.
- [ ] T018 [P] Create `tests/unit/text-document/text-document-template.test.ts`: render template with each fixture. Verify: HTML contains summary section, correct object count, field mapping tables with all rows, TOC present when 3+ objects, TOC absent when <3 objects, unmapped fields section with warning styling, "No field mappings defined" for empty objects, fallback descriptions with monospace styling.
- [ ] T019 [P] Create `tests/unit/text-document/text-document-loader.test.ts`: mock Prisma client. Verify: correct query structure (nested includes), correct mapping to TextDocumentData types, unmapped field computation (total source fields - mapped - excluded), throws on missing plan.
- [ ] T020 Create `tests/integration/text-document/text-document-generation.test.ts`: use real Postgres. Create a plan with 2 object mappings, 20 field mappings, 5 rules, 3 unmapped fields. Call `generateTextDocument()`. Verify: document persisted, stats accurate, HTML contains all expected sections. Verify immutability: generate twice, both documents exist with different IDs.

**Checkpoint**: All tests pass. Feature complete.

---

## Dependencies & Execution Order

- **T001**: No deps -- start immediately
- **T002**: No deps. Parallel with T001.
- **T003**: Depends on T001 (Prisma schema) + T002 (types)
- **T004, T005**: Depend on T002 (types). Parallel-safe.
- **T006, T007**: Depend on T003 (loader) + T004 (template) + T005 (styles)
- **T008, T009**: Depend on T006 (service). Parallel-safe.
- **T010, T011**: Depend on T002 (types). Can start after T002.
- **T012**: Depends on T008 (POST route) + T010 (hook)
- **T013**: Depends on T002 (types)
- **T014**: Depends on T010 (hook) + T013 (stats)
- **T015**: Depends on T011 (hook)
- **T016**: Depends on T012 + T014 + T015
- **T017**: Depends on T002 (types). Can start early.
- **T018**: Depends on T004 (template) + T017 (fixtures)
- **T019**: Depends on T003 (loader) + T017 (fixtures)
- **T020**: Depends on T006 (service)

### Parallel Opportunities

```
Phase 1: [T001 | T002] parallel
Phase 2: T003 (after Phase 1)
Phase 3: [T004 | T005] parallel (after T002)
Phase 4: T006 first, then T007 parallel
Phase 5: [T008 | T009] parallel (after T006)
Phase 6: [T010 | T011 | T013] parallel, then [T012 | T014 | T015] parallel, then T016
Phase 7: T017 first, then [T018 | T019] parallel, then T020
```

### FR Coverage

| FR | Task(s) | Phase |
|----|---------|-------|
| FR-001 (Load complete plan) | T003 | 2 |
| FR-002 (Generate HTML document) | T004, T005, T006 | 3, 4 |
| FR-003 (Summary section) | T004 | 3 |
| FR-004 (Object sections) | T004 | 3 |
| FR-005 (Field mapping table) | T004 | 3 |
| FR-006 (Rule descriptions from 018) | T006 | 4 |
| FR-007 (Unmapped fields per object) | T003, T004 | 2, 3 |
| FR-008 (Immutability) | T001, T006 | 1, 4 |
| FR-009 (Generation stats) | T001, T006, T013 | 1, 4, 6 |
| FR-010 (HTML preview) | T015 | 6 |
| FR-011 (Audit trail) | T006 | 4 |
| FR-012 (Table of contents) | T004 | 3 |
| FR-013 (Status CURRENT/OUTDATED) | T001, T007, T014, T015 | 1, 4, 6 |
