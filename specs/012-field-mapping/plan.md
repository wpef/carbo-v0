# Implementation Plan: Field Mapping

**Branch**: `012-field-mapping` | **Date**: 2026-04-02 | **Spec**: `specs/012-field-mapping/spec.md`

## Summary

Map source fields to destination properties within an object mapping, with type compatibility checks and color-coded link status. Provides a two-column field view (mirroring the object mapping pattern), auto-matching of native field correspondences, field detail modals with fill rate and picklist info, and one-to-one mapping enforcement. This feature is the primary workspace where consultants spend most of their time.

## Technical Context

**Language/Version**: TypeScript 5.x on Next.js 14+ (App Router)
**Primary Dependencies**: Next.js Route Handlers, Prisma ORM, shadcn/ui, Connector Interface types (000), ObjectMapping (011)
**Storage**: Neon Postgres via Prisma (FieldMapping table linked to ObjectMapping, isolated per tenant)
**Testing**: Vitest (unit + integration, against real Postgres via Neon branch or Docker)
**Target Platform**: Next.js sur Vercel (dev sur localhost)
**Project Type**: Web application (unified Next.js)
**Constraints**: Field view must render 200+ fields per side within 2 seconds; one-to-one mapping strictly enforced

## Constitution Check

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Spec-First | PASS | spec.md approved and complete |
| II | Readability | PASS | Reuses two-column pattern from 011; type compatibility is a simple matrix lookup |
| III | Data fidelity | PASS | One-to-one constraint prevents ambiguous mappings; compatibility status is explicit |
| IV | Tests on real data | PASS | Tests with realistic field counts (50+ per object) and diverse type combinations |
| V | Idempotence | PASS | Auto-matching idempotent (skips existing); link creation rejects duplicates |
| VI | Traceability | PASS | All field link create/remove operations logged to audit trail |
| VII | Observability | PASS | Console logs for auto-match execution, compatibility checks, link operations |
| VIII | Modularity | PASS | Isolated behind FieldMappingService; depends on ObjectMapping via ID only; public API is service + routes |
| IX | Human-in-the-loop | PASS | Auto-match tourne uniquement à la 1ère configuration d'une paire d'objects, ou sur trigger explicite ; aucune mutation silencieuse de mapping existant ; linkStatus calculé en lecture, jamais auto-corrigé |

## Project Structure

### Documentation

```text
specs/012-field-mapping/
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
│   ├── plans/[planId]/mapping/[mappingId]/
│   │   └── page.tsx                                # Field mapping two-column view
│   └── api/plans/[planId]/object-mappings/[mappingId]/fields/
│       ├── route.ts                                # GET list, POST create field mapping
│       ├── [fieldMappingId]/route.ts               # DELETE remove field mapping
│       └── auto-match/route.ts                     # POST trigger auto-matching
├── components/mapping/
│   ├── FieldMappingView.tsx                        # Two-column field layout with links
│   ├── FieldCard.tsx                               # Field card (name, type, fill rate, circle)
│   ├── FieldDetailModal.tsx                        # Field detail (fill rate, picklist values, etc.)
│   ├── FieldLink.tsx                               # SVG link with color-coded status
│   └── FieldSearchFilter.tsx                       # Search/filter for field lists
├── lib/
│   ├── services/field-mapping.ts                   # Domain logic: CRUD, auto-match, compatibility
│   ├── services/type-compatibility.ts              # Type compatibility matrix
│   ├── services/field-auto-match-registry.ts       # Native field correspondences per connector pair
│   └── types/mapping.ts                            # Extended with FieldMapping types
└── hooks/
    └── use-field-mapping.ts                        # React hook for field mapping state

tests/
├── unit/services/field-mapping.test.ts
├── unit/services/type-compatibility.test.ts
├── unit/services/field-auto-match-registry.test.ts
└── integration/api/field-mapping.test.ts
```

**Structure Decision**: Field mapping view is nested under the object mapping (`mapping/[mappingId]/`). The type compatibility matrix is extracted to its own service because it's reused by migration logic (013) and integrity check (017).
