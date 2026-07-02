# Research: Migration Logic

## Decision 1: Type Compatibility Matrix Encoding

**Decision**: A pure function `getSectionType(sourceType: string, destinationType: string): SectionType` backed by a `Map<string, SectionType>` keyed on `${normalizedSource}:${normalizedDest}`. The 5 canonical type categories (text, number, date, picklist, checkbox) produce a 25-entry matrix. Unknown types are normalized to "text" (most permissive fallback, consistent with 012's type normalization).

**Rationale**: The spec defines a fixed 25-entry matrix (5x5). A Map lookup is O(1), readable, and easily testable. The function is pure -- no side effects, no DB access -- so it can be used on both client and server.

**Alternatives**: Nested switch/case (verbose, error-prone), enum-based matrix (TypeScript enums add runtime code), database-stored rules (over-engineered for a fixed matrix).

## Decision 2: Section Type Determination

**Decision**: Four section types as a union: `VALUE_EQUIVALENCE | PROMPT | ERROR | INFORMATIONAL`. The section type is derived at render time from the type matrix, not stored as a column on MigrationLogic. This keeps the matrix as the single source of truth and avoids stale data if the matrix is updated.

**Rationale**: The section type is a function of source/destination field types, which are already stored on the FieldMapping. Storing it redundantly on MigrationLogic would create a sync problem if field types change (e.g., after a schema refresh).

**Alternatives**: Store sectionType on MigrationLogic (creates redundancy), compute on every API call (acceptable but we already compute on the client).

## Decision 3: Auto-Equivalence Algorithm (D1)

**Decision**: Case-insensitive exact match. When the D1 section opens for the first time (no existing equivalences), the system compares source picklist values to destination picklist values using `value.toLowerCase().trim()`. Matches are pre-populated as initial equivalences. The consultant can adjust before saving.

**Rationale**: The spec explicitly states "equivalent names for D1 auto-linking means case-insensitive string match." Fuzzy matching (e.g., Levenshtein, synonym tables) is explicitly out of scope. Auto-equivalence runs on every modal open (not gated like auto-match), because it is a UI convenience for pre-populating a form, not a persistent auto-decision (no Principle IX conflict -- the user must still Save/Validate).

**Alternatives**: Fuzzy matching with edit distance (spec excludes this), synonym table (spec excludes: "Web" = "Online" is NOT automatic), no auto-equivalence (poor UX for the common case where values are identical).

## Decision 4: LLM Integration for D2 Classification

**Decision**: Server-side API route `POST /classify` that receives the classification prompt, destination picklist values, and 4-5 sample source values. The route calls Claude API (`@anthropic-ai/sdk`) with a system prompt that constrains the output to the destination picklist values. Returns an array of `{ sourceValue, classifiedValue }` pairs.

**Rationale**: LLM calls must be server-side to protect the API key. The classify endpoint is separate from the main migration-logic CRUD route because classification is a preview action (not persisted until Save). Debounced client-side: 500ms after the consultant stops editing the prompt.

**Alternatives**: Client-side LLM call (exposes API key), batch classification of all records (too expensive for preview -- we only need 4-5 examples), OpenAI API (constitution specifies `@anthropic-ai/sdk`).

## Decision 5: Upsert Pattern for Migration Logic

**Decision**: `PUT /migration-logic` performs an upsert. If MigrationLogic exists for the fieldMappingId, it updates; otherwise, it creates. For D1, the upsert deletes all existing ValueEquivalence rows and re-creates them from the request payload (replace strategy). For D2, it upserts the ClassificationPrompt text.

**Rationale**: The modal always sends the complete state on Save/Validate. A replace strategy for value equivalences is simpler and avoids diff computation. Transaction wraps the delete-then-create to ensure atomicity.

**Alternatives**: PATCH with diff (complex for value equivalence arrays), separate create/update endpoints (unnecessary for a modal that always sends full state), soft-delete old equivalences (adds complexity, no audit benefit since the audit log captures the full action).

## Decision 6: Link Status Integration with 012

**Decision**: The `linkStatus` (GREEN, ORANGE, RED_SOLID, RED_DASHED) is computed at read time from: (1) type compatibility matrix result, (2) whether MigrationLogic exists, (3) MigrationLogic.status (DRAFT/DEFINED/VALIDATED). The computation lives in a shared utility `computeLinkStatus()` used by both the field mapping list and the migration logic modal.

**Rationale**: The spec for 012 states "link color status is derived... this is a computed state, not stored separately." Computing it from existing data avoids sync issues and keeps the DB schema lean.

**Alternatives**: Store linkStatus on FieldMapping (creates sync issues with MigrationLogic changes), trigger-based updates (adds DB complexity).

## Decision 7: D3/D4 Sections -- No Persistence Needed

**Decision**: D3 (Error) and D4 (Informational) sections do not create MigrationLogic records. D3 has no Save/Validate buttons (only Cancel). D4 creates a MigrationLogic record with sectionType=INFORMATIONAL and status=VALIDATED on Validate click (the logic is trivial -- "copy as-is" -- but the record is needed to distinguish "validated copy" from "no logic defined").

**Rationale**: D3 is an error state -- no logic can be defined. D4 needs a record so the link status can transition from RED_SOLID to GREEN when the consultant clicks Validate. Without the record, the system cannot distinguish "user validated the simple copy" from "user hasn't reviewed this mapping yet."

**Alternatives**: Auto-create D4 records (violates Principle IX -- the consultant must explicitly validate), skip D4 records and treat compatible types as implicitly validated (loses the explicit review gate).
