# Implementation Plan: Connector Interface

**Branch**: `000-connector-interface` | **Date**: 2026-04-02 | **Spec**: `specs/000-connector-interface/spec.md`

## Summary

Define the abstract TypeScript types and interfaces that all connectors must implement. This is a pure type-level package with zero runtime dependencies. It defines ConnectorConnection, ConnectorSchema, ConnectorObject, ConnectorField, ConnectorRecord, FieldStats, PaginatedRecords, SchemaDiffResult, capability flags, and the ConnectorAdapter method signatures. Downstream features (001+, adapters) depend on these types.

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: None (pure types, zero runtime deps)
**Storage**: N/A (no data persistence in this feature)
**Testing**: Vitest (compile-time type checks + contract test suite)
**Target Platform**: Next.js 14+ (App Router), Node.js
**Project Type**: Shared type library within monolithic Next.js project
**Performance Goals**: N/A (compile-time only)
**Constraints**: Zero runtime dependencies. No concrete classes. No imports from external packages.
**Scale/Scope**: ~8 type definitions + 1 adapter interface + 1 contract test suite

## Constitution Check

| # | Principle | Status | Justification |
|---|-----------|--------|---------------|
| I | Spec-First | PASS | spec.md approved and complete |
| II | Readability | PASS | Pure types with explicit names, no abstractions beyond what's needed |
| III | Data fidelity | PASS | ConnectorField includes all metadata; unknown types preserved as strings |
| IV | Tests on real data | PASS | Contract test suite validates every type and method signature |
| V | Idempotence | N/A | No operations to replay |
| VI | Traceability | N/A | No operations to log (adapters handle their own logging) |
| VII | Observability | N/A | No runtime code |
| VIII | Modularity | PASS | Self-contained type package; no internal deps; public interface is `src/lib/connectors/types.ts` |

## Project Structure

### Documentation (this feature)

```text
specs/000-connector-interface/
├── spec.md
├── plan.md              # This file
├── research.md
├── data-model.md        # Skipped (no Prisma entities)
├── quickstart.md
├── contracts/           # Skipped (no API routes)
└── tasks.md
```

### Source Code

```text
src/
└── lib/
    └── connectors/
        ├── types.ts              # All connector types + interfaces
        └── index.ts              # Public barrel export

tests/
└── unit/
    └── connectors/
        └── contract.test.ts      # Contract test suite (type + mock validation)
```

**Structure Decision**: Single `types.ts` file for all connector types. A barrel `index.ts` re-exports everything. No subdirectories needed — the entire feature is ~200 lines of type definitions.
