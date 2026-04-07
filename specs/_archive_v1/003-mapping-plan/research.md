# Research: Mapping Plan

**Feature**: 003-mapping-plan
**Date**: 2026-03-19

## Decision 1: JavaScript Syntax Validation

**Decision**: Use acorn (lightweight JS parser) for syntax-only validation at definition time

**Rationale**:
- acorn is a small, fast, well-maintained JavaScript parser.
- At definition time, we only need to check syntax — not execute the function.
- `acorn.parse(code, { ecmaVersion: 2020 })` catches syntax errors immediately.
- Full execution (sandboxed) happens at migration time (feature 006).

**Alternatives considered**:
- eval() for validation: dangerous, executes code, not just syntax check.
- TypeScript compiler API: too heavy for syntax-only validation.
- No validation until execution: violates FR-008 and SC-003 (detect errors at definition time).

## Decision 2: Type Compatibility Checking

**Decision**: Define a type compatibility matrix mapping Salesforce types ↔ HubSpot types

**Rationale**:
- Source (Salesforce) and destination (HubSpot) have different type systems.
- A compatibility matrix explicitly defines which conversions are safe (string→string), which
  require transformation (picklist→enumeration), and which are incompatible (boolean→date).
- The matrix is defined in code as a static lookup — simple, readable, maintainable.
- Incompatible mappings are allowed but flagged as warnings (a transformation rule can fix them).

**Alternatives considered**:
- Block incompatible mappings: too restrictive — a JS transformation can bridge any types.
- No type checking: violates the "informed mapping decisions" goal from the spec.

## Decision 3: Migration Filter Estimation

**Decision**: Use the source connector's record reading capability to estimate filtered record counts

**Rationale**:
- When a filter is defined, the system queries the source connector (Salesforce) with the filter
  criteria and returns the count.
- For Salesforce: SOQL `SELECT COUNT() FROM Contact WHERE CreatedDate > 2020-01-01` is efficient.
- This gives the consultant immediate feedback on how many records will be migrated.
- The estimate is computed on demand (when filters change), not continuously.

**Alternatives considered**:
- No estimation: functional but the consultant flies blind on filter impact.
- Client-side filtering of cached records: inaccurate for large datasets (we only cache a page).

## Decision 4: Mapping Integrity After Schema Changes

**Decision**: Lazy integrity check on plan open — compare mapping field references against current schema snapshots

**Rationale**:
- When a mapping plan is opened, the system compares each field mapping against the current
  source and destination schema snapshots.
- Missing fields (deleted since mapping was created) → mapping flagged as BROKEN with details.
- Changed types → mapping flagged as WARNING with type change details.
- This is a read-time check, not a background job — keeps architecture simple.

**Alternatives considered**:
- Real-time webhook on schema changes: complex, requires live connections, overkill for v0.
- Ignore schema changes: violates data fidelity principle — broken mappings would silently fail at migration time.

## Decision 5: API Structure

**Decision**: RESTful nested routes reflecting the entity hierarchy (plan → object mapping → field mapping → rules)

**Rationale**:
- The entity hierarchy is naturally nested: a plan contains object mappings, which contain field
  mappings, which contain rules.
- RESTful nested routes map directly to this hierarchy.
- Each level has CRUD operations.
- This is a standard Next.js App Router pattern — readable and predictable.

**Alternatives considered**:
- Flat API with query parameters: harder to understand relationships.
- GraphQL: overkill for a well-defined entity hierarchy with no complex queries.
