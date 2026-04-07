# Tasks: Contractual Document Generation

**Input**: Design documents from `specs/020-contractual-document/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

## Phase 1: Setup

- [ ] T001 [US1] Add `ContractualDocument` model to `prisma/schema.prisma` per data-model.md. Run `npx prisma db push`.
- [ ] T002 [P] [US1] Create types in `src/lib/services/contractual-document/types.ts`: `ContractualDocumentData`, `ScopeData`, `CorrespondenceRow`, `SignatureBlockData`, `GenerationStats`.
- [ ] T003 [P] [US1] Create barrel export `src/lib/services/contractual-document/index.ts`.

---

## Phase 2: Reference Generator + Template Builder (US1 -- core logic)

**Goal**: Generate unique reference numbers and build formal HTML from structured data.

**Independent Test**: Generate 3 references on the same day -- get XXXX=0001, 0002, 0003. Build HTML from structured data -- all sections present.

- [ ] T004 [P] [US1] Implement reference generator in `src/lib/services/contractual-document/reference-generator.ts`: `generateReferenceNumber()` queries DB for today's count, returns `CARBO-YYYYMMDD-XXXX`. Uses transaction for uniqueness.
- [ ] T005 [P] [US1] Implement template builder in `src/lib/services/contractual-document/template-builder.ts`: functions for `buildHeader()` (reference, plan name, systems, date, consultant), `buildTableOfContents()` (if 3+ objects), `buildScopeSection()`, `buildCorrespondenceTable()` (per object), `buildTransformationRulesSection()`, `buildValidationRulesSection()`, `buildExclusionsSection()`, `buildFilterTable()`, `buildSignatureBlock()`, `buildFullDocument()`. Formal inline CSS (serif, borders, numbered sections). All sections always present.
- [ ] T006 [P] [US1] Write unit tests in `tests/unit/services/contractual-document/reference-generator.test.ts`: format validation, sequential numbering, uniqueness.
- [ ] T007 [US1] Write unit tests in `tests/unit/services/contractual-document/template-builder.test.ts`: test all sections present, TOC at 3+ objects, empty states ("No transformation rules defined", "All source fields are mapped -- no exclusions"), signature block fields, formal styling.

**Checkpoint**: Reference generation and HTML building work in isolation.

---

## Phase 3: Service (US1 -- orchestration)

**Goal**: Load plan data, call rule description engine, assemble structured data, build HTML, persist with reference number.

- [ ] T008 [US1] Implement service in `src/lib/services/contractual-document/contractual-document.service.ts`: `generateContractualDocument(planId)` -- loads full plan data via Prisma, calls `generateDescriptions()` from 018, generates reference number, maps to `ContractualDocumentData`, calls `buildFullDocument()`, persists `ContractualDocument` to DB, logs to audit trail. Returns metadata + stats.
- [ ] T009 [US1] Write unit tests in `tests/unit/services/contractual-document/service.test.ts`: mock Prisma + rule description + reference generator, verify data flow, stats, error handling.

**Checkpoint**: Service generates and persists contractual documents.

---

## Phase 4: API Routes (US1 -- HTTP layer)

- [ ] T010 [P] [US1] Implement POST + GET list route `src/app/api/plans/[planId]/documents/contractual/route.ts`: POST calls service, returns 201 with metadata; GET returns all versions for plan.
- [ ] T011 [US1] Implement GET detail route `src/app/api/plans/[planId]/documents/contractual/[documentId]/route.ts`: return full document with htmlContent. 404 if not found.

**Checkpoint**: API routes work for generation and retrieval.

---

## Phase 5: Preview UI (US1 -- display)

- [ ] T012 [US1] Create preview component `src/components/documents/contractual-document-preview.tsx`: accepts htmlContent, renders in `<iframe srcDoc={...} />`. Formal styling distinction from text document preview.
- [ ] T013 [US1] Create preview page `src/app/plans/[planId]/documents/contractual/[documentId]/page.tsx`: fetch document via API, render preview. Show reference number + stats above iframe.

**Checkpoint**: Consultant can view contractual document in-app.

---

## Phase 6: Integration Test

- [ ] T014 [US1] Write integration test in `tests/integration/contractual-document.test.ts`: seed plan with 3 object mappings, 40 fields, 8 rules, 5 unmapped, 2 filters. Generate document. Verify reference number format, all sections present in HTML, stats match, signature block present.

---

## Dependencies & Execution Order

- **Phase 1** (T001-T003): No dependencies, start immediately
- **Phase 2** (T004-T007): Depends on T001 (Prisma for ref generator), T002 (types)
- **Phase 3** (T008-T009): Depends on T004, T005 (ref generator + template builder), and feature 018
- **Phase 4** (T010-T011): Depends on T008 (service)
- **Phase 5** (T012-T013): Depends on T011 (GET detail route); T012 can start in parallel with Phase 4
- **Phase 6** (T014): Depends on all previous phases

### Parallel Opportunities

- T002 and T003 can run in parallel
- T004, T005, T006 can run in parallel (different files)
- T012 can start in parallel with Phase 4
