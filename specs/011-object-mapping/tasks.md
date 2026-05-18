# Tasks: Object Mapping

**Input**: `specs/011-object-mapping/`
**Prerequisites**: 001 (MigrationPlan), 002/006 (Connections), 003/005/007/008 (Schema + Fields)

## Phase 1: Data Layer

- [ ] T001 Add `ObjectMapping` model to Prisma schema per data-model.md. Include `@@unique([migrationPlanId, sourceObjectName, destinationObjectName])`, `@@index([migrationPlanId])`, `@@map("object_mappings")`. Add relation to `MigrationPlan`. Run `prisma migrate dev`.
- [ ] T002 Create `src/features/011-object-mapping/types/object-mapping.types.ts`: export `ObjectMappingRow`, `PredictablePair`, `ObjectMappingWithStats`, `AutoLinkResult` per data-model.md TypeScript Types section.
- [ ] T003 Create `src/features/011-object-mapping/service/auto-link-registry.ts`: export `getAutoLinkPairs(sourceAdapterType: string, destAdapterType: string): PredictablePair[]`. Initial registry: `"salesforce:hubspot"` with pairs Account->Company, Contact->Contact, Opportunity->Deal, Lead->Contact. Unknown combos return `[]`.
- [ ] T004 [Depends: T001, T002, T003] Create `src/features/011-object-mapping/service/object-mapping.service.ts`: implement `ObjectMappingService` interface per contracts/api.md. Methods: `listMappings`, `createMapping` (with fan-in warning detection), `deleteMapping` (cascade via Prisma), `autoLink` (one-shot gated by `objectAutoLinkedAt`, single transaction), `getMappingStats` (aggregate query). All mutating operations log to AuditLog (Principle VI). Emit console.log for key operations (Principle VII).

**Checkpoint**: Service layer tests pass. Auto-link creates pairs and sets timestamp. Duplicate prevention works. Cascade delete works.

---

## Phase 2: API Routes

- [ ] T005 [Depends: T004] Create `app/api/plans/[planId]/object-mappings/route.ts`: GET handler (list mappings), POST handler (create mapping). Validate plan exists, objects exist in schema snapshots. Return 400/404/409 per contracts/api.md.
- [ ] T006 [Depends: T004] Create `app/api/plans/[planId]/object-mappings/[mappingId]/route.ts`: DELETE handler (cascade delete). Validate plan and mapping exist. Return deletion summary.
- [ ] T007 [Depends: T004] Create `app/api/plans/[planId]/object-mappings/auto-link/route.ts`: POST handler. Call `autoLink` service method. Return `AutoLinkResult`.
- [ ] T008 [Depends: T004] Create `app/api/plans/[planId]/object-mappings/[mappingId]/stats/route.ts`: GET handler. Return `ObjectMappingWithStats`.

**Checkpoint**: All API routes respond correctly. Postman/curl tests pass.

---

## Phase 3: UI Components

