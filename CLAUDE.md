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

**Phase 2 — Production mode**

| # | Feature | Depends on |
|---|---------|------------|
| 005 | Export/Import JSON | 003 |
| 006 | Migration execution | 003, 001, 002 |
| — | Project management (multi-mapping) | 003, P2/P3 |

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

- **Main branch**: `master` — **canonical source of specs only** (specs/, .specify/, CLAUDE.md, .gitignore). No implementation code lives here.
- **Implementation branches**: `implement/phase-N-vM` — ephemeral, contain both code and any spec edits that surface during implementation.
- **Spec edits during implementation**: keep spec commits separate from code commits on the implementation branch (use `spec(###):` prefix vs `feat(T###):` / `fix:`). This is what makes consolidation back to master trivial.
- **Commits**: one commit per task or logical group; reference the task ID (e.g., `feat(T014): implement mapping engine`).
- **PRs**: must include the Constitution Check result from `plan.md`.

## Version Cycle — Spec Evolution Workflow

Each implementation pass is a numbered cycle. The goal is that `git diff v(N-1) v(N) -- specs/` always answers *"what did I learn from cycle N that I changed in the specs?"*.

### The cycle

```
1. Tag the current spec baseline                 git tag v(N)              (already done — current master = v4)
2. Create the implementation branch              git checkout -b implement/phase-1-v(N) v(N)
3. Run /speckit.implement → build the version    (code commits + occasional spec commits)
4. Test the version → collect feedback
5. Consolidate spec changes back to master       (single commit on master: "consolidate v(N) lessons")
6. Tag the new baseline                          git tag v(N+1)
7. Optional: archive the implement branch        git branch -d implement/phase-1-v(N)
8. Loop → step 2 with v(N+1)
```

### Consolidation step (5) — two valid approaches

**a) Cherry-pick spec commits.** If during implementation you kept spec edits in dedicated commits (`spec(###):` prefix), cherry-pick those commits onto master.

**b) Diff-based sync.** From master: `git checkout implement/phase-1-v(N) -- specs/ .specify/memory/constitution.md` then commit. Single clean consolidation commit. Use this when spec/code commits got interleaved.

### Querying spec evolution

| Question | Command |
|---|---|
| What changed between v3 and v4? | `git diff v3 v4 -- specs/` |
| Which commits touched specs between v3 and v4? | `git log v3..v4 -- specs/` |
| What did spec X look like in v3? | `git show v3:specs/###-name/spec.md` |
| Show me v3 specs in full | `git checkout v3` (read-only browse, then `git checkout master`) |

### Invariants

- **`master` never contains implementation code.** Only specs, .specify/, CLAUDE.md, .gitignore.
- **Each `vN` tag points to a commit on master**, never on an implement branch.
- **One tag per cycle.** `vN` represents the spec state used as input for cycle N's implementation, equivalently the output of cycle N-1's lessons.
- **Implementation branches are disposable.** When in doubt, the spec on master is the source of truth — code can be regenerated from specs.

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

## Tech Stack

- **Frontend**: Next.js (App Router) + TypeScript — non-negotiable standard
- **Style, Backend, Database, Testing**: TBD — to be defined during the first `/speckit.plan`; once defined, deviations require justification in `plan.md`

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

- **Current spec baseline**: `v4` (master) — consolidates lessons from v3 implementation.
- **Next step**: branch `implement/phase-1-v4` from `v4` and run `/speckit.implement`.
- The existing spec at `specs/001-mapping-plan/` will be reused and adapted when we reach feature 003.
