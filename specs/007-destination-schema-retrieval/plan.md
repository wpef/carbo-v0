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

**Règle — chaîne complète sur tout refresh** (FR-004) : Tout trigger de refresh schema destination — bouton sur `/destination`, bouton sur `/destination/schema`, callback OAuth — DOIT exécuter la chaîne schéma → fields, jamais une étape isolée. La page `/destination/schema` NE DOIT PAS appeler directement `POST /destination-schema` sans enchaîner ensuite `POST /destination-fields`. L'orchestration peut se faire côté client (hook `useConnectionSetup` réutilisé) ou côté serveur (endpoint composite), mais une seule règle vaut : **aucun trigger de refresh ne doit produire un snapshot d'objects sans fields**. Bug constaté en test live le 2026-05-12. <!-- Added: 2026-05-12 -->

**Règle — hook integrity check** (FR-005) : `retrieveSchema()` (ou la fonction qui orchestre la chaîne complète) DOIT appeler `checkMappingIntegrity(planId)` à la fin du flow, après création du nouveau CURRENT et récupération des fields. C'est la task T006 de 017. Sans ce hook, les mappings cassés par un refresh destination restent invisibles : le plan reste en DRAFT alors que des références sont mortes. Aucune remédiation automatique n'est déclenchée — l'integrity check ne fait que **marquer** et update `plan.status` (Principe IX). <!-- Added: 2026-05-12 -->
