# Tasks: Mapping Integrity Check

**Input**: Design documents from `specs/017-mapping-integrity-check/`
**Prerequisites**: Features 011 (Object Mapping), 012 (Field Mapping), 015 (Migration Filters) implemented

**Status legend**:
- `[ ]` = not started
- `[~]` = partially implemented — see note
- `[x]` = done
- `[-]` = explicitly deferred — see MVP scope note below

## MVP scope (2026-05-12, after live test session)

The original spec assumed full IntegrityIssue persistence with a UI banner. The live test exposed the more urgent problem: **the hook from schema refresh was never wired**, so broken mappings are invisible and the plan status never transitions to BROKEN. The MVP focuses on closing that loop with the **minimum** code:

- **In MVP**: T002 (types), T003 (service core, in-memory report — keep as-is), T004 (plan status update from the check, not only from repair), T005 (API route), T006 (refresh hook), T007 (auto-resolve when consultant deletes a broken mapping), plus the new **T011** below (read-time apiName resolution in field/object mapping services) and **T012** (BROKEN linkStatus + UI guard).
- **Deferred to a later iteration**: T001 (persistent IntegrityIssue model — current in-memory report is sufficient for plan status + UI banner derived from the live report), T009/T010 (banner + row components — simpler treatment per-mapping is enough for MVP).

The deferred tasks stay in this file with `[-]` so they remain visible as roadmap.

## Phase 1: Setup

- [-] T001 [P] **DEFERRED to v2** — Add IntegrityIssue model to `prisma/schema.prisma` with unique constraint on (entityType, entityId, issueType), indexes on migrationPlanId and entityId, relation to MigrationPlan with cascade. Run `npx prisma migrate dev --name add-integrity-issue`. *(MVP uses an in-memory IntegrityReport returned by `checkMappingIntegrity` and stored only via plan.status + audit log.)*
- [~] T002 [P] Extend mapping types in `src/lib/types/mapping.ts`: IntegrityIssueDTO, IssueType enum (SOURCE_OBJECT_DELETED, DESTINATION_OBJECT_DELETED, SOURCE_FIELD_DELETED, DESTINATION_FIELD_DELETED, TYPE_CHANGE_INCOMPATIBLE, REFERENCED_FIELD_DELETED), EntityType enum (OBJECT_MAPPING, FIELD_MAPPING, MIGRATION_FILTER), IntegrityCheckResult. *(In-memory types live in `src/lib/types/integrity.ts` — IntegrityReport, BrokenObjectMapping, BrokenFieldMapping, TypeChange. DTO/Issue enums for persistence deferred with T001.)*

---

## Phase 2: Foundational (Service Layer)

- [~] T003 Create IntegrityCheckService in `src/lib/services/integrity-check.ts` *(actual file: `src/lib/services/mapping-integrity.ts`)* with the following methods:
  - `run(planId)`: Full integrity check. *(Implemented as `checkMappingIntegrity(planId)`. Returns in-memory `IntegrityReport`. Does NOT yet persist IntegrityIssue records — deferred with T001.)*
  - `resolveForEntity(entityId)`: *(NOT implemented. Auto-resolution on delete depends on this — see T007.)*
  - `getActiveIssues(planId)`: *(NOT implemented as a separate method. Callers re-run `checkMappingIntegrity` to get the current state — acceptable for MVP since the check is fast.)*
- [~] T004 Add plan status management to IntegrityCheckService: after `run()` or `resolveForEntity()`, check if any active issues remain. If yes, ensure plan status is BROKEN. If no, transition plan status back to DRAFT (or READY if all mappings are complete). *(Implemented inside `repairBrokenMappings` only. **Missing**: same status update inside `checkMappingIntegrity` — must be added so the integrity check itself flips plan.status without requiring a repair call.)*

**Checkpoint**: Service layer complete. Integrity check logic testable with schema snapshots.

---

## Phase 3: Single User Story - Integrity Detection and Display (Priority: P1)

**Goal**: Automatic integrity check after schema refresh, plan-level issue display, and resolution on mapping fix.

### Implementation

