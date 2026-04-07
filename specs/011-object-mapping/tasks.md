# Tasks: Object Mapping

**Input**: Design documents from `specs/011-object-mapping/`
**Prerequisites**: Features 000 (Connector Interface), 001 (Migration Plan), 005 (Source Field Retrieval), 008 (Destination Field Retrieval)

## Phase 1: Setup

- [ ] T001 [P] Add ObjectMapping model to `prisma/schema.prisma` with unique constraint, indexes, and relations to MigrationPlan. Run `npx prisma migrate dev --name add-object-mapping`.
- [ ] T002 [P] Create mapping types in `src/lib/types/mapping.ts`: ObjectMappingDTO, CreateObjectMappingInput, AutoLinkResult, ObjectDetailDTO, LinkState enum.

---

## Phase 2: Foundational (Service Layer)

- [ ] T003 Create ObjectMappingService in `src/lib/services/object-mapping.ts`: CRUD operations (list, create, delete with cascade), fan-in detection, detail computation (record count, fields-to-validate, filter count). Cascade deletion explicitly deletes FieldMappings, MigrationLogicRules, MigrationFilters, FieldExclusions before removing the ObjectMapping, logging each step to audit trail.
- [ ] T004 Create auto-link registry in `src/lib/services/auto-link-registry.ts`: static map keyed by `${sourceAdapterType}:${destinationAdapterType}` returning predictable object pairs. Initial entry: `salesforce:hubspot` with Account-Company, Contact-Contact, Opportunity-Deal, Lead-Contact pairs. Expose `getAutoLinkPairs(sourceType, destType)` function.
- [ ] T005 Create auto-link logic in `src/lib/services/object-mapping.ts` (or same file): `autoLink(planId)` checks existing mappings, creates missing predictable pairs, returns created/skipped summary. Idempotent.

**Checkpoint**: Service layer complete. All business logic testable without UI.

---

## Phase 3: US1 + US2 + US3 - Object Mapping View with Links (Priority: P1)

**Goal**: Two-column layout with visual links, auto-linking, and manual link creation.

### Implementation

- [ ] T006 Create API route handlers in `src/app/api/plans/[planId]/object-mappings/route.ts`: GET (list all), POST (create with duplicate check + fan-in warning). Delegates to ObjectMappingService.
- [ ] T007 [P] Create API route handler in `src/app/api/plans/[planId]/object-mappings/[mappingId]/route.ts`: DELETE (cascade delete with confirmation response).
- [ ] T008 [P] Create API route handler in `src/app/api/plans/[planId]/object-mappings/auto-link/route.ts`: POST (trigger auto-linking).
- [ ] T009 Create React hook in `src/hooks/use-object-mapping.ts`: manages link state machine (IDLE -> SOURCE_SELECTED -> IDLE), fetches object mappings, provides createLink/deleteLink/autoLink actions.
- [ ] T010 [P] Create ObjectCard component in `src/components/mapping/ObjectCard.tsx`: displays object name, connection circle (right for source, left for destination), click handler on circle. Highlighted state when selected as link source.
- [ ] T011 [P] Create ObjectLink component in `src/components/mapping/ObjectLink.tsx`: SVG bezier path between two cards. Accepts source/destination positions. Click handler for future link detail (013).
- [ ] T012 [P] Create ObjectSearchFilter component in `src/components/mapping/ObjectSearchFilter.tsx`: text input that filters object list by name (client-side).
- [ ] T013 Create ObjectMappingView component in `src/components/mapping/ObjectMappingView.tsx`: two-column layout (source left, destination right), renders ObjectCards, SVG overlay for ObjectLinks, search filters per column. Triggers auto-link on first mount if no mappings exist.
- [ ] T014 Create mapping page in `src/app/plans/[planId]/mapping/page.tsx`: fetches source objects, destination objects, and existing mappings; renders ObjectMappingView.

**Checkpoint**: Consultant can view objects, auto-link fires on first visit, manual linking works.

---

## Phase 4: US4 - Object Detail Modal (Priority: P2)

**Goal**: Detail modal with record count, field validation progress, filter count.

- [ ] T015 Create API route handler in `src/app/api/plans/[planId]/object-mappings/[mappingId]/detail/route.ts`: GET returns sourceRecordCount, fieldsToValidate, totalSourceFields, migrationFilterCount.
- [ ] T016 Create ObjectDetailModal component in `src/components/mapping/ObjectDetailModal.tsx`: shows object name (title), source/destination label, record count, fields-to-validate (clickable -> navigates to field mapping), filter count. Fetches data from detail endpoint.

---

## Phase 5: US5 - Remove Object Link (Priority: P2)

**Goal**: Confirmation dialog for link removal with cascade deletion feedback.

- [ ] T017 Create LinkConfirmDialog component in `src/components/mapping/LinkConfirmDialog.tsx`: warns about cascade deletion (field mappings, migration logic, filters), shows counts of child entities to be deleted, confirm/cancel buttons. On confirm, calls DELETE endpoint.

**Checkpoint**: All user stories complete. Full object mapping workflow functional.

---

## Dependencies & Execution Order

- **Phase 1** (T001-T002): No dependencies, parallel.
- **Phase 2** (T003-T005): Depends on Phase 1.
- **Phase 3** (T006-T014): Depends on Phase 2. T006 first, then T007/T008 parallel, T009-T012 parallel, T013 depends on T009-T012, T014 depends on T013.
- **Phase 4** (T015-T016): Depends on Phase 3.
- **Phase 5** (T017): Depends on Phase 3 (DELETE endpoint in T007).

### Parallel Opportunities

```
Phase 1: T001 | T002 (parallel)
Phase 2: T003 → T004 → T005 (sequential, same service file)
Phase 3: T006 → [T007 | T008] (parallel), [T010 | T011 | T012] (parallel) → T013 → T014
Phase 4: T015 | T016 (parallel, different layers)
Phase 5: T017 (standalone)
```
