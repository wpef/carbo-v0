# Implementation Plan: Source Schema Retrieval

**Branch**: `003-source-schema-retrieval` | **Date**: 2026-04-02 | **Spec**: `specs/003-source-schema-retrieval/spec.md`

## Summary

After connecting to a source, the consultant retrieves the full list of objects from the connected system. The system persists schema snapshots (max 2: CURRENT + PREVIOUS), computes diffs between them, and displays the results. This feature is the foundation for object selection (004) and field retrieval (005).

## Technical Context

**Language/Version**: TypeScript 5.x on Next.js 14+ (App Router)
**Primary Dependencies**: Next.js Route Handlers, Prisma ORM, shadcn/ui, Connector Interface types (000)
**Storage**: Neon Postgres via Prisma (SchemaSnapshot + SchemaObject tables, isolated per tenant)
**Testing**: Vitest (unit + integration, against real Postgres via Neon branch or Docker)
**Target Platform**: Next.js sur Vercel (dev sur localhost)
**Project Type**: Web application (unified Next.js)
**Performance Goals**: Full retrieval < 60 seconds for up to 2000 objects
**Constraints**: Max 2 snapshots per connection; no concurrent retrievals

## Constitution Check

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Spec-First | PASS | spec.md approved |
| II | Readability | PASS | Snapshot rotation is simple (CURRENT -> PREVIOUS -> delete oldest) |
| III | Data fidelity | PASS | 100% of adapter-reported objects stored; no silent omissions (SC-002) |
| IV | Tests on real data | PASS | Diff computation tested with realistic multi-object fixtures |
| V | Idempotence | PASS | Repeated retrieval replaces PREVIOUS, no cumulative side effects |
| VI | Traceability | PASS | Every retrieval logged with timestamp, object count, diff summary (FR-008) |
| VII | Observability | PASS | Console logs for retrieval start/end, object count, errors |
| VIII | Modularity | PASS | Isolated SchemaService; communicates with 002 via connectionId only |
| IX | Human-in-the-loop | PASS | Rotation CURRENT→PREVIOUS sans re-binding silencieux des FK ; refresh ne déclenche jamais d'auto-remap ; les mappings cassés sont marqués via 017 (jamais auto-supprimés) |

## Project Structure

### Source Code

```text
src/
├── app/
│   ├── plans/[planId]/source/schema/    # Schema retrieval step UI (sub-step of source)
│   └── api/plans/[planId]/source/schema/
│       └── route.ts                      # POST retrieve, GET current snapshot
├── components/schema/
│   ├── ObjectList.tsx                    # List of schema objects with badges
│   ├── SchemaDiff.tsx                    # Diff display (added/removed/modified)
│   └── SchemaRetrievalButton.tsx         # Trigger retrieval with loading state
├── lib/
│   ├── services/schema-retrieval.ts      # Domain logic: retrieve, snapshot rotation, diff
│   └── types/schema.ts                   # SchemaSnapshot, SchemaObject, SchemaDiff types
└── hooks/
    └── use-schema.ts                     # React hook for schema state

prisma/schema.prisma                      # SchemaSnapshot + SchemaObject models

tests/
├── unit/services/schema-retrieval.test.ts
└── integration/api/schema-retrieval.test.ts
```

**Structure Decision**: Schema retrieval is a sub-step of the source configuration flow. The page lives under `plans/[planId]/source/schema/` to maintain the plan-scoped hierarchy.
