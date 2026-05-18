# Implementation Plan: Mapping Integrity Check

**Branch**: `017-mapping-integrity-check` | **Date**: 2026-05-18 | **Spec**: `specs/017-mapping-integrity-check/spec.md`

## Summary

Post-schema-refresh integrity engine that detects broken mappings (deleted objects/fields, incompatible type changes, orphaned filters/rules) and transitions the plan to BROKEN status. The consultant resolves issues manually via a repair UI -- no automatic re-binding (Principle IX). This feature gates document generation (019/020): a BROKEN plan cannot proceed.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: Prisma ORM (query layer), existing mapping models (011/012/013), type compatibility matrix (012), AuditLog (001)
**Storage**: Neon Postgres via Prisma -- `IntegrityIssue` persisted table + status transitions on `MigrationPlan`, `ObjectMapping`, `FieldMapping`
**Testing**: Vitest -- unit tests for the check engine with realistic fixtures (10 object mappings, 200 field mappings); integration tests against a real Postgres
**Target Platform**: Next.js Route Handlers (API) + React components (UI badges/banners)
**Project Type**: Backend service + thin UI layer
**Constraints**: No automatic FK re-binding (Principle IX); apiName-based resolution only; synchronous execution after schema refresh

## Constitution Check

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Spec-First | PASS | spec.md approved with design decisions |
| II | Readability | PASS | Single-responsibility engine; named issue types, no magic constants |
| III | Data fidelity | PASS | No silent re-binding; broken mappings flagged, never auto-healed |
| IV | Tests on real data | PASS | Realistic fixtures: 10 objects, 200 fields, type changes, deletions |
| V | Idempotence | PASS | Re-running check on same snapshot produces identical issues; resolved issues stay resolved |
| VI | Traceability | PASS | All check results and status transitions logged to AuditLog |
| VII | Observability | PASS | Console logging at each check phase (start, issues found, status transition) |
| VIII | Modularity | PASS | Isolated service at `src/lib/services/integrity/`; public API = 2 functions |
| IX | Human-in-the-loop | PASS | Core design: no auto-remap, no auto-delete, consultant resolves manually |

## Architecture

```
src/
  lib/
    services/
      integrity/
        check-engine.ts           # Core: runIntegrityCheck(planId) -> IntegrityCheckResult
        issue-resolver.ts         # resolveIssue(issueId), bulkResolveByPlan(planId)
        index.ts                  # Public API barrel
    types/
      integrity.ts                # IntegrityIssue types, enums, DTOs
  app/
    api/
      plans/
        [planId]/
          integrity/
            route.ts              # GET  -> run check, return issues
            [issueId]/
              route.ts            # PATCH -> resolve/dismiss an issue
            resolve-all/
              route.ts            # POST -> bulk resolve all issues for plan
```

### Data Flow

```
Schema Refresh (003/007)
  -> POST /api/plans/[planId]/integrity (or auto-triggered by refresh handler)
    -> checkEngine.runIntegrityCheck(planId)
      -> Load plan + all ObjectMappings + FieldMappings + MigrationFilters + MigrationLogic
      -> For each ObjectMapping: resolve sourceObjectApiName against CURRENT snapshot
      -> For each FieldMapping: resolve sourceFieldApiName + destFieldApiName against CURRENT snapshot
      -> For each MigrationFilter: resolve sourceFieldApiName against CURRENT snapshot
      -> For each FIELD_REFERENCE rule: resolve referenced field against CURRENT snapshot
      -> Collect IntegrityIssue[] (new + existing unresolved)
      -> Persist new issues, update plan status
      -> Log to AuditLog
    -> Return { issues, planStatus, checkedAt }
```

## Phases

### Phase 0: Research
See `research.md` -- type compatibility matrix reuse, apiName resolution strategy, performance.

### Phase 1: Design
See `data-model.md` (IntegrityIssue Prisma model), `contracts/api.md` (API routes + DTOs).

### Phase 2: Implementation
See `tasks.md` -- 3 phases: types + model, engine + API, UI integration.
