# Implementation Plan: Destination Schema Retrieval

**Branch**: `007-destination-schema-retrieval` | **Date**: 2026-04-02 | **Spec**: `specs/007-destination-schema-retrieval/spec.md`

## Summary

After connecting a destination, retrieve the full list of destination objects and persist them as a schema snapshot. Follows the same CURRENT/PREVIOUS rotation and diff pattern established in 003-source-schema-retrieval, reusing `SchemaSnapshot` and `SchemaObject` entities. The key difference: destination schema retrieval fetches ALL objects (no selection step for destination).

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: Next.js 14+ (App Router), Prisma ORM
**Storage**: SQLite via Prisma — reuses `SchemaSnapshot` + `SchemaObject` tables from 003
**Testing**: Vitest (unit + integration)
**Target Platform**: Next.js App Router, Node.js
**Project Type**: Web application (unified Next.js project)
**Performance Goals**: Schema retrieval completes in under 60 seconds for up to 2000 objects
**Constraints**: Max 2 snapshots per connection (CURRENT + PREVIOUS). Destination objects are not selected — all are available for mapping.
**Scale/Scope**: 1 API route, 1 service, 1 UI section, schema diff reuse

## Constitution Check

| # | Principle | Status | Justification |
|---|-----------|--------|---------------|
| I | Spec-First | PASS | spec.md approved |
| II | Readability | PASS | Mirrors source schema retrieval pattern from 003 |
| III | Data fidelity | PASS | 100% of objects from adapter preserved in snapshot |
| IV | Tests on real data | PASS | Integration tests with demo adapter returning realistic object list |
| V | Idempotence | PASS | Re-retrieving schema produces clean CURRENT/PREVIOUS rotation |
| VI | Traceability | PASS | Every retrieval logged to audit trail |
| VII | Observability | PASS | Console logs for retrieval start, object count, diff summary |
| VIII | Modularity | PASS | Reuses SchemaSnapshot/SchemaObject; service isolated behind public API |

## Project Structure

### Documentation (this feature)

```text
specs/007-destination-schema-retrieval/
├── spec.md
├── plan.md              # This file
├── research.md
├── data-model.md        # Skipped (reuses SchemaSnapshot + SchemaObject from 003)
├── quickstart.md
├── contracts/
│   └── api.md
└── tasks.md
```

### Source Code

```text
src/
├── app/
│   ├── api/
│   │   └── plans/
│   │       └── [planId]/
│   │           └── destination-schema/
│   │               └── route.ts               # POST (retrieve), GET (current snapshot + objects)
│   └── plans/
│       └── [planId]/
│           └── destination/
│               └── schema/
│                   └── page.tsx               # Destination object list + diff UI
├── components/
│   └── schema/
│       ├── object-list.tsx                    # Reusable: displays objects with badges (shared with source)
│       └── schema-diff.tsx                    # Reusable: displays added/removed/modified objects
├── lib/
│   └── services/
│       └── schema-retrieval.service.ts        # Shared service: retrieve schema for any connection
│                                              # (already created in 003, extended if needed)

tests/
├── unit/
│   └── services/
│       └── destination-schema-retrieval.test.ts
└── integration/
    └── destination-schema-retrieval.test.ts
```

**Structure Decision**: The schema retrieval service from 003 is generic (works with any connection). The only new code is the route handler (scoped to destination) and the destination schema UI page. Object list and diff components are shared with source.
