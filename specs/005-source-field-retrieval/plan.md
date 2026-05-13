# Implementation Plan: Source Field Retrieval

**Branch**: `005-source-field-retrieval` | **Date**: 2026-04-02 | **Spec**: `specs/005-source-field-retrieval/spec.md`

## Summary

After confirming object selection, the consultant retrieves field metadata for all selected objects. Fields are displayed with label, API name, data type, constraints (required, read-only, unique), accessibility status, and relationship info. Fields are persisted and updated when object selection changes. This is the final step of the source chain before mapping can begin.

## Technical Context

**Language/Version**: TypeScript 5.x on Next.js 14+ (App Router)
**Primary Dependencies**: Next.js Route Handlers, Prisma ORM, shadcn/ui, Connector Interface types (000)
**Storage**: Neon Postgres via Prisma (ObjectField table, isolated per tenant)
**Testing**: Vitest (unit + integration, against real Postgres via Neon branch or Docker)
**Target Platform**: Next.js sur Vercel (dev sur localhost)
**Project Type**: Web application (unified Next.js)
**Performance Goals**: Field retrieval for 50 objects < 60 seconds
**Constraints**: Retrieve fields only for selected objects (not full schema); handle partial failures gracefully

## Constitution Check

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Spec-First | PASS | spec.md approved |
| II | Readability | PASS | Standard per-object iteration pattern, no complex abstractions |
| III | Data fidelity | PASS | No silent field omissions; inaccessible fields listed with badge (FR-004) |
| IV | Tests on real data | PASS | Field retrieval tested with realistic Salesforce-like fixtures (mixed types, relationships) |
| V | Idempotence | PASS | Re-retrieving fields replaces existing data; no side effects |
| VI | Traceability | PASS | Every retrieval logged with field count per object (FR-007) |
| VII | Observability | PASS | Console logs for per-object retrieval progress, errors, total field count |
| VIII | Modularity | PASS | Isolated FieldRetrieval service; depends on 004 via objectId/snapshotId only |
| IX | Human-in-the-loop | PASS | Récupération déclenchée par le consultant ou par la chaîne post-OAuth (cf. 002/006) ; aucune décision auto, juste un fetch de métadonnées |

## Project Structure

### Source Code

```text
src/
├── app/
│   ├── plans/[planId]/source/fields/      # Field retrieval step page
│   └── api/plans/[planId]/source/fields/
│       ├── route.ts                        # POST trigger retrieval, GET all fields
│       └── [objectId]/
│           └── route.ts                    # GET fields for specific object
├── components/fields/
│   ├── FieldTable.tsx                     # Table of fields for one object
│   ├── FieldRow.tsx                       # Single field row with type, constraints, badges
│   ├── FieldRetrievalProgress.tsx         # Progress indicator during batch retrieval
│   └── ObjectFieldAccordion.tsx           # Accordion of objects, each expandable to show fields
├── lib/
│   ├── services/field-retrieval.ts        # Domain logic: retrieve, persist, cleanup
│   └── types/field.ts                     # TypeScript types
└── hooks/
    └── use-fields.ts                      # React hook for field state

prisma/schema.prisma                       # ObjectField model

tests/
├── unit/services/field-retrieval.test.ts
└── integration/api/field-retrieval.test.ts
```

**Structure Decision**: Field retrieval is the final sub-step of the source flow. The page lives under `plans/[planId]/source/fields/`. Fields are retrieved in batch for all selected objects, with per-object progress reporting.

**Règle — instanciation d'adaptateur** : Le service `field-retrieval.ts` DOIT instancier les adaptateurs exclusivement via la factory canonique `src/lib/connectors/adapter-factory.ts`. Toute factory locale est interdite : elle échoue silencieusement dès qu'un nouvel adaptateur est ajouté sans que le service soit mis à jour (incident constaté en test live SF le 2026-04-23).
