# Tasks: Contractual Document Generation

**Input**: `specs/020-contractual-document/`
**Prerequisites**: 013-migration-logic, 016-unmapped-fields-detection, 018-rule-description-engine, 019-text-document (for DocumentStatus enum)

---

## Phase 1: Schema & Types

**Purpose**: Database model and TypeScript types for contractual document persistence.

- [ ] T001 Add `ContractualDocument` model to `prisma/schema.prisma` per data-model.md: id, mappingPlanId (FK to MigrationPlan, cascade delete), referenceNumber (String, @unique), htmlContent (@db.Text), status (DocumentStatus -- reuse enum from 019), fieldCount, ruleCount, unmappedCount, filterCount, llmCallCount, generatedAt. Add indexes on mappingPlanId and (mappingPlanId, status). Add `contractualDocuments ContractualDocument[]` relation to MigrationPlan model. Run `npx prisma migrate dev --name add-contractual-document`.
- [ ] T002 [P] Create `src/features/contractual-document/types.ts`: export `ContractualDocumentRecord`, `ContractualDocumentListItem`, `GenerateContractualDocumentResponse`, `ContractualDocumentData`, `ContractualObjectSection`, `CorrespondenceRow`, `ContractualRuleEntry`, `ContractualExclusionSection`, `ContractualFilterEntry`, `ScopeFilterSummary`, `ContractualGenerationStats` per data-model.md.

**Checkpoint**: Prisma migrated, types compile, `npx prisma studio` shows empty `contractual_documents` table with unique constraint on referenceNumber.

---

## Phase 2: Reference Number Generator

**Purpose**: Generate globally unique reference numbers in CARBO-YYYYMMDD-XXXX format.

- [ ] T003 Create `src/features/contractual-document/services/reference-number-generator.ts`. Implement `generateReferenceNumber(): Promise<string>`. Logic: format today's date as YYYYMMDD, query count of ContractualDocument where referenceNumber starts with `CARBO-{today}`, compute next counter as count+1, zero-pad to 4 digits, format as `CARBO-{date}-{counter}`. Wrap in try/catch with up to 3 retry attempts on Prisma unique constraint violation (P2002). Console.log: "Generated reference number: CARBO-XXXXXXXX-XXXX" (Principle VII).

**Checkpoint**: Generator produces correctly formatted, unique reference numbers. Concurrent calls do not collide.

---

## Phase 3: Data Loader

**Purpose**: Load complete plan data into a typed structure for the contractual document template.

- [ ] T004 Create `src/features/contractual-document/services/contractual-document-loader.ts`. Implement `loadContractualDocumentData(planId: string, referenceNumber: string): Promise<ContractualDocumentData>`. Single Prisma query with nested includes (same pattern as 019 loader): plan metadata, source/destination connections, object mappings with field mappings, migration logic with value equivalences and classification prompts, migration filters, field exclusions. Map to `ContractualDocumentData` structure: populate header (reference number, plan name, systems, consultant name from plan metadata or default "Consultant"), scope section (counts, filter summaries), per-object correspondence tables, dedicated migration logic rules list (flattened across all objects), exclusions per object, filters flattened. Throw if plan not found. Console.log: "Loaded contractual data: N objects, N fields, N rules, N unmapped, N filters" (Principle VII).

**Checkpoint**: Loader returns correct `ContractualDocumentData` with all sections populated.

---

## Phase 4: HTML Template

**Purpose**: Pure function converting `ContractualDocumentData` into formal contractual HTML.

- [ ] T005 Create `src/features/contractual-document/templates/contractual-document-styles.ts`. Export `CONTRACTUAL_DOCUMENT_CSS` constant: formal styling with serif headings, section numbering (CSS counters), rule lines between sections, formal table styling, signature block layout (labeled lines with dotted underlines), warning boxes for exclusions, A4-optimized widths. Visually distinct from text document (019) per FR-001.
- [ ] T006 Create `src/features/contractual-document/templates/contractual-document-template.ts`. Export `renderContractualDocument(data: ContractualDocumentData): string`. Generate complete HTML document with embedded styles from T005. Structure per FR-002 through FR-014: header section (reference number, plan name, systems, date, consultant -- FR-002), table of contents (if 3+ object mappings, linked to section anchors -- FR-003), scope section (migration perimeter, object/field counts, active filters -- FR-004), correspondence tables per object (source field, dest field, types, rule description -- FR-005), migration logic rules section (all rules with field refs, type, description -- FR-006), exclusions section titled "Ne sera PAS migre" listing unmapped fields per object, or "Tous les champs source sont mappes -- aucune exclusion" if none (FR-007), filter table (object, field, operator, value, description -- FR-008), signature block (approval, name, date, signature lines -- FR-009). All sections always present even if empty (FR-014). "No field mappings defined" for empty correspondence tables. Formal section numbering (1., 2., 3., etc.).

