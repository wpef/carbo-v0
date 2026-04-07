# Implementation Plan: Schema Write

**Branch**: `022-schema-write` | **Date**: 2026-04-02 | **Spec**: `specs/022-schema-write/spec.md`

## Summary

Allow consultants to create and modify fields and objects in the destination system directly from the field mapping view. The feature is gated by the adapter's `canWriteSchema` capability flag. Supports "New field" and "Copy from source field" creation modes, field property modification, LLM-generated field descriptions, and custom object creation. Every write operation is logged to the audit trail and the local schema snapshot is refreshed after success.

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: @anthropic-ai/sdk (for LLM field descriptions), Connector Interface (canWriteSchema, createField, modifyField, createObject)
**Storage**: SQLite via Prisma -- new `SchemaWriteOperation` audit entity
**Testing**: Vitest (unit + integration)
**Target Platform**: Next.js 14+ (App Router), Node.js
**Project Type**: Domain service + API routes + UI components within monolithic Next.js project
**Performance Goals**: Field creation <10s; field modification <10s; LLM description <10s
**Constraints**: Only available for destination connections with canWriteSchema=true; adapter methods must exist
**Scale/Scope**: 1 service, 3 API routes, 3 UI components (create form, modify modal, object create form), 1 Prisma model

## Constitution Check

| # | Principle | Status | Justification |
|---|-----------|--------|---------------|
| I | Spec-First | PASS | spec.md approved and complete |
| II | Readability | PASS | Separate components per user story; service methods named after operations |
| III | Data fidelity | PASS | Schema snapshot refreshed after every write; name conflicts detected before submit |
| IV | Tests on real data | PASS | Tests use realistic field definitions with types, picklist values, groups |
| V | Idempotence | PASS | Creating an already-existing field returns a clear error, not a duplicate |
| VI | Traceability | PASS | Every write operation (success or failure) logged to SchemaWriteOperation audit entity |
| VII | Observability | PASS | Console logs for each write attempt, result, and schema refresh |
| VIII | Modularity | PASS | Consumes connector adapter via abstract interface; own audit entity; UI components isolated |

## Project Structure

### Documentation (this feature)

```text
specs/022-schema-write/
├── spec.md
├── plan.md              # This file
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
├── lib/
│   └── services/
│       └── schema-write/
│           ├── index.ts                    # Public barrel export
│           ├── schema-write.service.ts     # Core service: create field, modify field, create object
│           ├── field-description.ts        # LLM-powered field description generation
│           ├── validation.ts               # Pre-submit validation (name uniqueness, type compatibility)
│           └── types.ts                    # CreateFieldInput, ModifyFieldInput, CreateObjectInput, SchemaWriteResult
│
├── app/
│   └── api/
│       └── plans/
│           └── [planId]/
│               └── connections/
│                   └── [connectionId]/
│                       └── schema-write/
│                           ├── fields/
│                           │   └── route.ts          # POST: create field
│                           ├── fields/
│                           │   └── [fieldApiName]/
│                           │       └── route.ts      # PATCH: modify field
│                           ├── objects/
│                           │   └── route.ts          # POST: create object
│                           └── describe-field/
│                               └── route.ts          # POST: generate field description via LLM
│
├── components/
│   └── schema-write/
│       ├── create-field-form.tsx           # "Add field" form with New/Copy toggle
│       ├── modify-field-modal.tsx          # Field property edit modal
│       ├── create-object-form.tsx          # Custom object creation form
│       └── generate-description-button.tsx # LLM description trigger with loading state
│
└── hooks/
    └── use-schema-write.ts                 # React hook for schema write operations + optimistic UI

prisma/
└── schema.prisma                           # SchemaWriteOperation model

tests/
├── unit/
│   └── services/
│       └── schema-write/
│           ├── validation.test.ts          # Name uniqueness, type compatibility checks
│           ├── field-description.test.ts   # LLM call, fallback, missing key
│           └── service.test.ts             # Create/modify/object operations
└── integration/
    └── schema-write.test.ts                # Full create+refresh cycle with mocked adapter
```

**Structure Decision**: Service in `src/lib/services/schema-write/` with separated validation, LLM description, and core operations. API routes nested under connection ID since schema writes target a specific destination connection. UI components in `src/components/schema-write/` with a shared React hook.
