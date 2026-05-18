# Tasks: Migration Logic

**Input**: Design documents from `specs/013-migration-logic/`
**Prerequisites**: Features 011 (Object Mapping) and 012 (Field Mapping) implemented, including type-compatibility service

## Phase 1: Setup

- [ ] T001 [P] Add MigrationLogic, ValueEquivalence, and ClassificationPrompt models to `prisma/schema.prisma`. MigrationLogic has @unique on fieldMappingId, sectionType enum, status enum. ValueEquivalence has @@unique on (migrationLogicId, sourceValue). ClassificationPrompt has @unique on migrationLogicId. Run `npx prisma migrate dev --name add-migration-logic`.
- [ ] T002 [P] Extend mapping types in `src/lib/types/mapping.ts`: MigrationLogicDTO, ValueEquivalenceDTO, ClassificationPromptDTO, SaveMigrationLogicInput, ClassifyRequest, ClassifyResponse, SectionType enum, MigrationLogicStatus enum.

---

## Phase 2: Foundational (Service Layer)

- [ ] T003 Create MigrationLogicService in `src/lib/services/migration-logic.ts`: get(fieldMappingId), save(fieldMappingId, input) with upsert semantics (creates or replaces), delete(fieldMappingId). For D1: replaces all ValueEquivalence rows on save. For D2: upserts ClassificationPrompt. Logs all operations to audit trail.
- [ ] T004 Create ClassificationService in `src/lib/services/classification.ts`: `classify(promptText, destValues, sampleValues)` calls Claude API with structured prompt. Parallel calls for each sample. Handles missing API key and API errors with fallback response. Includes console logging for each LLM call (Principle VII).

**Checkpoint**: Service layer complete. Migration logic CRUD and LLM classification testable.

---

## Phase 3: US1 - Open Migration Logic Modal (Priority: P1)

**Goal**: Clicking a field link opens the migration logic modal with the correct section.

### Implementation

- [ ] T005 Create API route handler in `src/app/api/plans/[planId]/object-mappings/[mappingId]/fields/[fieldMappingId]/migration-logic/route.ts`: GET (returns existing logic or null with suggestedSection), PUT (save/validate with upsert).
- [ ] T006 Create React hook in `src/hooks/use-migration-logic.ts`: fetches migration logic for a field mapping, provides save/validate actions, manages modal open/close state.
- [ ] T007 Create MigrationLogicModal component in `src/components/mapping/MigrationLogicModal.tsx`: header shows source field (name + type) left, destination field (name + type) right. Center renders the appropriate D1/D2/D3/D4 section based on type compatibility matrix. Footer has Cancel, Save, Validate buttons (Save/Validate disabled for D3).

**Checkpoint**: Modal opens with correct section for any type combination.

---

## Phase 4: US2 - Value Equivalence D1 (Priority: P1)

**Goal**: Picklist-to-picklist value linking with auto-equivalence.

- [ ] T008 Create ValueEquivalenceSection component in `src/components/mapping/ValueEquivalenceSection.tsx`: two-column value list (source left, destination right). Click-click linking between values. SVG lines for linked pairs. Auto-links case-insensitive exact matches on mount. Source values are fetched from field metadata (picklist options from connector schema). Scrollable for 100+ values.

---

## Phase 5: US3 - LLM Classification Prompt D2 (Priority: P1)

**Goal**: Text-to-picklist classification with LLM-powered preview.

- [ ] T009 Create API route handler in `src/app/api/plans/[planId]/object-mappings/[mappingId]/fields/[fieldMappingId]/classify/route.ts`: POST accepts promptText, destValues, sampleValues. Delegates to ClassificationService. Returns classifications or fallback on error.
- [ ] T010 Create ClassificationPromptSection component in `src/components/mapping/ClassificationPromptSection.tsx`: text area for prompt (with placeholder), 4-5 example rows showing source value + LLM classification. Debounces prompt changes (1s) before re-triggering classification via classify endpoint. Shows loading state during LLM call. Fallback message if API unavailable.

---

## Phase 6: US4 + US5 - Error and Informational Sections (Priority: P2)

**Goal**: D3 (incompatible error) and D4 (informational copy) sections.

- [ ] T011 [P] Create IncompatibleErrorSection component in `src/components/mapping/IncompatibleErrorSection.tsx`: red-bordered message explaining incompatibility and CSV fallback. No interactive elements.
- [ ] T012 [P] Create InformationalCopySection component in `src/components/mapping/InformationalCopySection.tsx`: grey-bordered message with type-specific text from type-compatibility service (e.g., "The value will be copied as-is", "True or False", "True=>1, False=>0"). Only Validate button active.

**Checkpoint**: All user stories complete. Every type combination in the matrix has a handler.

---

## Dependencies & Execution Order

- **Phase 1** (T001-T002): Parallel. No dependencies.
- **Phase 2** (T003-T004): Depends on Phase 1. T003 and T004 are parallel (different files).
- **Phase 3** (T005-T007): Depends on Phase 2. T005 first, then T006 and T007 (T007 depends on T006).
- **Phase 4** (T008): Depends on Phase 3 (needs MigrationLogicModal).
- **Phase 5** (T009-T010): Depends on Phase 3. T009 first, then T010.
- **Phase 6** (T011-T012): Depends on Phase 3. T011 and T012 are parallel.

### Parallel Opportunities

```
Phase 1: T001 | T002 (parallel)
Phase 2: T003 | T004 (parallel)
Phase 4-5-6: T008, T009-T010, T011|T012 can proceed in parallel after Phase 3
Phase 6: T011 | T012 (parallel)
```
