# Implementation Plan: Mapping Plan

**Branch**: `003-mapping-plan` | **Date**: 2026-03-19 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/003-mapping-plan/spec.md`

## Summary

Build the core mapping plan feature: create object-to-object and field-to-field mappings between
source and destination connectors, add transformation rules (fixed value, field reference, JS
function), validation rules (type check, regex), and migration filters per object. This is the
central feature of Carbo-v0 — it consumes connector schemas and produces the migration specification
that downstream features (documents, execution) depend on.

## Technical Context

**Language/Version**: TypeScript 5.x (Next.js 14+ App Router) — established in 001
**Primary Dependencies**: Next.js, Prisma ORM, Tailwind CSS, shadcn/ui, acorn (JS syntax validation)
**Storage**: SQLite via Prisma (established in 001)
**Testing**: Vitest, Playwright — established in 001
**Target Platform**: Web browser (localhost)
**Project Type**: Web application (single Next.js project)
**Performance Goals**: 50+ field mapping in <30 min; plan with 200+ mappings loads in <3s; JS syntax check <1s
**Constraints**: No migration execution; manual mapping only (no auto-suggest); single source + destination
**Scale/Scope**: Plans up to 5 object mappings, 200+ field mappings, multiple rules per mapping

## Constitution Check

| # | Principle | Status | Evidence |
|---|-----------|--------|----------|
| I | Spec-First | PASS | spec.md completed with clarifications |
| II | Readability over cleverness | PASS | Standard Next.js patterns; no complex abstractions |
| III | Data fidelity | PASS | FR-005 flags unmapped fields explicitly; FR-006 flags unmapped required destination fields; no silent loss |
| IV | Functional tests on real data | PASS | Realistic mapping fixtures with real Salesforce→HubSpot field types |
| V | Idempotence | PASS | Mapping plan is a specification, not an execution — inherently idempotent |
| VI | Traceability by default | PASS | FR-014 logs every mapping operation to audit trail |
| VII | Developer observability | PASS | Console logging on plan operations, rule validation, filter estimation |

## Project Structure

### Source Code (repository root)

```text
src/
├── app/
│   ├── api/
│   │   └── mapping/
│   │       ├── plans/route.ts                            # GET list, POST create
│   │       └── plans/[planId]/
│   │           ├── route.ts                              # GET plan detail, DELETE
│   │           ├── objects/route.ts                      # GET list, POST add object mapping
│   │           └── objects/[objectMappingId]/
│   │               ├── route.ts                          # GET detail, DELETE
│   │               ├── fields/route.ts                   # GET list, POST add field mapping
│   │               ├── fields/[fieldMappingId]/
│   │               │   ├── route.ts                      # GET, PUT, DELETE field mapping
│   │               │   ├── rules/route.ts                # GET list, POST add rule
│   │               │   └── rules/[ruleId]/route.ts       # PUT, DELETE rule
│   │               └── filters/route.ts                  # GET list, POST add, DELETE filter
│   ├── mapping/
│   │   ├── page.tsx                                      # Plans list page
│   │   └── [planId]/
│   │       ├── page.tsx                                  # Plan detail page
│   │       └── components/
│   │           ├── plan-header.tsx                        # Plan name, source/dest info, status
│   │           ├── object-mapping-list.tsx                # List of object mappings in the plan
│   │           ├── field-mapping-table.tsx                # Side-by-side field mapping interface
│   │           ├── unmapped-fields-warning.tsx            # Explicit warning for unmapped fields
│   │           ├── transformation-rule-editor.tsx         # Rule creation/editing (fixed, ref, JS)
│   │           ├── validation-rule-editor.tsx             # Validation rule creation (type, regex)
│   │           ├── js-syntax-validator.tsx                # Inline JS syntax checking
│   │           ├── migration-filter-editor.tsx            # Filter creation and management
│   │           └── mapping-summary.tsx                    # Overview of plan completeness
├── lib/
│   └── mapping/
│       ├── plan-service.ts                               # CRUD for mapping plans
│       ├── object-mapping-service.ts                     # CRUD for object mappings
│       ├── field-mapping-service.ts                      # CRUD for field mappings + rules
│       ├── filter-service.ts                             # Migration filter management
│       ├── validation.ts                                 # JS syntax validation, type compatibility
│       ├── integrity-checker.ts                          # Detect broken mappings after schema changes
│       └── types.ts                                      # Mapping-specific types

tests/
├── unit/
│   └── mapping/
│       ├── validation.test.ts
│       ├── integrity-checker.test.ts
│       └── filter-service.test.ts
└── fixtures/
    └── mapping/
        ├── salesforce-to-hubspot-contacts.json           # Realistic mapping fixture
        └── multi-object-plan.json                        # Plan with multiple object mappings
```

**Structure Decision**: Mapping is a new domain (not a connector), so it gets its own top-level
directories: `lib/mapping/` for business logic, `app/mapping/` for UI, `app/api/mapping/` for
API routes. This keeps connectors and mapping clearly separated.

## Complexity Tracking

> No Constitution violations. This section is intentionally empty.
