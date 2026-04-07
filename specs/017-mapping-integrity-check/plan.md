# Implementation Plan: Mapping Integrity Check

**Branch**: `017-mapping-integrity-check` | **Date**: 2026-04-02 | **Spec**: `specs/017-mapping-integrity-check/spec.md`

## Summary

Detect broken mappings after schema changes. When a source or destination schema is refreshed, the system checks all mapping plans referencing that connection for: deleted objects, deleted fields, and type changes that break compatibility. Broken entities are flagged with persistent IntegrityIssue records, and the plan status transitions to BROKEN. Issues are resolved when the consultant fixes (remaps or removes) the affected mappings.

## Technical Context

**Language/Version**: TypeScript 5.x on Next.js 14+ (App Router)
**Primary Dependencies**: Next.js Route Handlers, Prisma ORM, type-compatibility service (012), Connector Interface types (000)
**Storage**: SQLite via Prisma (IntegrityIssue table linked to MigrationPlan)
**Testing**: Vitest (unit + integration)
**Target Platform**: Local-first web application (localhost)
**Project Type**: Web application (unified Next.js)
**Constraints**: Integrity check must complete within 5 seconds for 10 object mappings with 200 field mappings

## Constitution Check

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Spec-First | PASS | spec.md approved |
| II | Readability | PASS | Straightforward comparison logic; each check type is a separate function |
| III | Data fidelity | PASS | **Core feature**: ensures mapping plan stays consistent with actual schemas |
| IV | Tests on real data | PASS | Tests with realistic schema diffs (field deletions, type changes, object removals) |
| V | Idempotence | PASS | Running integrity check twice produces same results; issues are not duplicated |
| VI | Traceability | PASS | All integrity check results and plan status transitions logged to audit trail |
| VII | Observability | PASS | Console logs for each issue detected, plan status changes |
| VIII | Modularity | PASS | Isolated behind IntegrityCheckService; uses type-compatibility from 012; triggered by schema refresh (003/007), not internally coupled |

## Project Structure

### Documentation

```text
specs/017-mapping-integrity-check/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── api.md
└── tasks.md
```

### Source Code

```text
src/
├── app/
│   └── api/plans/[planId]/
│       └── integrity/
│           └── route.ts                            # GET issues, POST trigger check
├── components/mapping/
│   ├── IntegrityIssuesBanner.tsx                   # Plan-level banner showing broken status
│   └── IntegrityIssueRow.tsx                       # Single issue display with resolution action
├── lib/
│   ├── services/integrity-check.ts                 # Core integrity check logic
│   └── types/mapping.ts                            # Extended with IntegrityIssue types
└── hooks/
    └── use-integrity-issues.ts                     # React hook for integrity state

tests/
├── unit/services/integrity-check.test.ts
└── integration/api/integrity-check.test.ts
```

**Structure Decision**: Integrity check is a plan-level concern (not per-object-mapping), so the API sits at `/api/plans/[planId]/integrity/`. The check is triggered by schema refresh features (003, 007) calling the IntegrityCheckService, or manually via the POST endpoint.