**Checkpoint**: Template produces valid self-contained HTML. Opening in browser shows a formal, contractual-style document distinct from the text document.

---

## Phase 5: Generation Service

**Purpose**: Orchestrate the full generation pipeline: reference → load → describe rules → render → persist.

- [ ] T007 Create `src/features/contractual-document/services/contractual-document-service.ts`. Implement `generateContractualDocument(planId)`: (1) call `generateReferenceNumber()`, (2) call `loadContractualDocumentData(planId, referenceNumber)`, (3) build `DescriptionBatchInput` from the loaded rules, (4) call `generateDescriptions()` from feature 018, (5) merge descriptions into template data (match by ruleId in correspondence tables and rules section), (6) call `renderContractualDocument()`, (7) persist to database with reference number and stats (fieldCount, ruleCount, unmappedCount, filterCount, llmCallCount), (8) call `logAudit()` with action "CONTRACTUAL_DOCUMENT_GENERATED" including reference number, stats, and generation time. Console.log: "Contractual document generated: {referenceNumber} in {time}ms" (Principle VII). Abort and throw on any mid-generation error -- no partial document persisted.
- [ ] T008 [P] In the same file, implement `markContractualDocumentsOutdated(planId)`: update all ContractualDocument records with `status: CURRENT` for the given planId to `status: OUTDATED`. Return count of updated documents. Call `logAudit()` with action "CONTRACTUAL_DOCUMENTS_OUTDATED". Console.log: "Marked N contractual documents as OUTDATED for plan {planId}".

**Checkpoint**: Full generation pipeline works end-to-end. Document persisted with unique reference number and correct stats.

---

## Phase 6: API Routes

**Purpose**: HTTP endpoints for document generation, listing, and retrieval.

- [ ] T009 Create `src/app/api/plans/[planId]/documents/contractual/route.ts`. POST handler: validate plan exists, call `generateContractualDocument(planId)`, return 201 with document metadata (without htmlContent). GET handler: query ContractualDocument where mappingPlanId, order by generatedAt desc, return array of `ContractualDocumentListItem` (without htmlContent).
- [ ] T010 [P] Create `src/app/api/plans/[planId]/documents/contractual/[documentId]/route.ts`. GET handler: query ContractualDocument by id, verify it belongs to the plan (planId match), return full record including htmlContent. Return 404 if not found or plan mismatch.

**Checkpoint**: API routes respond correctly. POST generates with reference number, GET list returns versions, GET single returns full HTML.

---

## Phase 7: UI Components

**Purpose**: Contractual document section on the documents page with generation, listing, and preview.

- [ ] T011 Create `src/features/contractual-document/hooks/use-contractual-documents.ts`. Custom hook wrapping `fetch('/api/plans/[planId]/documents/contractual')`. Returns `{ documents, isLoading, error, mutate }`.
- [ ] T012 [P] Create `src/features/contractual-document/hooks/use-contractual-document.ts`. Custom hook wrapping `fetch('/api/plans/[planId]/documents/contractual/[documentId]')`. Returns `{ document, isLoading, error }`. Fetches full HTML content.
- [ ] T013 Create `src/features/contractual-document/components/generate-contractual-button.tsx`. Button labeled "Generer le document contractuel". On click: POST to generate endpoint, show loading spinner, on success: call `mutate()` to refresh list, show success toast with reference number. On error: show error toast. Disabled with tooltip if plan has zero object mappings.
- [ ] T014 Create `src/features/contractual-document/components/contractual-document-list.tsx`. List of generated contractual document versions. Each row: reference number (prominent), generation date, status badge (CURRENT green / OUTDATED red with prominent banner per research Decision 7), stats summary. Clicking a row selects it for preview. Most recent pre-selected.
- [ ] T015 Create `src/features/contractual-document/components/contractual-document-preview.tsx`. Sandboxed iframe rendering the selected document's HTML via `srcdoc`. If document status is OUTDATED: show red banner above iframe "Ce document contractuel ne reflete plus le plan actuel. Le perimetre de migration a change depuis sa generation. Regenerez un nouveau document."
- [ ] T016 Integrate contractual documents into the documents page at `src/app/plans/[planId]/documents/page.tsx`. Add a second section below the text document section: "Document contractuel" heading, generate button, contractual document list, and preview pane. Use tabs or sections to separate text and contractual document areas. Both document types visible on the same page.

