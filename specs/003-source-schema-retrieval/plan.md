# Implementation Plan: Source Schema Retrieval

**Branch**: `003-source-schema-retrieval` | **Date**: 2026-04-02 | **Spec**: `specs/003-source-schema-retrieval/spec.md`

## Summary

After connecting to a source, the consultant retrieves the full list of objects from the connected system. The system persists schema snapshots (max 2: CURRENT + PREVIOUS), computes diffs between them, and displays the results. This feature is the foundation for object selection (004) and field retrieval (005).

## Technical Context

**Language/Version**: TypeScript 5.x on Next.js 14+ (App Router)
**Primary Dependencies**: Next.js Route Handlers, Prisma ORM, shadcn/ui, Connector Interface types (000)
**Storage**: SQLite via Prisma (SchemaSnapshot + SchemaObject tables)
**Testing**: Vitest (unit + integration)
**Target Platform**: Local-first web application (localhost)
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

**Règle — instanciation d'adaptateur** : Le service `schema-retrieval.ts` DOIT instancier les adaptateurs exclusivement via la factory canonique `src/lib/connectors/adapter-factory.ts`. Toute factory locale est interdite : elle échoue silencieusement dès qu'un nouvel adaptateur est ajouté sans que le service soit mis à jour (incident constaté en test live SF le 2026-04-23).

**Règle — chaîne complète sur tout refresh** (FR-010) : Tout trigger de refresh schema — bouton sur `/source`, bouton sur `/source/schema`, callback OAuth — DOIT exécuter la chaîne schéma → objects → fields, jamais une étape isolée. La page `/source/schema` NE DOIT PAS appeler directement `POST /source/schema` sans enchaîner ensuite `/source/objects` (init/migrate selection) puis `POST /source/fields`. L'orchestration peut se faire côté client (hook `useConnectionSetup` réutilisé) ou côté serveur (endpoint composite), mais une seule règle vaut : **aucun trigger de refresh ne doit produire un snapshot d'objects sans fields**. Bug constaté en test live le 2026-05-12. <!-- Added: 2026-05-12 -->

**Règle — hook integrity check** (FR-011) : `retrieveSchema()` (ou la fonction qui orchestre la chaîne complète) DOIT appeler `checkMappingIntegrity(planId)` à la fin du flow, après création du nouveau CURRENT, migration des sélections et récupération des fields. C'est la task T006 de 017. Sans ce hook, les mappings cassés par un refresh restent invisibles : le plan reste en DRAFT alors que des références sont mortes. Aucune remédiation automatique n'est déclenchée — l'integrity check ne fait que **marquer** et update `plan.status` (Principe IX). <!-- Added: 2026-05-12 -->
