# Implementation Plan: Unmapped Fields Detection

**Branch**: `016-unmapped-fields-detection` | **Date**: 2026-04-02 | **Spec**: `specs/016-unmapped-fields-detection/spec.md`

## Summary

Detect and display unmapped source fields and unmapped required destination properties for each object mapping. Enforce Constitution Principle III (Data Fidelity) -- no field is silently ignored. The consultant can mark unmapped source fields as "intentionally excluded" to distinguish deliberate omissions from forgotten ones. This feature provides the data; the field mapping view (012) and object detail modal (011) consume it for display.

## Technical Context

**Language/Version**: TypeScript 5.x on Next.js 14+ (App Router)
**Primary Dependencies**: Next.js Route Handlers, Prisma ORM, shadcn/ui, Connector Interface types (000)
**Storage**: Neon Postgres via Prisma (FieldExclusion table linked to ObjectMapping, isolated per tenant)
**Testing**: Vitest (unit + integration, against real Postgres via Neon branch or Docker)
**Target Platform**: Next.js sur Vercel (dev sur localhost)
**Project Type**: Web application (unified Next.js)
**Constraints**: Computation must handle 200+ source fields per object without perceivable delay

## Constitution Check

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Spec-First | PASS | spec.md approved |
| II | Readability | PASS | Simple set-difference computation, no complex algorithms |
| III | Data fidelity | PASS | **Core feature**: explicitly implements Principle III -- every unmapped field is visible |
| IV | Tests on real data | PASS | Tests with realistic field counts, including objects with 100+ fields |
| V | Idempotence | PASS | Exclusion is a toggle; computation is pure read |
| VI | Traceability | PASS | Exclusion/un-exclusion actions logged to audit trail |
| VII | Observability | PASS | Console logs for unmapped field computation results |
| VIII | Modularity | PASS | Isolated behind UnmappedFieldsService; data consumed by 011 and 012 via API |
| IX | Human-in-the-loop | PASS | Détection passive — calcule l'écart et l'affiche, ne supprime jamais un field ; l'exclusion d'un field est une action explicite du consultant ("intentionally excluded") |

## Project Structure

### Documentation

```text
specs/016-unmapped-fields-detection/
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
│   └── api/plans/[planId]/object-mappings/[mappingId]/
│       ├── unmapped/route.ts                       # GET unmapped fields
│       └── exclusions/
│           ├── route.ts                            # POST create, POST bulk-create
│           └── [exclusionId]/route.ts              # DELETE remove exclusion
├── components/mapping/
│   ├── UnmappedFieldsPanel.tsx                     # Warning panel for unmapped fields
│   ├── UnmappedFieldRow.tsx                        # Single unmapped field with exclude action
│   └── ExcludedFieldsSection.tsx                   # Collapsed section showing excluded fields
├── lib/
│   ├── services/unmapped-fields.ts                 # Computation: unmapped source + dest fields
│   └── types/mapping.ts                            # Extended with UnmappedFields types
└── hooks/
    └── use-unmapped-fields.ts                      # React hook for unmapped state + exclusion actions

tests/
├── unit/services/unmapped-fields.test.ts
└── integration/api/unmapped-fields.test.ts
```

**Structure Decision**: Unmapped fields data is exposed via an API endpoint on the object mapping. The UI panel is integrated into the field mapping view (012). Exclusions are a separate CRUD endpoint.