- [x] T005 Create API route handlers in `src/app/api/plans/[planId]/integrity/route.ts`: GET (list active issues with summary), POST (trigger integrity check, return new + resolved issues). *(Done. GET = check, POST = repair.)*
- [ ] T006 **CRITICAL — MVP** Add integrity check hook to schema refresh flow: in the schema refresh service (features 003/007), add a call to `checkMappingIntegrity(planId)` at the end of `retrieveSchema` (after migrateSelection + fields retrieval). This is the integration point that closes the loop — without it, broken mappings stay invisible.
- [ ] T007 **MVP** Add auto-resolution to ObjectMappingService and FieldMappingService: when a mapping is deleted, re-run `checkMappingIntegrity` and update `plan.status` accordingly. *(Without persistent IntegrityIssue records — T001 deferred — the simplest implementation is to re-check and update plan.status at the end of each delete.)* When a FieldMapping is created (remapped), same re-check.
- [ ] T008 [-] **DEFERRED to v2** Create React hook in `src/hooks/use-integrity-issues.ts`: fetches active issues for a plan, provides re-check action, auto-refreshes after mapping changes. *(MVP renders broken-state per-mapping inside FieldMappingView; a plan-level hook can come later.)*
- [ ] T009 [P] [-] **DEFERRED to v2** Create IntegrityIssueRow component in `src/components/mapping/IntegrityIssueRow.tsx`: displays issue type icon, description, affected entity link, and "Fix" action hint.
- [ ] T010 [-] **DEFERRED to v2** Create IntegrityIssuesBanner component in `src/components/mapping/IntegrityIssuesBanner.tsx`: plan-level banner shown when plan status is BROKEN. Red background. Shows issue count and expandable list. Displayed at the top of the mapping page (011) and plan detail page (001).

### New tasks added 2026-05-12 (live test outcome)

- [ ] T011 **MVP** Make field/object mapping services tolerant to stale FK references after snapshot rotation. The stored `ObjectMapping.sourceObjectId/destObjectId` and `FieldMapping.sourceFieldId/destFieldId` may point at the PREVIOUS snapshot (or a deleted snapshot after a second refresh). Refactor `getUnmappedSourceFields(mappingId)`, `getAvailableDestFields(mappingId)`, `listFieldMappings(mappingId)`, `listObjectMappings(planId)` to resolve the source/destination object's fields via the **current** snapshot by `sourceObjectApiName`/`destObjectApiName`, not by stored FK id. The stored FK is a hint only. **No DB write** — read-time resolution only (Principle IX: this is not automation, it's the only way to render a broken mapping).
- [ ] T012 **MVP** Add `BROKEN` to `LinkStatus` enum in `src/lib/types/field-mapping.ts`. Update `computeLinkStatus()` in `src/lib/services/field-mapping.ts` to return `BROKEN` when sourceField or destField cannot be resolved by apiName in the current snapshot, or when the field's current type is now incompatible. Update `FieldMappingView` (and child rendering components) to display BROKEN mappings with a red badge, disabled controls (no remap attempt by selecting a new dest field — the consultant must delete and recreate), and a one-line explanation ("Le champ source [X] n'existe plus dans le schéma actuel — supprimez puis recréez ce mapping").

---

## Dependencies & Execution Order

- **Phase 1** (T001-T002): T001 deferred. T002 partially done — review and complete if needed.
- **Phase 2** (T003-T004): Both partial. T004's missing branch (status update from `check`, not only from `repair`) is required for T006 to actually flip plan.status after refresh.
- **Phase 3** (T005-T012):
  - T005 done.
  - **T006 + T011 + T012** are the MVP critical path. Order:
    1. T011 first (services tolerate stale FK — needed so the UI can render mappings post-refresh)
    2. T012 (compute + render BROKEN linkStatus)
    3. T006 (hook the integrity check; closes the loop with plan status)
    4. T007 (auto-rerun on delete/remap)
  - T008/T009/T010 deferred to v2.

### Parallel Opportunities (MVP)

```
T011 | T012 (different files: services vs types+UI)
T006 | T007 (different services: schema-retrieval vs field/object-mapping)
```
