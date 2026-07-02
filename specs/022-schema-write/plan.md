# Implementation Plan: Schema Write

**Branch**: `022-schema-write` | **Date**: 2026-05-18 | **Spec**: `specs/022-schema-write/spec.md`

## Summary

Allow consultants to create new fields, modify existing fields, and create new objects on the destination system directly from the mapping workspace. Operations are gated by `ConnectorAdapter.capabilities.canWriteSchema` and routed through the adapter's `createObject`, `createField`, and `modifyField` methods. Includes LLM-generated field descriptions via the Claude API. Every schema write is audited and triggers an automatic local snapshot refresh.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: Prisma ORM (audit records), ConnectorAdapter (000 interface -- `createObject`, `createField`, `modifyField`), @anthropic-ai/sdk (LLM descriptions), existing schema snapshot models (003/007)
**Storage**: Neon Postgres via Prisma -- `SchemaWriteOperation` audit table; destination schema snapshots updated after each write
**Testing**: Vitest -- unit tests for validation logic + integration tests with DemoAdapter (canWriteSchema=true variant); Playwright E2E for the creation form
**Target Platform**: Next.js Route Handlers (API) + React components (UI forms and modals)
**Project Type**: Full-stack feature (API + UI + connector integration)
**Constraints**: Writes only on destination connections (FR-012); gated by capability flag (FR-001); LLM optional (FR-006)

## Constitution Check

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Spec-First | PASS | spec.md approved with 4 user stories |
| II | Readability | PASS | Service layer with explicit validation steps; no magic |
| III | Data fidelity | PASS | Pre-validation catches conflicts before API call; no silent field creation |
| IV | Tests on real data | PASS | Realistic fixtures: HubSpot-like field types, picklist values, group names |
| V | Idempotence | PASS | Creating a field that already exists returns a clear error (FR-008), not a duplicate |
| VI | Traceability | PASS | Every write operation (success or failure) logged to SchemaWriteOperation + AuditLog |
| VII | Observability | PASS | Console logging at each step: validation, API call, snapshot refresh, result |
| VIII | Modularity | PASS | Isolated service at `src/lib/services/schema-write/`; connector-agnostic via adapter interface |
| IX | Human-in-the-loop | PASS | All writes are consultant-initiated (button click + form submission); no auto-creation |

## Architecture

```
src/
  lib/
    services/
      schema-write/
        write-service.ts          # createField, modifyField, createObject orchestration
        field-validator.ts        # Pre-validation: name uniqueness, type compatibility, required fields
        description-generator.ts  # LLM description generation via Claude API
        index.ts                  # Public API barrel
    types/
      schema-write.ts             # SchemaWriteOperation types, DTOs, form types
  app/
    api/
      connections/
        [connectionId]/
          schema/
            fields/
              route.ts            # POST -> create field
              [fieldApiName]/
                route.ts          # PATCH -> modify field
            objects/
              route.ts            # POST -> create object
            describe/
              route.ts            # POST -> LLM description generation
  components/
    schema-write/
      CreateFieldForm.tsx         # Field creation form (new or copy-from-source)
      ModifyFieldModal.tsx        # Field modification modal (click on dest field card)
      CreateObjectForm.tsx        # Object creation form
      DescriptionGenerator.tsx    # LLM description button + preview
```

### Data Flow (Field Creation)

```
Consultant clicks "Add field" on destination column
  -> CreateFieldForm opens (mode: "new" or "copy-from-source")
  -> If copy: pre-fill from selected source field
  -> Consultant edits and submits
  -> POST /api/connections/[connectionId]/schema/fields
    -> fieldValidator.validate(connectionId, fieldData)
      -> Check name uniqueness against current snapshot
      -> Check type is supported by destination connector
    -> writeService.createField(connectionId, objectApiName, fieldData)
      -> adapter.createField(connectionId, objectApiName, fieldData)
      -> Log to SchemaWriteOperation (success or failure)
      -> Log to AuditLog
      -> Trigger snapshot refresh for the connection (003/007)
    -> Return created field
  -> UI refreshes destination field list
```

## Phases

### Phase 0: Research
See `research.md` -- ConnectorAdapter extension, LLM context assembly, type support per connector.

### Phase 1: Design
See `data-model.md` (SchemaWriteOperation Prisma model), `contracts/api.md` (API routes + DTOs).

### Phase 2: Implementation
See `tasks.md` -- 5 phases: types + model, service layer, API routes, UI components, tests.
