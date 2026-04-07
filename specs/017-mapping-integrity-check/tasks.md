# Tasks: Mapping Integrity Check

**Input**: Design documents from `specs/017-mapping-integrity-check/`
**Prerequisites**: Features 011 (Object Mapping), 012 (Field Mapping), 015 (Migration Filters) implemented

## Phase 1: Setup

- [ ] T001 [P] Add IntegrityIssue model to `prisma/schema.prisma` with unique constraint on (entityType, entityId, issueType), indexes on migrationPlanId and entityId, relation to MigrationPlan with cascade. Run `npx prisma migrate dev --name add-integrity-issue`.
- [ ] T002 [P] Extend mapping types in `src/lib/types/mapping.ts`: IntegrityIssueDTO, IssueType enum (SOURCE_OBJECT_DELETED, DESTINATION_OBJECT_DELETED, SOURCE_FIELD_DELETED, DESTINATION_FIELD_DELETED, TYPE_CHANGE_INCOMPATIBLE, REFERENCED_FIELD_DELETED), EntityType enum (OBJECT_MAPPING, FIELD_MAPPING, MIGRATION_FILTER), IntegrityCheckResult.

---

## Phase 2: Foundational (Service Layer)

- [ ] T003 Create IntegrityCheckService in `src/lib/services/integrity-check.ts` with the following methods:
  - `run(planId)`: Full integrity check. For each ObjectMapping, verify source/dest objects exist in schema. For each FieldMapping, verify source/dest fields exist and types are still compatible (using type-compatibility service from 012). For each MigrationFilter, verify sourceFieldName exists. Creates IntegrityIssue records for new issues, resolves (sets resolvedAt) for issues no longer applicable. Updates plan status to BROKEN if active issues exist. Logs all findings to audit trail.
  - `resolveForEntity(entityId)`: Mark all active issues for an entity as resolved. Called by FieldMappingService/ObjectMappingService on delete/remap.
  - `getActiveIssues(planId)`: Return all unresolved issues for a plan with summary counts.
- [ ] T004 Add plan status management to IntegrityCheckService: after `run()` or `resolveForEntity()`, check if any active issues remain. If yes, ensure plan status is BROKEN. If no, transition plan status back to DRAFT (or READY if all mappings are complete).

**Checkpoint**: Service layer complete. Integrity check logic testable with schema snapshots.

---

## Phase 3: Single User Story - Integrity Detection and Display (Priority: P1)

**Goal**: Automatic integrity check after schema refresh, plan-level issue display, and resolution on mapping fix.

### Implementation

- [ ] T005 Create API route handlers in `src/app/api/plans/[planId]/integrity/route.ts`: GET (list active issues with summary), POST (trigger integrity check, return new + resolved issues).
- [ ] T006 Add integrity check hook to schema refresh flow: in the schema refresh service (features 003/007), add a call to `integrityCheck.run(planId)` after schema snapshot is updated. This is the integration point -- import IntegrityCheckService and call it at the end of the refresh.
- [ ] T007 Add auto-resolution to ObjectMappingService and FieldMappingService: when a mapping is deleted, call `integrityCheck.resolveForEntity(entityId)`. When a FieldMapping is created (remapped), resolve any matching issues for the old entity.
- [ ] T008 Create React hook in `src/hooks/use-integrity-issues.ts`: fetches active issues for a plan, provides re-check action, auto-refreshes after mapping changes.
- [ ] T009 [P] Create IntegrityIssueRow component in `src/components/mapping/IntegrityIssueRow.tsx`: displays issue type icon, description, affected entity link (navigates to object/field mapping), and "Fix" action hint.
- [ ] T010 Create IntegrityIssuesBanner component in `src/components/mapping/IntegrityIssuesBanner.tsx`: plan-level banner shown when plan status is BROKEN. Red background. Shows issue count and expandable list of IntegrityIssueRows. Displayed at the top of the mapping page (011) and plan detail page (001).

**Checkpoint**: Full integrity check workflow complete. Schema changes detected, plan marked BROKEN, issues displayed, auto-resolution on fix.

---

## Dependencies & Execution Order

- **Phase 1** (T001-T002): Parallel.
- **Phase 2** (T003-T004): Depends on Phase 1. Sequential (T004 extends T003).
- **Phase 3** (T005-T010): Depends on Phase 2. T005 first, T006-T007 parallel, T008 next, T009/T010 parallel (T010 depends on T009).

### Parallel Opportunities

```
Phase 1: T001 | T002 (parallel)
Phase 3: T006 | T007 (parallel, different service files)
Phase 3: T009 | T010 (partially parallel -- T010 uses T009)
```
