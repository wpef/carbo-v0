# Implementation Plan: Destination Field Retrieval

**Branch**: `008-destination-field-retrieval` | **Date**: 2026-05-18 | **Spec**: `specs/008-destination-field-retrieval/spec.md`

## Summary

Retrieve and persist field metadata for all destination objects after schema retrieval (007). Mirrors the source-side pattern (005) but with two key differences: (1) no object-selection step -- fields are retrieved for all objects in the destination schema, and (2) fields carry destination-specific badges (read-only, required) that are critical for downstream mapping validation. The feature reuses the existing `ConnectorAdapter.getFields()` interface and the `ObjectField` Prisma model established by 005.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), Next.js 14+ App Router
**Primary Dependencies**: Prisma ORM, Tailwind CSS, shadcn/ui, React 18+
**Storage**: Neon Postgres (via Prisma) -- ObjectField table (same model as 005, scoped by connectionId/snapshotId)
**Testing**: Vitest (unit + integration)
**Target Platform**: Vercel (serverless)
**Project Type**: Full-stack web application (Next.js unified)
**Performance Goals**: Field retrieval for all destination objects completes in <60s for 50 objects (SC from 005 applies)
**Constraints**: Must follow the same adapter pattern as 005; no object-selection step for destination

## Constitution Check

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Spec-First | PASS | spec.md approved with 3 FRs + 2 acceptance scenarios |
| II | Readability | PASS | Mirrors 005 patterns; no new abstractions |
| III | Data fidelity | PASS | All fields retrieved and persisted; no silent omissions (inherited from 005 FR-004) |
| IV | Tests on real data | PASS | Integration tests with realistic field metadata fixtures |
| V | Idempotence | PASS | Re-retrieval replaces previous fields atomically; same result on re-run |
| VI | Traceability | PASS | FR-003: field retrieval logged to audit trail |
| VII | Observability | PASS | Console logs for retrieval start, per-object progress, completion summary |
| VIII | Modularity | PASS | Service function in destination feature module; reuses shared field service from 005 |
| IX | Human-in-the-loop | N/A | No automation decisions -- pure data retrieval |

## Architecture

### Source Code Layout

```
src/
├── app/
│   └── plans/
│       └── [planId]/
│           └── destination/
│               ├── schema/
│               │   └── page.tsx                # Object list with field expansion (existing from 007)
│               └── fields/
│                   └── page.tsx                # Dedicated fields view per object (optional)
├── features/
│   └── destination/
│       ├── components/
│       │   ├── destination-field-list.tsx      # Field table with badges (read-only, required)
│       │   └── destination-object-fields.tsx   # Object expandable panel showing fields
│       ├── hooks/
│       │   └── use-destination-fields.ts       # SWR/fetch hook for field retrieval
│       └── services/
│           └── destination-field-service.ts    # Server-side: retrieve + persist fields for all objects
├── features/
│   └── shared/
│       └── services/
│           └── field-service.ts               # Shared field retrieval logic (from 005, reused)
├── lib/
│   ├── prisma.ts
│   ├── audit.ts
│   └── types/
│       └── connector.ts                       # ConnectorField type (from 000)
├── api/
│   └── plans/
│       └── [planId]/
│           └── destination/
│               └── fields/
│                   └── route.ts               # POST (trigger retrieval) + GET (list fields)
prisma/
└── schema.prisma                              # ObjectField model (from 005, shared)
tests/
└── integration/
    └── destination/
        └── destination-fields.test.ts
```

### Key Dependencies Between Files

- `destination-field-service.ts` -> `field-service.ts` (shared logic) -> `ConnectorAdapter.getFields()`
- `destination-field-service.ts` -> `prisma.ts` + `audit.ts`
- `use-destination-fields.ts` -> `GET/POST /api/plans/[planId]/destination/fields`
- `destination-field-list.tsx` -> field data from hook

## Phases

### Phase 0: Research
See `research.md` -- decisions on reuse of 005 patterns, no object-selection gate.

### Phase 1: Design
See `data-model.md` (ObjectField reuse), `contracts/api.md` (API routes).

### Phase 2: Implementation
See `tasks.md`.

## Complexity Tracking

No constitution violations identified. The feature is a direct mirror of 005 with simplified scope (no object selection).
