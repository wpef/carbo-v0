# Implementation Plan: Connector Interface

**Branch**: `000-connector-interface` | **Date**: 2026-05-18 | **Spec**: `specs/000-connector-interface/spec.md`

## Summary

Define the abstract TypeScript types and interfaces that all connectors must implement. This is a compile-time-only package: no runtime code, no dependencies, no database. Every downstream feature (001-022) depends on these types.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: None (zero runtime dependencies — FR-011)
**Storage**: N/A (types only)
**Testing**: Vitest — compile-time type checks + contract test suite with a mock connector
**Target Platform**: Next.js project (types imported by all layers)
**Project Type**: Type library (no runtime, no API routes, no UI)
**Constraints**: Must remain system-agnostic; data types as strings not enums (Assumptions)

## Constitution Check

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Spec-First | PASS | spec.md approved |
| II | Readability | PASS | Pure types with explicit names; no abstractions to obscure |
| III | Data fidelity | PASS | ConnectorField preserves all metadata; unknown types kept as strings |
| IV | Tests on real data | N/A | Type library — contract tests verify structural conformance |
| V | Idempotence | N/A | No mutations |
| VI | Traceability | N/A | No operations to log |
| VII | Observability | N/A | No runtime |
| VIII | Modularity | PASS | Self-contained types package at `src/lib/types/connector.ts` |
| IX | Human-in-the-loop | N/A | No automation |

## Architecture

```
src/lib/types/
└── connector.ts    # All connector interface types (single file)
```

All types are exported from a single file. Downstream features import specific types:
```typescript
import type { ConnectorField, ConnectorObject } from '@/lib/types/connector'
```

## Phases

### Phase 0: Research
See `research.md` — minimal for a type-only feature.

### Phase 1: Design
See `data-model.md` (type definitions), `contracts/api.md` (interface signatures).

### Phase 2: Implementation
Single task: create the types file + contract test suite.
See `tasks.md`.
