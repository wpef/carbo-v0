# Tasks: Unmapped Fields Detection

**Input**: `specs/016-unmapped-fields-detection/`
**Prerequisites**: 012-field-mapping (FieldMapping model, API routes), 011-object-mapping (ObjectMapping model)

---

## Phase 1: Schema & Computation Library

**Purpose**: Database model and pure computation functions for coverage and unmapped field detection.

- [ ] T001 Add FieldExclusion model to `prisma/schema.prisma` per data-model.md. Add unique constraint on `(objectMappingId, sourceFieldName)`. Add relation from ObjectMapping to FieldExclusion (one-to-many, cascade delete). Add index on FieldExclusion.objectMappingId. Run `npx prisma migrate dev --name add-field-exclusions`.
- [ ] T002 [P] Create coverage computation at `src/features/unmapped-fields/lib/coverage-computation.ts`. Export `computeUnmappedFields(sourceFields: ConnectorField[], destFields: ConnectorField[], fieldMappings: { sourceFieldName: string; destinationFieldName: string }[], exclusions: { sourceFieldName: string; reason: string | null }[]): UnmappedFieldsReport`. Pure function per data-model.md computation logic. Returns all metrics: unmapped source, excluded source, unmapped required dest, both coverage percentages, fieldsRemainingToValidate, isComplete.
- [ ] T003 [P] Create shared types at `src/features/unmapped-fields/types.ts`. Export `FieldInfo`, `FieldExclusionItem`, `UnmappedFieldsReport`, `CreateExclusionInput`, `BulkExclusionInput`, `ExclusionListResponse` per contracts/api.md.

**Checkpoint**: Prisma migrated, coverage computation is independently unit-testable with mock data.

---

## Phase 2: Service & API Routes

**Purpose**: Server-side unmapped fields detection and exclusion CRUD.

- [ ] T004 Create unmapped fields service at `src/features/unmapped-fields/services/unmapped-fields-service.ts`. Implement: `getUnmappedFieldsReport(objectMappingId: string): Promise<UnmappedFieldsReport>` (fetches source/dest schema fields, field mappings, exclusions, then calls `computeUnmappedFields`), `listExclusions(objectMappingId: string): Promise<ExclusionListResponse>`, `createExclusion(objectMappingId: string, input: CreateExclusionInput): Promise<FieldExclusionItem>` (validates field exists, not mapped, not already excluded; creates in DB; logs audit), `createBulkExclusions(objectMappingId: string, inputs: CreateExclusionInput[]): Promise<{ exclusions: FieldExclusionItem[], count: number }>` (wraps in transaction; logs bulk audit), `deleteExclusion(exclusionId: string): Promise<void>` (deletes; logs audit).
- [ ] T005 Create API route `src/app/api/plans/[planId]/object-mappings/[objectMappingId]/unmapped-fields/route.ts`: GET handler calls `getUnmappedFieldsReport()`, returns 200.
- [ ] T006 [P] Create API route `src/app/api/plans/[planId]/object-mappings/[objectMappingId]/unmapped-fields/exclusions/route.ts`: GET handler calls `listExclusions()`, returns 200. POST handler detects single vs bulk input (presence of `exclusions` array), calls appropriate service method, returns 201.
- [ ] T007 [P] Create API route `src/app/api/plans/[planId]/object-mappings/[objectMappingId]/unmapped-fields/exclusions/[exclusionId]/route.ts`: DELETE handler calls `deleteExclusion()`, returns 204. Returns 404 if not found.

**Checkpoint**: All API routes respond correctly. Test with curl: get unmapped report (with and without mappings/exclusions), create exclusion, bulk create, list exclusions, delete exclusion.

---

## Phase 3: Auto-Clear Integration

**Purpose**: Automatically clear exclusions when a field mapping is created for an excluded field.

- [ ] T008 Update field mapping creation service (in `src/features/field-mapping/services/` or equivalent from 012). In the `createFieldMapping` function, after creating the FieldMapping, execute `prisma.fieldExclusion.deleteMany({ where: { objectMappingId, sourceFieldName } })` in the same transaction. Log `EXCLUSION_AUTO_CLEARED` to audit trail if a deletion occurred. Add console.log for observability.

**Checkpoint**: Creating a field mapping for a previously excluded field automatically removes the exclusion. Audit log records the auto-clear.

---

## Phase 4: UI Components

**Purpose**: Unmapped fields panel with warnings, exclusion management, and coverage badges.

