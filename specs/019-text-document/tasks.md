# Tasks: Text Document Generation

**Input**: Design documents from `specs/019-text-document/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

## Phase 1: Setup

- [ ] T001 [US1] Add `TextDocument` model to `prisma/schema.prisma` per data-model.md. Run `npx prisma db push`.
- [ ] T002 [P] [US1] Create types in `src/lib/services/text-document/types.ts`: `TextDocumentData` (structured data before rendering), `GenerationStats`, `ObjectSectionData`, `FieldRowData`.
- [ ] T003 [P] [US1] Create barrel export `src/lib/services/text-document/index.ts`.

---

## Phase 2: Template Builder (US1 -- HTML generation)

**Goal**: Build a self-contained HTML document from structured plan data.

**Independent Test**: Pass structured data to the builder, get a valid HTML string with all sections.

- [ ] T004 [US1] Implement template builder in `src/lib/services/text-document/template-builder.ts`: functions for `buildSummarySection()`, `buildObjectSection()` (field mapping table + rules + filters + unmapped), `buildTableOfContents()` (if 3+ objects), `buildFullDocument()`. Inline CSS in `<style>` block. Handle empty states ("No field mappings defined", "No transformation", etc.).
- [ ] T005 [US1] Write unit tests in `tests/unit/services/text-document/template-builder.test.ts`: test full document with 2 objects, field table correctness, TOC presence at 3+ objects, empty states, fallback rule styling (monospace + warning).

**Checkpoint**: Template builder produces correct HTML from structured data.

---

## Phase 3: Service (US1 -- orchestration)

**Goal**: Load plan data, call rule description engine, assemble structured data, build HTML, persist.

**Independent Test**: Seed a plan with 2 objects, 15 fields, mixed rules, unmapped fields, filters. Generate document. Verify stored HTML contains all data.

- [ ] T006 [US1] Implement service in `src/lib/services/text-document/text-document.service.ts`: `generateTextDocument(planId)` -- loads plan + object mappings + field mappings + migration logic + unmapped fields + filters via Prisma, calls `generateDescriptions()` from 018, maps to `TextDocumentData`, calls `buildFullDocument()`, persists `TextDocument` to DB, logs to audit trail. Returns document metadata + stats.
- [ ] T007 [US1] Write unit tests in `tests/unit/services/text-document/service.test.ts`: mock Prisma + rule description service, verify correct data flow, stats computation, error handling (abort on DB failure, no partial save).

**Checkpoint**: Service generates and persists documents.

---

## Phase 4: API Routes (US1 -- HTTP layer)

**Goal**: Expose generation and retrieval via REST API.

- [ ] T008 [P] [US1] Implement POST route `src/app/api/plans/[planId]/documents/text/route.ts`: call service, return 201 with metadata (no htmlContent). Validate planId exists.
- [ ] T009 [P] [US1] Implement GET list route in same file: return all TextDocuments for plan, ordered by generatedAt desc, without htmlContent.
- [ ] T010 [US1] Implement GET detail route `src/app/api/plans/[planId]/documents/text/[documentId]/route.ts`: return full document including htmlContent. 404 if not found.

**Checkpoint**: API routes work for generation and retrieval.

---

## Phase 5: Preview UI (US1 -- display)

**Goal**: Render the generated HTML document in-app.

- [ ] T011 [US1] Create preview component `src/components/documents/text-document-preview.tsx`: accepts htmlContent string, renders in `<iframe srcDoc={...} />` with full-width/height styling. Loading state while fetching.
- [ ] T012 [US1] Create preview page `src/app/plans/[planId]/documents/text/[documentId]/page.tsx`: fetch document via API, render preview component. Show generation stats (field count, rule count, unmapped count, LLM calls) above the iframe.

**Checkpoint**: Consultant can view generated document in-app.

---

## Phase 6: Integration Test

- [ ] T013 [US1] Write integration test in `tests/integration/text-document.test.ts`: seed a complete plan (2 object mappings, 15 fields, 5 rules, 3 unmapped, 1 filter), call POST to generate, call GET to retrieve, verify HTML contains all expected sections and data. Verify stats match content.

---

## Dependencies & Execution Order

- **Phase 1** (T001-T003): No dependencies, start immediately
- **Phase 2** (T004-T005): Depends on T002 (types)
- **Phase 3** (T006-T007): Depends on T001 (Prisma model), T004 (template builder), and feature 018 (rule-description service)
- **Phase 4** (T008-T010): Depends on T006 (service)
- **Phase 5** (T011-T012): Depends on T010 (GET detail route); parallel with Phase 4 for T011
- **Phase 6** (T013): Depends on all previous phases

### Parallel Opportunities

- T002 and T003 can run in parallel
- T008 and T009 can run in parallel (same file, different handlers)
- T011 can start in parallel with Phase 4 (component is independent of routes)
