# Tasks: Client Documents

**Input**: Design documents from `specs/004-client-documents/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api-routes.md
**Depends on**: Feature 003 (Mapping Plan) for mapping data

**Organization**: Tasks grouped by user story.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup (Document Infrastructure)

**Purpose**: Install dependencies and extend schema for document generation

- [ ] T001 Install @anthropic-ai/sdk (Claude API client) and puppeteer in package.json
- [ ] T002 Extend Prisma schema with document entities (DocumentGeneration, GeneratedDocument) in prisma/schema.prisma
- [ ] T003 Run Prisma migration for document entities in prisma/migrations/
- [ ] T004 [P] Create document test fixtures (sample-mapping-plan with rules for testing) in tests/fixtures/documents/
- [ ] T005 [P] Configure environment variable for Claude API key in .env.local

---

## Phase 2: Foundational (Document Core)

**Purpose**: Core document generation infrastructure

- [ ] T006 Create document-specific types (DocumentGeneration, GeneratedDocument, RuleDescription) in src/lib/documents/types.ts
- [ ] T007 Implement rule describer service (templates for simple rules, Claude API for complex rules, fallback for API unavailability) in src/lib/documents/rule-describer.ts
- [ ] T008 [P] Implement PDF exporter (HTML → PDF via Puppeteer) in src/lib/documents/pdf-exporter.ts
- [ ] T009 [P] Create text document HTML template (summary, object sections, field descriptions, unmapped fields, filters) in src/lib/documents/templates/text-document.html
- [ ] T010 [P] Create contractual document HTML template (header, scope, correspondence table, rules, exclusions, signature block) in src/lib/documents/templates/contractual-document.html

**Checkpoint**: Document infrastructure ready — generation services can be built

---

## Phase 3: User Story 1 — Generate Text Document (Priority: P1) MVP

**Goal**: A consultant can generate a text document that describes every mapping and rule in plain, non-technical language, preview it in HTML, and download it as PDF.

**Independent Test**: Generate a text document from a 10+ field mapping plan with rules, read it, verify it's understandable by a non-technical person.

### Implementation for User Story 1

- [ ] T011 [US1] Implement text document generator (load mapping plan, describe rules, render HTML template) in src/lib/documents/text-generator.ts
- [ ] T012 [US1] Implement POST /api/documents/generate route in src/app/api/documents/generate/route.ts
- [ ] T013 [US1] Implement GET /api/documents/generate/[generationId]/status route in src/app/api/documents/generate/[generationId]/status/route.ts
- [ ] T014 [US1] Implement GET /api/documents/[documentId] route (HTML retrieval) in src/app/api/documents/[documentId]/route.ts
- [ ] T015 [US1] Implement GET /api/documents/[documentId]/pdf route (PDF download) in src/app/api/documents/[documentId]/pdf/route.ts
- [ ] T016 [US1] Implement GET /api/documents route (list documents) in src/app/api/documents/route.ts
- [ ] T017 [P] [US1] Create document preview component (HTML viewer) in src/app/documents/[documentId]/components/document-preview.tsx
- [ ] T018 [P] [US1] Create download button component (PDF trigger) in src/app/documents/[documentId]/components/download-button.tsx
- [ ] T019 [P] [US1] Create generation status component (progress indicator) in src/app/documents/[documentId]/components/generation-status.tsx
- [ ] T020 [US1] Create document list page in src/app/documents/page.tsx
- [ ] T021 [US1] Create document preview page assembling components in src/app/documents/[documentId]/page.tsx
- [ ] T022 [US1] Add console logging for all US1 operations: generation progress, LLM calls, PDF export (Principle VII)

**Checkpoint**: Consultant can generate and download a text document from any mapping plan

---

## Phase 4: User Story 2 — Generate Contractual Document (Priority: P2)

**Goal**: A consultant can generate a formal contractual document with structured sections, correspondence table, and signature block for client sign-off.

**Independent Test**: Generate a contractual document, verify it has all required sections (header, scope, table, rules, exclusions, signature block).

### Implementation for User Story 2

- [ ] T023 [US2] Implement contractual document generator (load plan, build correspondence table, render template) in src/lib/documents/contractual-generator.ts
- [ ] T024 [US2] Extend POST /api/documents/generate route to support CONTRACTUAL type in src/app/api/documents/generate/route.ts
- [ ] T025 [US2] Add table of contents generation for documents with 3+ object mappings in src/lib/documents/contractual-generator.ts
- [ ] T026 [US2] Add "Generate Contractual Document" option to document UI in src/app/documents/page.tsx
- [ ] T027 [US2] Add console logging for all US2 operations (Principle VII)

**Checkpoint**: Both document types are fully functional

---

## Phase 5: Polish & Cross-Cutting Concerns

- [ ] T028 [P] Add error handling for Claude API failures (graceful fallback to raw code display) in src/lib/documents/rule-describer.ts
- [ ] T029 [P] Add error handling for Puppeteer PDF generation failures across all routes
- [ ] T030 Validate all quickstart.md scenarios end-to-end (text document + contractual document)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Depends on feature 003 (Mapping Plan) being implemented
- **Foundational (Phase 2)**: Depends on Setup
- **US1 (Phase 3)**: Depends on Foundational — **MVP**
- **US2 (Phase 4)**: Depends on US1 (reuses generation infrastructure)
- **Polish (Phase 5)**: Depends on both user stories

### Parallel Opportunities

- **Phase 1**: T004+T005 in parallel
- **Phase 2**: T008+T009+T010 in parallel (after T006+T007)
- **Phase 3**: T017+T018+T019 in parallel (different components)

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1+2: Setup + Foundational
2. Phase 3: US1 — Generate text document
3. **VALIDATE**: Generate from a real mapping plan and verify readability

### Incremental Delivery

1. US1 → Text document (MVP — primary client deliverable)
2. US2 → Contractual document (adds formality for sign-off)
3. Polish → Error handling and fallbacks

---

## Notes

- 30 tasks total (lightest feature — focused scope)
- Claude API is an external dependency — ensure fallback behavior is solid
- PDF generation is on-demand, not pre-computed — saves storage
- Documents are immutable once generated — regenerate if mapping changes
