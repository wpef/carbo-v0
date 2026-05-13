# Implementation Plan: Destination Field Retrieval

**Branch**: `008-destination-field-retrieval` | **Date**: 2026-04-02 | **Spec**: `specs/008-destination-field-retrieval/spec.md`

## Summary

Retrieve all fields/properties for each destination object so the consultant can see what they can map to. Follows the same pattern as 005-source-field-retrieval, reusing `ObjectField` entity and the field retrieval service. Key difference: fields are retrieved for ALL destination objects (no selection step), not just selected ones.

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: Next.js 14+ (App Router), Prisma ORM
**Storage**: Neon Postgres via Prisma — reuses `ObjectField` table from 005 (isolated per tenant)
**Testing**: Vitest (unit + integration, against real Postgres via Neon branch or Docker)
**Target Platform**: Next.js 14+ (App Router) sur Vercel
**Project Type**: Web application (unified Next.js project)
**Performance Goals**: Field retrieval for all destination objects completes in under 60 seconds
**Constraints**: All destination objects have fields retrieved (no selection gate). Fields include: label, apiName, dataType, isRequired, isReadOnly, isUnique, referenceTo.
**Scale/Scope**: 1 API route, service reuse from 005, 1 UI page section

## Constitution Check

| # | Principle | Status | Justification |
|---|-----------|--------|---------------|
| I | Spec-First | PASS | spec.md approved |
| II | Readability | PASS | Mirrors source field retrieval; no new abstractions |
| III | Data fidelity | PASS | All fields preserved including inaccessible ones (with badge) |
| IV | Tests on real data | PASS | Integration tests with demo adapter returning realistic field metadata |
| V | Idempotence | PASS | Re-retrieving fields replaces previous data cleanly |
| VI | Traceability | PASS | Field retrieval logged to audit trail |
| VII | Observability | PASS | Console logs for retrieval progress (per-object field count) |
| VIII | Modularity | PASS | Reuses ObjectField entity; field retrieval service shared with 005 |
| IX | Human-in-the-loop | PASS | Récupération déclenchée par le consultant ou la chaîne post-OAuth ; aucune décision auto, juste un fetch de métadonnées |

## Project Structure

### Documentation (this feature)

```text
specs/008-destination-field-retrieval/
├── spec.md
├── plan.md              # This file
├── research.md
├── data-model.md        # Skipped (reuses ObjectField from 005)
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
│   │           └── destination-fields/
│   │               └── route.ts               # POST (retrieve all), GET (fields by object)
│   └── plans/
│       └── [planId]/
│           └── destination/
│               └── fields/
│                   └── page.tsx               # Destination fields UI (object accordion + field table)
├── components/
│   └── schema/
│       └── field-table.tsx                    # Reusable: displays fields with type/constraint badges
│                                              # (shared with source, from 005)
├── lib/
│   └── services/
│       └── field-retrieval.service.ts         # Shared service from 005 (connection-agnostic)

tests/
├── unit/
│   └── services/
│       └── destination-field-retrieval.test.ts
└── integration/
    └── destination-field-retrieval.test.ts
```

**Structure Decision**: Field retrieval service from 005 is generic (works with any connection + schema snapshot). The route handler retrieves fields for all destination objects in one call. The field-table component is shared.