**Checkpoint**: Documents page shows both text and contractual document sections. Consultant can generate, list, and preview contractual documents with formal styling.

---

## Phase 8: Tests

**Purpose**: Validate template rendering, reference number generation, and full pipeline.

- [ ] T017 Create `tests/fixtures/contractual-document/plan-fixtures.ts`: export realistic `ContractualDocumentData` objects: (a) plan with 3 objects, 40 fields, 8 rules, 5 unmapped, 2 filters (triggers TOC); (b) plan with 1 object (no TOC); (c) plan with zero rules, zero filters, zero unmapped (all sections present with empty messages); (d) plan with broken mapping (warning flag in correspondence table).
- [ ] T018 [P] Create `tests/unit/contractual-document/reference-number-generator.test.ts`: mock Prisma count queries. Test: first reference of the day (0001), sequential numbering (0002, 0003), date formatting, retry on unique constraint violation.
- [ ] T019 [P] Create `tests/unit/contractual-document/contractual-document-template.test.ts`: render template with each fixture. Verify: header contains reference number, TOC present at 3+ objects, all sections present even when empty (FR-014), correspondence tables have correct columns, rules section lists all rules with types, exclusions section shows "Ne sera PAS migre" heading, filter table present, signature block with 4 fields, formal styling class present (distinct from text document).
- [ ] T020 Create `tests/integration/contractual-document/contractual-document-generation.test.ts`: use real Postgres. Create a plan with 3 object mappings, 30 field mappings, 6 rules, 4 unmapped fields, 2 filters. Call `generateContractualDocument()`. Verify: document persisted with unique reference number, stats accurate, HTML contains all required sections, all sections present. Generate twice: both have different reference numbers. Verify immutability.

**Checkpoint**: All tests pass. Feature complete.

---

## Dependencies & Execution Order

- **T001**: No deps -- start immediately
- **T002**: No deps. Parallel with T001.
- **T003**: Depends on T001 (Prisma schema)
- **T004**: Depends on T001 (Prisma schema) + T002 (types)
- **T005**: Depends on T002 (types)
- **T006**: Depends on T002 (types) + T005 (styles)
- **T007**: Depends on T003 (reference generator) + T004 (loader) + T006 (template)
- **T008**: Depends on T001 (Prisma schema)
- **T009, T010**: Depend on T007 (service). Parallel-safe.
- **T011, T012**: Depend on T002 (types). Can start after T002.
- **T013**: Depends on T009 (POST route) + T011 (hook)
- **T014**: Depends on T011 (hook)
- **T015**: Depends on T012 (hook)
- **T016**: Depends on T013 + T014 + T015
- **T017**: Depends on T002 (types). Can start early.
- **T018**: Depends on T003 (reference generator) + T017 (fixtures)
- **T019**: Depends on T006 (template) + T017 (fixtures)
- **T020**: Depends on T007 (service)

### Parallel Opportunities

```
Phase 1: [T001 | T002] parallel
Phase 2: T003 (after T001)
Phase 3: T004 (after T001+T002), [T005] parallel with T004
Phase 4: T005 first (if not done), then T006 (after T002+T005)
Phase 5: T007 (after T003+T004+T006), [T008] parallel with T007
Phase 6: [T009 | T010] parallel (after T007)
Phase 7: [T011 | T012] parallel, then [T013 | T014 | T015] parallel, then T016
Phase 8: T017 first, then [T018 | T019] parallel, then T020
```

### FR Coverage

| FR | Task(s) | Phase |
|----|---------|-------|
| FR-001 (Formal layout, distinct from 019) | T005, T006 | 4 |
| FR-002 (Header with reference number) | T003, T004, T006 | 2, 3, 4 |
| FR-003 (Table of contents at 3+ objects) | T006 | 4 |
| FR-004 (Scope section) | T004, T006 | 3, 4 |
| FR-005 (Correspondence tables) | T004, T006 | 3, 4 |
| FR-006 (Migration logic rules section) | T004, T006, T007 | 3, 4, 5 |
| FR-007 (Exclusions section) | T004, T006 | 3, 4 |
| FR-008 (Filter table) | T004, T006 | 3, 4 |
| FR-009 (Signature block) | T006 | 4 |
| FR-010 (Immutability) | T001, T007 | 1, 5 |
| FR-011 (HTML preview) | T015 | 7 |
| FR-012 (Audit trail) | T007 | 5 |
| FR-013 (Unique reference number) | T001, T003 | 1, 2 |
| FR-014 (All sections always present) | T006 | 4 |
| FR-015 (Status CURRENT/OUTDATED) | T001, T008, T014, T015 | 1, 5, 7 |
