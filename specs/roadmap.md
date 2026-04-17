# Carbo-v0 — Feature Roadmap v2.1

**Date**: 2026-03-27
**Constitution**: v1.2.0 (Principle VIII: Modularity & Isolation)

## Architecture

The application is split into two layers:

- **Core App** (Layer 1): Generic features that work with any connector. No reference to Salesforce, HubSpot, or any specific system.
- **Adapters** (Layer 2): Connector-specific implementations that plug into the Core App via the Connector Interface.

## Core UX Principle: The Plan is the Container

**Everything lives inside a Migration Plan.** The plan is the top-level entity that contains:
source connection, destination connection, object selection, field mapping, rules, filters, and
documents.

There are no standalone connector pages. The consultant cannot connect to a system without
first creating a plan. The home page is a list of plans.

### User flow:
1. **Home** → list of plans + "New Plan" button
2. **Create Plan** → name, description
3. **Inside the plan** — sequential steps:
   - 3a. Configure Source → choose adapter type, authenticate, select objects
   - 3b. Configure Destination → choose adapter type, authenticate
   - 3c. Map Objects → associate source objects to destination objects
   - 3d. Map Fields → map fields, add rules, add filters
   - 3e. Generate Documents → text + contractual
   - 3f. Run Migration (Phase 2)

## Phase 1 — Validate the full workflow

### Foundation

| # | Feature | Scope | Depends on |
|---|---------|-------|------------|
| 000 | Connector Interface | Abstract types and interfaces for all connectors | — |

### Plan & Connection

| # | Feature | Scope | Depends on |
|---|---------|-------|------------|
| 001 | Migration Plan | Create/list/delete plans — the top-level container for everything | 000 |
| 002 | Source Connection | Within a plan, connect to a source system (choose adapter, authenticate) | 001 |
| 003 | Source Schema Retrieval | Retrieve the list of source objects after connection | 002 |
| 004 | Source Object Selection | Select which source objects to include in migration scope | 003 |
| 005 | Source Field Retrieval | Retrieve fields for selected source objects only | 004 |
| 006 | Destination Connection | Within a plan, connect to a destination system | 001 |
| 007 | Destination Schema Retrieval | Retrieve the list of destination objects | 006 |
| 008 | Destination Field Retrieval | Retrieve fields for destination objects | 007 |

### Data Preview (on-demand, within plan context)

| # | Feature | Scope | Depends on |
|---|---------|-------|------------|
| 009 | Record Preview | Paginated data preview for any connected object | 005 or 008 |
| 010 | Field Stats | Per-field stats: null count, distinct values, samples | 009 |

### Mapping (within plan)

| # | Feature | Scope | Depends on |
|---|---------|-------|------------|
| 011 | Object Mapping | Map source object to destination object | 005, 008 |
| 012 | Field Mapping | Map source field to destination property, type compatibility | 011 |
| 013 | Transformation Rules | Define transformation rules (fixed, reference, JS function) | 012 |
| 014 | Validation Rules | Define validation rules (type check, regex) | 012 |
| 015 | Migration Filters | Define filters on source records per object | 011 |
| 016 | Unmapped Fields Detection | Explicit warnings for unmapped fields (Principle III) | 012 |
| 017 | Mapping Integrity Check | Detect broken mappings after schema changes | 012 |

### Documents (within plan)

| # | Feature | Scope | Depends on |
|---|---------|-------|------------|
| 018 | Rule Description Engine | Translate rules to natural language (templates + LLM) | 013, 014 |
| 019 | Text Document Generation | Readable document for the client | 018, 016 |
| 020 | Contractual Document Generation | Formal contractual document with signature block | 018, 016 |
| 021 | PDF Export | HTML to PDF conversion | 019 or 020 |

### Schema Write (optional, within plan)

| # | Feature | Scope | Depends on |
|---|---------|-------|------------|
| 022 | Schema Write | Create objects/properties in destination (gated by adapter capability) | 008 |

### Connection Reconfiguration (within plan)

| # | Feature | Scope | Depends on |
|---|---------|-------|------------|
| 023 | Connection Reconfiguration | Change source/destination adapter or refresh schema on an existing plan. Computes schema diff vs. stored snapshot, preserves mappings that remain structurally valid, flags/deletes only the broken ones, shows impact preview before confirming. Documents marked `outdated` when affected. | 002, 006, 011, 012, 013, 015, 017 |

### Adapters (Layer 2)

| Adapter | Role | Implements |
|---------|------|-----------|
| Salesforce | Source | Connection, Schema, Fields, Records |
| HubSpot | Destination | Connection, Schema, Fields, Records, Schema Write |

## Phase 2 — Production mode

| # | Feature | Scope |
|---|---------|-------|
| 024 | Export/Import JSON | Serialize a plan to portable JSON |
| 025 | Migration Execution | Apply mapping on real data (dry-run + execute) |

## Phase 3 — Scale

| Feature | Scope |
|---------|-------|
| Project Management | Group multiple plans |
| New Adapters | Airtable, Dynamics, etc. via Connector Interface |
| Auto-mapping Suggestions | Field mapping suggestions based on name/type similarity |

## Cross-cutting: Workflow Navigation

Inside a plan, the UI MUST guide the consultant through each step with:
- A vertical step indicator showing all steps and current progress
- What was just completed (green checkmark)
- What the next step is (highlighted, call-to-action)
- Ability to go back to any completed step to review/modify

The home page shows a list of all plans with their current step/status.

## Key principles

- **The plan is the container** — no feature exists outside of a plan context
- **Each feature is independently freezable** — once validated, its internal code is not modified (Principle VIII)
- **Core features are connector-agnostic** — they work via abstract interfaces
- **Adapters are plugins** — adding a new connector requires zero changes to the core
- **User stories are atomic** — each feature has exactly one responsibility
- **Workflow guidance** — the consultant is never left wondering "what's next?"
- **Demo mode is connector-scoped** — "Use Demo Data" appears only in the connection step of a plan, replaces real auth with mock data