- [ ] T009 Create `use-unmapped-fields` hook at `src/features/unmapped-fields/hooks/use-unmapped-fields.ts`. Fetches unmapped fields report via GET route. Provides `{ report, isLoading, error, refresh }`. Accepts `objectMappingId`, `planId`, and optional `version` counter for real-time refresh.
- [ ] T010 [P] Create `use-field-exclusions` hook at `src/features/unmapped-fields/hooks/use-field-exclusions.ts`. Provides `{ exclusions, isLoading, exclude, bulkExclude, unexclude }`. Calls POST/DELETE routes. After mutation, increments version to trigger `useUnmappedFields` refresh.
- [ ] T011 Create coverage badge component at `src/features/unmapped-fields/components/coverage-badge.tsx`. Receives `coverage` (number 0-100), `label` (e.g., "Source", "Destination obligatoire"), `detail` (e.g., "18/25 champs"). Renders: percentage with color (green >= 100, amber >= 50, red < 50), label text, detail text. Small pill/badge form factor suitable for tab headers or panel titles.
- [ ] T012 Create unmapped source fields component at `src/features/unmapped-fields/components/unmapped-source-fields.tsx`. Renders a list of unmapped source fields with: checkbox (for bulk selection), field name (bold), field type (badge), "Exclure" button per row. "Select all" checkbox at top. "Exclure la selection" button (disabled when nothing selected). Calls `bulkExclude` on bulk action, `exclude` on individual action. Shows "Aucun champ source non mappe" when list is empty.
- [ ] T013 [P] Create unmapped destination fields component at `src/features/unmapped-fields/components/unmapped-dest-fields.tsx`. Renders a list of unmapped required destination fields with: field name (bold), field type (badge), "Obligatoire" red badge. No exclusion option. Shows guidance text: "Mappez un champ source ou definissez une valeur par defaut." Shows "Toutes les proprietes obligatoires sont mappees" when list is empty.
- [ ] T014 [P] Create excluded fields section at `src/features/unmapped-fields/components/excluded-fields-section.tsx`. Renders excluded fields in a collapsible section (collapsed by default). Each row: field name, reason (if provided), "Restaurer" button. Calls `unexclude` on button click. Shows count in the section header: "Champs exclus (3)".
- [ ] T015 Create unmapped fields panel at `src/features/unmapped-fields/components/unmapped-fields-panel.tsx`. Orchestrates all sub-components. Renders: coverage badges (source + destination required), unmapped source fields warning section (amber border), unmapped required destination fields warning section (red border), excluded fields section (grey border, collapsible). Uses `useUnmappedFields()` and `useFieldExclusions()`. Handles loading/error states.

**Checkpoint**: Unmapped fields panel renders correctly with all sections. Exclusion/un-exclusion works. Coverage badges update in real time.

---

## Phase 5: Integration with Field Mapping & Object Mapping

**Purpose**: Wire the unmapped fields panel into the field mapping page and expose coverage data to the object detail modal.

- [ ] T016 Integrate unmapped fields panel into field mapping page. In the field mapping page (012), render `<UnmappedFieldsPanel>` below the field mapping table for the current object mapping. Pass the `objectMappingId`, `planId`, and the field mapping mutation `version` counter so the panel refreshes when mappings change.
- [ ] T017 [P] Integrate coverage badges into object mapping tabs. In the field mapping page (012), display `<CoverageBadge>` in each object pair tab header next to the existing progress badge. The coverage badge shows the combined fields-remaining count.
- [ ] T018 [P] Expose `fieldsRemainingToValidate` to 011 object detail modal. Ensure the unmapped-fields GET endpoint is callable from the object detail modal (A3). The modal can call `GET /unmapped-fields` and read `fieldsRemainingToValidate` to display "N champs restants a valider". Alternatively, the field mapping page passes this value to the modal as a prop.

**Checkpoint**: Unmapped fields panel appears below the field mapping table. Coverage badges show in tabs. Object detail modal shows the correct remaining count.

---

## Phase 6: Tests

**Purpose**: Verify coverage computation, exclusion CRUD, auto-clear, and integration.

- [ ] T019 Create unit test `tests/unit/unmapped-fields/coverage-computation.test.ts`. Test: all fields mapped (100% coverage, isComplete=true), no fields mapped (0% coverage, all in unmapped), some fields excluded (excluded count in numerator for source coverage), no required dest fields (destinationRequiredCoverage=100), 200+ fields performance, empty source/dest fields (edge case: 100% coverage).
- [ ] T020 [P] Create integration test `tests/integration/unmapped-fields/unmapped-fields-crud.test.ts`. Test against real Postgres: get unmapped report (verify all counts), create exclusion (verify field moves from unmapped to excluded), bulk exclusion (verify multiple fields excluded in one call), delete exclusion (verify field returns to unmapped), cascade delete when object mapping is deleted. Verify audit logs for exclude and unexclude.
- [ ] T021 [P] Create integration test for auto-clear. Test: create an exclusion for field X, then create a field mapping for field X. Verify the exclusion is automatically deleted. Verify audit log records the auto-clear.

**Checkpoint**: All tests pass. Feature complete.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1** (Schema & Library): No deps beyond 012 existing -- start immediately
- **Phase 2** (Service & API): Depends on Phase 1 (Prisma model + computation)
- **Phase 3** (Auto-Clear): Depends on Phase 1 (FieldExclusion model) + 012 field mapping service
- **Phase 4** (UI): Depends on Phase 2 (API routes for hooks)
- **Phase 5** (Integration): Depends on Phase 4 (panel functional) + 012 field mapping page + 011 object detail modal
- **Phase 6** (Tests): Unit tests can start after Phase 1; integration tests after Phase 2 + Phase 3

### Parallel Opportunities

```
Phase 1: T001 first, then [T002 | T003] parallel
Phase 2: T004 first, then [T005 | T006 | T007] parallel
Phase 3: T008 (sequential, depends on Phase 1 + 012 service)
Phase 4: [T009 | T010] parallel, then T011, then [T012 | T013 | T014] parallel, then T015
Phase 5: [T016 | T017 | T018] parallel
Phase 6: T019 first (unit), then [T020 | T021] parallel (integration)
```

### FR Coverage

| FR | Task(s) | Phase |
|----|---------|-------|
| FR-001 (Display unmapped source fields) | T002, T004, T005, T012, T015 | 1, 2, 4 |
| FR-002 (Display unmapped required dest fields) | T002, T004, T005, T013, T015 | 1, 2, 4 |
| FR-003 (Mark source fields as intentionally excluded) | T001, T004, T006, T010, T012 | 1, 2, 4 |
| FR-004 (Bulk exclusion) | T004, T006, T010, T012 | 2, 4 |
| FR-005 (Excluded fields displayed separately) | T004, T005, T014, T015 | 2, 4 |
| FR-006 (Auto-clear exclusion on mapping) | T008 | 3 |
| FR-007 (Audit trail) | T004, T008 | 2, 3 |
