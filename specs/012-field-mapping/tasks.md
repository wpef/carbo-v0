# Tasks: Field Mapping

**Input**: `specs/012-field-mapping/`
**Prerequisites**: 011 (ObjectMapping), 005/008 (Source/Destination Fields)

## Phase 1: Data Layer

- [ ] T001 Add `FieldMapping` model and `CompatibilityStatus` enum to Prisma schema per data-model.md. Include both `@@unique` constraints (sourceFieldName, destinationFieldName per objectMappingId), `@@index([objectMappingId])`, `@@map("field_mappings")`. Add relation from `ObjectMapping`. Run `prisma migrate dev`.
- [ ] T002 Create `src/features/012-field-mapping/types/field-mapping.types.ts`: export `FieldMappingRow`, `LinkStatus` enum, `FieldMappingWithStatus`, `DriftFlag`, `CompatibilityMatrix`, `NormalizedType`, `AutoMatchResult`, `NativeFieldPair`, `UnmappedField`, `MigrationPreviewRecord` per data-model.md TypeScript Types section.
- [ ] T003 Create `src/features/012-field-mapping/service/type-compatibility.ts`: implement type normalization table (30+ raw types -> 5 canonical categories), the 5x5 compatibility matrix, and `normalizeType()`, `checkCompatibility()`, `getLogicSectionType()` functions per research.md Decision 3. Unknown types default to `'text'`.
- [ ] T004 [P] Create `src/features/012-field-mapping/service/link-status.ts`: implement `computeLinkStatus(mapping, hasLogic, isLogicValidated, existsInSchema): LinkStatus` with precedence BROKEN > RED_DASHED > RED_SOLID > ORANGE > GREEN per research.md Decision 4.
- [ ] T005 [P] Create `src/features/012-field-mapping/service/auto-match-registry.ts`: export `getAutoMatchPairs(sourceAdapterType: string, destAdapterType: string, sourceObjectApiName: string, destObjectApiName: string): NativeFieldPair[]`. Initial registry: `"salesforce:hubspot"` with Contact, Account/Company, Opportunity/Deal field pairs per research.md Decision 2. Unknown combos return `[]`.

**Checkpoint**: Type compatibility matrix returns correct results for all 25 combinations. Link status computation handles all precedence cases.

---

## Phase 2: Service Layer

