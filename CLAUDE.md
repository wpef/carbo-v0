# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Carbo-v0** is a SaaS tool (local-first for v0) for data migration consultants. It connects
source and destination systems, plans object/field mappings with transformation and validation
rules, modifies the destination schema when needed, generates client validation documents, then
executes the migration.

### Core Workflow

1. **Connect source + destination** — retrieve schemas (objects, fields, types)
2. **Create the mapping plan** — associate objects/fields, define transformation, validation, and filter rules
3. **Modify destination schema** — create missing objects/fields as needed
4. **Generate client documents** — written text + contractual document for client validation
5. **Client approval** — sign-off before execution
6. **Execute the migration** — apply the mapping on real data

### Feature Roadmap

**Phase 1 — Validate the full workflow (no real execution)**

| # | Feature | Depends on |
|---|---------|------------|
| 001 | Salesforce connector (source) | — |
| 002 | HubSpot connector (destination + schema write) | — |
| 003 | Mapping plan (object/field + rules + filters) | 001, 002 |
| 004 | Client documents (text + contractual) | 003 |
| — | Connector SDK (extracted from 001 + 002, bottom-up) | 001, 002 |
| — | Audit trail | cross-cutting, integrated from 001 |

**Phase 2 — Production mode (after Phase 1 validated)**

| # | Feature | Depends on | Scope |
|---|---------|------------|-------|
| 005 | Export/Import JSON | 003 | Serialize a mapping plan to a portable JSON file; reimport it to restore the exact same plan (all field mappings, rules, filters). Enables backup, sharing between consultants, and version control of mapping plans outside the app. |
| 006 | Migration execution | 003, 001, 002 | Execute the mapping plan on real data: read source records (with filters), apply transformation rules, validate with validation rules, write to destination. Must be idempotent (Principle V), resumable on failure, and fully logged (Principle VI). JS transformation functions run in a sandboxed environment. Includes dry-run mode (validate without writing) and progress reporting. |
| — | Connector SDK | 001, 002 | Extract the common interface from Salesforce and HubSpot connectors into a shared SDK. Define ConnectorConnection, ConnectorSchema, ConnectorObject, ConnectorField abstractions. Create the `/speckit.connector` skill to industrialize adding new connectors. |

**Phase 3 — Scale and extend (P2/P3 priority)**

| # | Feature | Depends on | Scope |
|---|---------|------------|-------|
| — | Project management | 003 | Group multiple mapping plans into a project. A project represents a full migration engagement (e.g., "Acme Corp CRM Migration"). Includes project dashboard, progress tracking across plans, and consolidated audit trail. |
| — | New connectors (Airtable, Dynamics, etc.) | Connector SDK | Each new connector follows the SDK interface. Use `/speckit.connector` skill: provide the service's API docs, generate a pre-filled spec, implement following the established pattern. |
| — | Auto-mapping suggestions | 003 | Suggest field mappings based on name similarity, type compatibility, and common patterns. The consultant reviews and accepts/rejects suggestions — never auto-applied. |
| — | Collaborative features | Project management | Multi-user access to projects, role-based permissions, comment threads on mappings. Requires user authentication (out of scope until this phase). |

### Connector Strategy

Salesforce and HubSpot connectors are built first. The Connector SDK is **extracted** from these
concrete implementations (bottom-up approach). Once the SDK is extracted, a `/speckit.connector`
skill will be created to streamline adding new connectors (Airtable, etc.).

## Development Workflow (Speckit)

All features follow this mandatory order — no phase can be skipped:

1. `/speckit.specify` — create `specs/###-feature/spec.md`
2. `/speckit.clarify` — resolve ambiguities *(optional but recommended)*
3. `/speckit.plan` — produce `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`
4. `/speckit.tasks` — generate `tasks.md` from design artifacts
5. `/speckit.implement` — execute tasks in dependency order

Use `/speckit.analyze` to cross-check consistency across spec/plan/tasks at any point.

## Git Conventions

- **Main branch**: `master`
- **Branch naming**: `###-feature-name` (e.g., `001-salesforce-connector`)
- **Commits**: one commit per task or logical group; reference the task ID (e.g., `feat(T014): implement mapping engine`)
- **PRs**: must include the Constitution Check result from `plan.md`

## Directory Structure

```
specs/
└── ###-feature-name/
    ├── spec.md          # User stories, FRs, acceptance scenarios
    ├── plan.md          # Tech stack, architecture, constitution check
    ├── research.md      # Technical decisions and constraints
    ├── data-model.md    # Entities and relationships
    ├── quickstart.md    # Integration scenarios
    ├── contracts/       # API specifications
    ├── tasks.md         # Ordered task list for implementation
    └── checklists/      # Pre-implementation gates

.specify/
├── memory/constitution.md   # Authoritative constitution (v1.1.0)
└── templates/               # Speckit command templates
```

## Tech Stack (defined in 001 plan)

- **Frontend**: Next.js 14+ (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Next.js Route Handlers (unified single project)
- **Database**: SQLite via Prisma ORM (local-first for v0; migratable to PostgreSQL)
- **Testing**: Vitest (unit + integration) + Playwright (E2E)
- **Salesforce SDK**: jsforce v2.0+
- **HubSpot SDK**: @hubspot/api-client
- **LLM**: @anthropic-ai/sdk (Claude API) for document rule descriptions
- **PDF**: Puppeteer (HTML → PDF)
- Deviations require justification in `plan.md` Complexity Tracking

## Constitution (v1.1.0) — Core Principles

These govern all implementation decisions. Full text in `.specify/memory/constitution.md`.

| # | Principle | Key rule |
|---|-----------|----------|
| I | Spec-First | No implementation without an approved `spec.md` |
| II | Readability over cleverness | No unexplained abstractions; Next.js+TS unless justified |
| III | Data fidelity | No silent transformation/loss; unmapped fields must raise explicit errors |
| IV | Functional tests on real data | Critical paths (mapping engine, export, migration) tested with realistic fixtures, TDD |
| V | Idempotence | Migrations must be replayable; partial runs must be resumable |
| VI | Traceability by default | Every significant operation logged to persistent audit trail |
| VII | Developer observability | Logs must allow full execution tracing from terminal without a debugger |

## Current Status

Phase 1 fully specified (spec → clarify → plan → tasks for all 4 features).
Branch `specs/phase-1` contains all specs merged. Pending user review before implementation.
148 total tasks across 4 features. Next step: review, then `/speckit.implement` feature by feature.
