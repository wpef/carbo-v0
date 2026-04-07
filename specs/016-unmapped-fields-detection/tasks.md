# Tasks: Unmapped Fields Detection

**Input**: Design documents from `specs/016-unmapped-fields-detection/`
**Prerequisites**: Features 011 (Object Mapping) and 012 (Field Mapping) implemented

## Phase 1: Setup

- [ ] T001 [P] Add FieldExclusion model to `prisma/schema.prisma` with unique constraint on (objectMappingId, sourceFieldName), index on objectMappingId, relation to ObjectMapping with cascade. Run `npx prisma migrate dev --name add-field-exclusion`.
- [ ] T002 [P] Extend mapping types in `src/lib/types/mapping.ts`: UnmappedFieldDTO, FieldExclusionDTO, CreateExclusionInput (with sourceFieldNames array for bulk), UnmappedFieldsSummary.

---

## Phase 2: Foundational (Service Layer)

- [ ] T003 Create UnmappedFieldsService in `src/lib/services/unmapped-fields.ts`: `getUnmapped(objectMappingId)` computes unmapped source fields (all source fields - mapped - excluded), unmapped required dest fields (required dest fields - mapped), and summary counts. Uses schema snapshot data and FieldMapping/FieldExclusion queries. Pure computation, no side effects.
- [ ] T004 Add exclusion CRUD to UnmappedFieldsService or create separate ExclusionService: `createExclusions(objectMappingId, fieldNames[], reason?)` with idempotent skip for existing, `deleteExclusion(exclusionId)`. Logs all operations to audit trail.
- [ ] T005 Add auto-clear logic to FieldMappingService in `src/lib/services/field-mapping.ts`: when a FieldMapping is created, check for and delete any FieldExclusion with matching sourceFieldName on the same ObjectMapping.

**Checkpoint**: Service layer complete. Unmapped fields computation and exclusion management testable.

---

## Phase 3: Single User Story - Unmapped Fields Detection (Priority: P1)

**Goal**: Warning panel with unmapped fields, exclusion management, and integration with field mapping view.

### Implementation

- [ ] T006 Create API route handler in `src/app/api/plans/[planId]/object-mappings/[mappingId]/unmapped/route.ts`: GET returns unmapped source fields, unmapped required dest fields, excluded fields, and summary.
- [ ] T007 Create API route handlers in `src/app/api/plans/[planId]/object-mappings/[mappingId]/exclusions/route.ts`: POST creates exclusion(s) with bulk support.
- [ ] T008 [P] Create API route handler in `src/app/api/plans/[planId]/object-mappings/[mappingId]/exclusions/[exclusionId]/route.ts`: DELETE removes exclusion.
- [ ] T009 Create React hook in `src/hooks/use-unmapped-fields.ts`: fetches unmapped fields data, provides exclude/un-exclude actions, refreshes after field mapping changes.
- [ ] T010 [P] Create UnmappedFieldRow component in `src/components/mapping/UnmappedFieldRow.tsx`: displays field name, type badge, "Exclude" button (with optional reason input). Checkbox for bulk selection.
- [ ] T011 [P] Create ExcludedFieldsSection component in `src/components/mapping/ExcludedFieldsSection.tsx`: collapsible section showing excluded fields with "Restore" (un-exclude) button per field.
- [ ] T012 Create UnmappedFieldsPanel component in `src/components/mapping/UnmappedFieldsPanel.tsx`: warning header (amber for unmapped source, red for unmapped required dest), renders UnmappedFieldRows, bulk exclude action, ExcludedFieldsSection. Summary counts displayed in header.

**Checkpoint**: Full unmapped fields detection workflow complete. Consultant can see, exclude, and restore unmapped fields.

---

## Dependencies & Execution Order

- **Phase 1** (T001-T002): Parallel.
- **Phase 2** (T003-T005): Depends on Phase 1. T003 first, T004 depends on T003, T005 is independent (modifies 012 service).
- **Phase 3** (T006-T012): Depends on Phase 2. T006-T007 first, T008 parallel, T009 next, T010/T011 parallel, T012 last.

### Parallel Opportunities

```
Phase 1: T001 | T002 (parallel)
Phase 2: T003 → T004 (sequential), T005 (parallel with T003)
Phase 3: T008 (parallel with T007), T010 | T011 (parallel)
```
