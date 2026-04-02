# Tasks: Field Mapping

**Input**: Design documents from `specs/012-field-mapping/`
**Prerequisites**: Feature 011 (Object Mapping) implemented

## Phase 1: Setup

- [ ] T001 [P] Add FieldMapping model to `prisma/schema.prisma` with unique constraints on (objectMappingId, sourceFieldName) and (objectMappingId, destinationFieldName), index on objectMappingId, relation to ObjectMapping. Run `npx prisma migrate dev --name add-field-mapping`.
- [ ] T002 [P] Create type compatibility matrix in `src/lib/services/type-compatibility.ts`: 2D lookup table for 5x5 type combinations (Text, Number, Date, Picklist, Checkbox). Export `getCompatibility(sourceType, destType)` returning `{ status, section, message }`. Include all 25 combinations from spec's Type Compatibility Matrix.
- [ ] T003 [P] Extend mapping types in `src/lib/types/mapping.ts`: FieldMappingDTO, CreateFieldMappingInput, CompatibilityStatus enum, LinkStatus enum (GREEN, ORANGE, RED_SOLID, RED_DASHED), AutoMatchResult.

---

## Phase 2: Foundational (Service Layer)

- [ ] T004 Create FieldMappingService in `src/lib/services/field-mapping.ts`: CRUD operations (list with computed linkStatus, create with compatibility check and one-to-one enforcement, delete with cascade of MigrationLogic). All operations log to audit trail.
- [ ] T005 Create field auto-match registry in `src/lib/services/field-auto-match-registry.ts`: static map keyed by `${sourceAdapter}:${destAdapter}:${sourceObject}:${destObject}` returning field pairs. Initial data: SF-HS Contact-Contact (FirstName-firstname, LastName-lastname, Email-email, Phone-phone), Account-Company (Name-name, Website-domain, Phone-phone), etc. Fallback to wildcard `*:*` for common cross-object fields.
- [ ] T006 Add auto-match logic to FieldMappingService: `autoMatch(objectMappingId)` checks existing mappings, creates missing native correspondences, returns created/skipped. Idempotent.

**Checkpoint**: Service layer complete. All field mapping business logic testable.

---

## Phase 3: US1 + US2 + US3 - Field Mapping View with Links (Priority: P1)

**Goal**: Two-column field layout with visual links, auto-matching, and manual link creation.

### Implementation

- [ ] T007 Create API route handlers in `src/app/api/plans/[planId]/object-mappings/[mappingId]/fields/route.ts`: GET (list field mappings with linkStatus + unmapped fields), POST (create with compatibility check + one-to-one enforcement).
- [ ] T008 [P] Create API route handler in `src/app/api/plans/[planId]/object-mappings/[mappingId]/fields/[fieldMappingId]/route.ts`: DELETE (cascade delete with audit log).
- [ ] T009 [P] Create API route handler in `src/app/api/plans/[planId]/object-mappings/[mappingId]/fields/auto-match/route.ts`: POST (trigger auto-matching).
- [ ] T010 Create React hook in `src/hooks/use-field-mapping.ts`: manages link state machine, fetches field mappings, provides createLink/deleteLink/autoMatch actions, computes linkStatus for each mapping.
- [ ] T011 [P] Create FieldCard component in `src/components/mapping/FieldCard.tsx`: displays field name, type badge, fill rate (source only, "--" if unavailable), connection circle (right for source, left for destination), click handler on circle.
- [ ] T012 [P] Create FieldLink component in `src/components/mapping/FieldLink.tsx`: SVG bezier path between two field cards. Color-coded by LinkStatus: green (#22c55e), orange (#f97316), red solid (#ef4444), red dashed (#ef4444 + dasharray). Click handler opens migration logic modal (013).
- [ ] T013 [P] Create FieldSearchFilter component in `src/components/mapping/FieldSearchFilter.tsx`: text input filtering fields by name or type.
- [ ] T014 Create FieldMappingView component in `src/components/mapping/FieldMappingView.tsx`: two-column layout, renders FieldCards + FieldLinks via SVG overlay, search filters per column. Triggers auto-match on first mount.
- [ ] T015 Create field mapping page in `src/app/plans/[planId]/mapping/[mappingId]/page.tsx`: fetches source fields, destination fields, existing field mappings; renders FieldMappingView. Navigation from object mapping view.

**Checkpoint**: Core field mapping workflow complete.

---

## Phase 4: US4 - Field Detail Modal (Priority: P2)

**Goal**: Detail modal with type-specific information.

- [ ] T016 Create FieldDetailModal component in `src/components/mapping/FieldDetailModal.tsx`: shows field name (title), type (subtitle), fill rate (source), editable description (destination). For source picklist: list of values with equivalence status. For source text mapped to dest picklist: classification prompt preview placeholder (implemented in 013).

---

## Phase 5: US5 + US6 - Link Status Indicators + Remove Field Link (Priority: P2)

**Goal**: Color-coded links visible at a glance; clean field link removal.

- [ ] T017 Add `getLinkStatus()` utility to `src/lib/services/field-mapping.ts`: derives LinkStatus from FieldMapping.compatibilityStatus + MigrationLogic existence + MigrationLogic.status. Used by GET endpoint and FieldLink component.
- [ ] T018 Add removal confirmation to FieldMappingView: on delete, show field name pair being removed, warn about migration logic cascade, update parent ObjectMapping progress.

**Checkpoint**: All user stories complete. Full field mapping workflow functional.

---

## Dependencies & Execution Order

- **Phase 1** (T001-T003): Parallel.
- **Phase 2** (T004-T006): Depends on Phase 1. Sequential (same service file).
- **Phase 3** (T007-T015): Depends on Phase 2. T007 first, T008/T009 parallel, T010-T013 parallel, T014 depends on T010-T013, T015 depends on T014.
- **Phase 4** (T016): Depends on Phase 3.
- **Phase 5** (T017-T018): Depends on Phase 3.

### Parallel Opportunities

```
Phase 1: T001 | T002 | T003 (all parallel)
Phase 3: [T008 | T009] parallel, [T011 | T012 | T013] parallel
Phase 4-5: T016 | T017 | T018 (parallel, different files)
```