- [ ] T006 [Depends: T001, T002, T003, T004, T005] Create `src/features/012-field-mapping/service/field-mapping.service.ts`: implement `FieldMappingService` interface per contracts/api.md. Methods:
  - `listMappings`: fetch from DB, enrich with computed linkStatus, driftFlag
  - `createMapping`: validate 1:1 constraint, compute compatibilityStatus from type matrix, store types
  - `deleteMapping`: cascade via Prisma, return whether logic existed
  - `autoMatch`: one-shot gated by `fieldAutoMatchedAt`, single transaction; union of registry pairs + case-insensitive name fallback (session learnings #2-3)
  - `getUnmappedFields`: compare all fields in snapshot vs mapped fields
  - `getPreview`: load 25 records, apply value equivalences, return before/after
  All mutating operations log to AuditLog (Principle VI). Emit console.log for key operations (Principle VII).

**Checkpoint**: Service layer tests pass. Auto-match creates expected pairs. 1:1 constraint enforced. LinkStatus computed correctly.

---

## Phase 3: API Routes

- [ ] T007 [Depends: T006] Create `app/api/plans/[planId]/field-mappings/route.ts`: GET handler (list by objectMappingId query param), POST handler (create mapping). Validate plan exists, object mapping belongs to plan, fields exist in snapshot. Return 400/404/409 per contracts/api.md.
- [ ] T008 [Depends: T006] Create `app/api/plans/[planId]/field-mappings/[fieldMappingId]/route.ts`: DELETE handler. Validate ownership chain (plan -> objectMapping -> fieldMapping).
- [ ] T009 [Depends: T006] Create `app/api/plans/[planId]/field-mappings/auto-match/route.ts`: POST handler. Call `autoMatch` service method. Return `AutoMatchResult`.
- [ ] T010 [Depends: T006] Create `app/api/plans/[planId]/field-mappings/unmapped/route.ts`: GET handler. Return unmapped fields for both sides + counts.
- [ ] T011 [Depends: T006] Create `app/api/plans/[planId]/field-mappings/preview/route.ts`: GET handler. Return source record list + migration preview.

**Checkpoint**: All API routes respond correctly. Postman/curl tests pass.

---

## Phase 4: UI Components — Field Table

- [ ] T012 [P] Create `src/features/012-field-mapping/components/LinkStatusBadge.tsx`: renders a color-coded badge for each `LinkStatus` value. GREEN=green dot, ORANGE=orange dot, RED_SOLID=red dot, RED_DASHED=red dashed outline, BROKEN=red badge "Casse". Props: `status: LinkStatus`.
- [ ] T013 [P] Create `src/features/012-field-mapping/components/FieldCard.tsx`: B2 component. Inline in table row. Shows field name, type badge (colored by canonical category), fill rate (source only). Clickable to open detail modal. Props: `field: { apiName, label, dataType, fillRate? }`, `side: 'source' | 'destination'`, `onClick`.
- [ ] T014 [Depends: T012, T013] Create `src/features/012-field-mapping/components/FieldMappingTable.tsx`: B1 component. Table with columns: Source Field (FieldCard) | Arrow | Dest Field (FieldCard) | Status (LinkStatusBadge + DriftFlag badges) | Actions (Configure link [-> 013], Delete). Sortable by status. Props: `mappings: FieldMappingWithStatus[]`, `onDelete`, `onConfigure`, `onFieldClick`.
- [ ] T015 [Depends: T013] Create `src/features/012-field-mapping/components/UnmappedFieldsSection.tsx`: two collapsible sections (unmapped source fields, available destination fields). Each source field row has a "Map to..." dropdown populated with compatible unmapped destination fields. Props: `unmappedSource: UnmappedField[]`, `unmappedDest: UnmappedField[]`, `onCreateMapping`.
- [ ] T016 [Depends: T014, T015] Create `src/features/012-field-mapping/components/FieldDetailModal.tsx`: B3 component. Modal with field name (title), type (subtitle), description (editable for destination). Source: fill rate, picklist values with equivalence status (if picklist), classification prompt preview (if text -> picklist). Props: `field: ObjectField`, `side: 'source' | 'destination'`, `objectMappingId`.

**Checkpoint**: Table renders mapped fields with status badges. Unmapped fields section with dropdown works.

---

## Phase 5: UI Components — Preview Sidebar

- [ ] T017 [Depends: T014] Create `src/features/012-field-mapping/hooks/useMigrationPreview.ts`: React Query hook that fetches preview data from `/preview` endpoint. Accepts `objectMappingId` and `recordIndex`. Re-fetches on mapping changes (via version counter — session learning #5).
- [ ] T018 [Depends: T017] Create `src/features/012-field-mapping/components/MigrationPreviewSidebar.tsx`: permanent right sidebar (`w-96`, sticky). Header "Apercu de migration". Record selector dropdown (25 records, labels from first text values). Two-column Source|Destination view. Transformed values highlighted in amber. Placeholder when no mappings: "Mappez des champs pour voir l'apercu". Props: `objectMappingId`, `planId`.

**Checkpoint**: Preview sidebar renders and updates when mappings change. Transformed values highlighted.

---

## Phase 6: Page Integration

- [ ] T019 [Depends: T007-T011] Create `src/features/012-field-mapping/hooks/useFieldMappings.ts`: React Query hooks — `useFieldMappings(planId, objectMappingId)`, `useCreateFieldMapping`, `useDeleteFieldMapping`, `useAutoMatch`, `useUnmappedFields(planId, objectMappingId)`. Version counter for reactivity (session learning #5). Invalidate queries on mutation.
- [ ] T020 [Depends: T014, T015, T016, T018, T019] Create `src/features/012-field-mapping/components/FieldMappingView.tsx`: main view. Two-column flex layout: config section (`flex-1`) with filter panel + tabs per object pair + field table + unmapped sections; preview sidebar (`w-96 shrink-0`). Tab badges show progress (e.g., "6/12") colored by worst linkStatus. Auto-match triggered on first render per tab (if `fieldAutoMatchedAt` is null). Container widened to `max-w-360`.
- [ ] T021 [Depends: T020] Create `app/plans/[planId]/field-mapping/page.tsx`: server component that fetches plan data + object mappings, renders `FieldMappingView` as client component. Pass object mappings for tab generation.
- [ ] T022 [Depends: T021] Create `app/plans/[planId]/field-mapping/loading.tsx`: Suspense fallback with skeleton UI (tab bar + table placeholder + sidebar placeholder).

**Checkpoint**: Full page loads with tabs, auto-match fires per tab, manual link/unlink works, preview updates.

---

## Phase 7: Drift Highlighting

- [ ] T023 [Depends: T014] Add drift flag rendering to `FieldMappingTable.tsx`: consume `PlanDriftContext`. For each drift type in the spec table, render the appropriate badge (amber/info) alongside the linkStatus badge. Badge stack: linkStatus badge + driftFlag badge(s). Per FR-Drift-FM-2.
- [ ] T024 [Depends: T020] Add `OBJECT_REMOVED` banner to `FieldMappingView.tsx`: if the source or destination object of the current tab is flagged as removed, show a full-width banner "L'objet [source/destination] de ce mapping n'existe plus" with action to redirect to `/plans/[planId]/mapping`.
- [ ] T025 [Depends: T015] Add `FIELD_ADDED` badge to `UnmappedFieldsSection.tsx`: new fields (from drift context) display a "Nouveau" badge with faint green outline.

**Checkpoint**: Drift flags render correctly for all field-level drift types. Object removal banner shows and redirects.

---

## Phase 8: Tests

- [ ] T026 [P] Create `src/features/012-field-mapping/__tests__/type-compatibility.test.ts`: exhaustive tests for all 25 type combinations in the matrix. Test type normalization for all 30+ raw types. Test unknown type fallback to 'text'.
- [ ] T027 [P] Create `src/features/012-field-mapping/__tests__/link-status.test.ts`: unit tests for all LinkStatus computations. Test precedence: BROKEN overrides all, RED_DASHED overrides RED_SOLID, etc. Test each status in isolation.
- [ ] T028 [P] Create `src/features/012-field-mapping/__tests__/auto-match-registry.test.ts`: unit tests. Test: known combo returns pairs, unknown combo returns empty, case-insensitive name fallback works, registry + fallback union coverage.
- [ ] T029 [Depends: T006] Create `src/features/012-field-mapping/__tests__/field-mapping.service.test.ts`: integration tests against real DB. Test: listMappings (enriched with status), createMapping (success, 1:1 rejection, type compatibility), deleteMapping (cascade), autoMatch (first run creates pairs + sets timestamp, second run is no-op, registry + fallback union), getUnmappedFields, getPreview (with/without equivalences).
- [ ] T030 [Depends: T021] Create E2E test `tests/e2e/field-mapping.spec.ts` (Playwright): full flow — open field mapping page, verify auto-match creates expected pairs, switch between object pair tabs, manually create a field link, delete a field link, verify link status badges update, open detail modal, verify preview sidebar shows transformed values.

**Checkpoint**: All tests pass. Feature complete.

---

## Dependencies & Execution Order

- **T001**: No deps (schema migration) — start immediately
- **T002, T003, T004, T005**: Depend on T001. T003/T004/T005 are parallel-safe.
- **T006**: Depends on T001-T005 (service uses all data layer components)
- **T007-T011**: Depend on T006 (routes call service). Parallel-safe.
- **T012, T013**: No service deps (pure UI components). Parallel-safe with Phase 2-3.
- **T014**: Depends on T012, T013
- **T015**: Depends on T013
- **T016**: Depends on T014, T015
- **T017**: Depends on T014 (hook references table)
- **T018**: Depends on T017
- **T019**: Depends on T007-T011 (hooks call API routes)
- **T020**: Depends on T014, T015, T016, T018, T019
- **T021**: Depends on T020
- **T022**: Depends on T021
- **T023-T025**: Depend on T014/T015/T020
- **T026, T027, T028**: Can start once T003/T004/T005 are done. Parallel-safe.
- **T029**: Depends on T006
- **T030**: Depends on T021

### Parallel Opportunities

```
Phase 1:  T001 -> [T002 | T003 | T004 | T005]
Phase 2:  T006
Phase 3:  [T007 | T008 | T009 | T010 | T011]
Phase 4:  [T012 | T013] -> T014 -> T015 -> T016
Phase 5:  T017 -> T018
Phase 6:  T019 (parallel with Phase 4-5, after Phase 3)
          T020 -> T021 -> T022
Phase 7:  [T023 | T024 | T025]
Phase 8:  [T026 | T027 | T028] (parallel, after Phase 1)
          T029 (after T006)
          T030 (after T021)
```