- [ ] T009 [P] Create `src/features/011-object-mapping/components/ObjectCard.tsx`: A2 component. Display object label, connection circle (right for source, left for destination). Circle is clickable (starts/completes link creation). Highlight state when selected as link source. Props: `object: SchemaObject`, `side: 'source' | 'destination'`, `isMapped: boolean`, `isLinkSource: boolean`, `onCircleClick`, `onCardClick`.
- [ ] T010 [P] Create `src/features/011-object-mapping/components/ObjectSearch.tsx`: text search input + category filter dropdown (All, Mapped, Unmapped, Standard, Custom). Independent per column. Props: `search: string`, `onSearchChange`, `filter: CategoryFilter`, `onFilterChange`.
- [ ] T011 [Depends: T009] Create `src/features/011-object-mapping/components/ObjectLink.tsx`: SVG path between two object cards. Accepts source/dest bounding rects. Renders bezier curve with stroke color. Supports click for selection (hover highlight). Use `var(--primary)` for stroke color (not `hsl(var(--primary))` — session learning #1).
- [ ] T012 [Depends: T009, T010, T011] Create `src/features/011-object-mapping/hooks/useSvgLinks.ts`: compute SVG path coordinates from card DOM refs. `useLayoutEffect` depends on primitive values (search strings, mapping count) not array references (session learning #2). Single `setSvgLayout()` call (session learning #2).
- [ ] T013 [Depends: T009, T010, T011, T012] Create `src/features/011-object-mapping/components/ObjectMappingView.tsx`: A1 component. Two scrollable columns with ObjectCards. SVG overlay for links. Search/filter per column. Click-to-connect flow: click source circle -> highlight -> click dest circle -> create mapping. Fan-in warning toast. Confirmation dialog on link delete.
- [ ] T014 [Depends: T013] Create `src/features/011-object-mapping/components/ObjectDetailModal.tsx`: A3 component. Modal with object name (title), source/destination label (subtitle), record count, fields remaining to validate (clickable -> navigate to `/plans/[planId]/field-mapping?object=<apiName>`), migration filter count.
- [ ] T015 [Depends: T005, T006, T007, T008] Create `src/features/011-object-mapping/hooks/useObjectMappings.ts`: React Query hooks — `useObjectMappings(planId)` for list, `useCreateMapping`, `useDeleteMapping`, `useAutoLink`, `useMappingStats(planId, mappingId)`. Invalidate queries on mutation.

**Checkpoint**: Object mapping page renders with cards, links, search/filter, detail modal.

---

## Phase 4: Page Integration

- [ ] T016 [Depends: T013, T014, T015] Create `app/plans/[planId]/mapping/page.tsx`: server component that fetches plan data, renders `ObjectMappingView` as client component. Pass source/destination schema objects. Call auto-link on first render if `objectAutoLinkedAt` is null.
- [ ] T017 [Depends: T016] Create `app/plans/[planId]/mapping/loading.tsx`: Suspense fallback with skeleton UI (two columns of card placeholders).

**Checkpoint**: Full page loads, auto-link fires on first visit, manual link/unlink works end-to-end.

---

## Phase 5: Drift Highlighting

- [ ] T018 [Depends: T013] Add drift rendering to `ObjectMappingView.tsx`: consume `PlanDriftContext`. For `OBJECT_ADDED`: "Nouveau" badge + green outline on card. For `OBJECT_REMOVED`: red dashed-border card + "Supprime en source/destination" badge + dashed red SVG link + "Supprimer ce mapping" action button. No auto-removal (Principle IX).
- [ ] T019 [Depends: T014] Add drift indicator to `ObjectDetailModal.tsx`: if the object is flagged as removed, show warning banner in modal header.

**Checkpoint**: Drift badges render correctly for OBJECT_ADDED and OBJECT_REMOVED.

---

## Phase 6: Tests

- [ ] T020 [P] Create `src/features/011-object-mapping/__tests__/object-mapping.service.test.ts`: integration tests against real DB. Test: listMappings (empty, populated), createMapping (success, duplicate rejection, fan-in warning), deleteMapping (cascade verification), autoLink (first run creates pairs + sets timestamp, second run is no-op), getMappingStats.
- [ ] T021 [P] Create `src/features/011-object-mapping/__tests__/auto-link-registry.test.ts`: unit tests. Test: known combo returns pairs, unknown combo returns empty, registry is extensible.
- [ ] T022 [Depends: T016] Create E2E test `tests/e2e/object-mapping.spec.ts` (Playwright): full flow — open mapping page, verify auto-link creates expected pairs, manually create a link, delete a link with cascade confirmation, search/filter objects, open detail modal.

**Checkpoint**: All tests pass. Feature complete.

---

## Dependencies & Execution Order

- **T001**: No deps (schema migration) — start immediately
- **T002, T003**: Depend on T001 (need model types). Parallel-safe.
- **T004**: Depends on T001, T002, T003 (service uses model + types + registry)
- **T005, T006, T007, T008**: Depend on T004 (routes call service). Parallel-safe.
- **T009, T010**: No service deps (pure UI components). Parallel-safe with Phase 2.
- **T011**: Depends on T009 (SVG needs card component)
- **T012**: Depends on T009, T010, T011 (hook coordinates cards)
- **T013**: Depends on T009, T010, T011, T012 (view assembles all)
- **T014**: Depends on T013 (modal opened from view)
- **T015**: Depends on T005-T008 (hooks call API routes)
- **T016**: Depends on T013, T014, T015 (page assembles components + hooks)
- **T017**: Depends on T016 (loading state for page)
- **T018, T019**: Depend on T013/T014 (drift on existing components)
- **T020, T021**: Can start once T004 is done. Parallel-safe.
- **T022**: Depends on T016 (E2E needs full page)

### Parallel Opportunities

```
Phase 1:  T001 -> [T002 | T003] -> T004
Phase 2:  T004 -> [T005 | T006 | T007 | T008]
Phase 3:  [T009 | T010] -> T011 -> T012 -> T013 -> T014
          T015 (parallel with T009-T014, depends on Phase 2)
Phase 4:  T016 -> T017
Phase 5:  [T018 | T019]
Phase 6:  [T020 | T021] (parallel, after T004)
          T022 (after T016)
```
