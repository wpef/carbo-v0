# Carbo-v0 — Feature Roadmap v2

**Date**: 2026-03-25
**Constitution**: v1.2.0 (Principle VIII: Modularity & Isolation)

## Architecture

The application is split into two layers:

- **Core App** (Layer 1): Generic features that work with any connector. No reference to Salesforce, HubSpot, or any specific system.
- **Adapters** (Layer 2): Connector-specific implementations that plug into the Core App via the Connector Interface.

## Phase 1 — Validate the full workflow

### Foundation

| # | Feature | Scope | Depends on |
|---|---------|-------|------------|
| 000 | Connector Interface | Abstract types and interfaces for all connectors | — |

### Connection & Schema (generic)

| # | Feature | Scope | Depends on |
|---|---------|-------|------------|
| 001 | Connection | Connect to any system (source or destination), persist connection | 000 |
| 002 | Schema Retrieval | Retrieve the list of objects from a connected system | 001 |
| 003 | Object Selection | Select relevant objects, pre-filter, persist selection | 002 |
| 004 | Field Retrieval | Retrieve fields for selected objects only | 003 |
| 005 | Record Preview | Paginated data preview for any object | 004 |
| 006 | Field Stats | Per-field stats: null count, distinct values, samples | 005 |
| 007 | Schema Write | Create objects/properties in a destination (optional capability) | 002 |

### Mapping

| # | Feature | Scope | Depends on |
|---|---------|-------|------------|
| 008 | Mapping Plan | Create a plan linking source + destination connections | 004 (source), 004 (dest) |
| 009 | Object Mapping | Map source object to destination object | 008 |
| 010 | Field Mapping | Map source field to destination property, type compatibility | 009 |
| 011 | Transformation Rules | Define transformation rules (fixed, reference, JS function) | 010 |
| 012 | Validation Rules | Define validation rules (type check, regex) | 010 |
| 013 | Migration Filters | Define filters on source records per object | 009 |
| 014 | Unmapped Fields Detection | Explicit warnings for unmapped fields (Principle III) | 010 |
| 015 | Mapping Integrity Check | Detect broken mappings after schema changes | 010 |

### Documents

| # | Feature | Scope | Depends on |
|---|---------|-------|------------|
| 016 | Rule Description Engine | Translate rules to natural language (templates + LLM) | 011, 012 |
| 017 | Text Document Generation | Readable document for the client | 016, 014 |
| 018 | Contractual Document Generation | Formal contractual document with signature block | 016, 014 |
| 019 | PDF Export | HTML to PDF conversion | 017 or 018 |

### Adapters (Layer 2)

| Adapter | Implements | Scope |
|---------|-----------|-------|
| Salesforce | 001, 002, 004, 005 | OAuth2 PKCE, jsforce, SOQL, describeGlobal/describe |
| HubSpot | 001, 002, 004, 005, 007 | Private App token, CRM API v3, Search API, Schemas API |

## Phase 2 — Production mode

| # | Feature | Scope |
|---|---------|-------|
| 020 | Export/Import JSON | Serialize mapping plan to portable JSON |
| 021 | Migration Execution | Apply mapping on real data (dry-run + execute) |

## Phase 3 — Scale

| Feature | Scope |
|---------|-------|
| Project Management | Group multiple mapping plans |
| New Adapters | Airtable, Dynamics, etc. via Connector Interface |
| Auto-mapping Suggestions | Field mapping suggestions based on name/type similarity |

## Key principles

- **Each feature is independently freezable** — once validated, its internal code is not modified (Principle VIII)
- **Core features are connector-agnostic** — they work via abstract interfaces
- **Adapters are plugins** — adding a new connector requires zero changes to the core
- **User stories are atomic** — each feature has exactly one responsibility
