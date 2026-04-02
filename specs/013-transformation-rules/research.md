# Research: Migration Logic

## Decision 1: MigrationLogic Storage Architecture

**Options**:
- **Single polymorphic table**: One MigrationLogic table with a `sectionType` discriminator and nullable columns for each section type's data.
- **Table-per-section**: Separate tables for ValueEquivalence data and ClassificationPrompt data, linked to a base MigrationLogic record.
- **JSON blob**: Store section-specific data as a JSON column.

**Decision**: Table-per-section. A base `MigrationLogic` record holds the common fields (fieldMappingId, sectionType, status). `ValueEquivalence` rows hold individual source-to-destination value pairs. `ClassificationPrompt` holds the prompt text. This is normalized, queryable, and avoids nullable columns.

D3 (Error) and D4 (Informational) have no user-defined data -- they only need the base MigrationLogic record with the appropriate sectionType and status.

## Decision 2: D1 Value Equivalence Interaction

**Options**:
- **Drag-and-drop lines**: Visual but complex (drag state, drop zones, hit testing).
- **Click-click (same as field linking)**: Click source value, click destination value. Simple state machine.
- **Dropdown per source value**: Each source value has a dropdown of destination values.

**Decision**: Click-click pattern, consistent with the object and field linking interactions (011, 012). State machine: `idle -> sourceValueSelected(value) -> idle` with equivalence recorded on second click. Lines are drawn as SVG paths between value items, reusing the link rendering pattern.

## Decision 3: LLM Classification Integration (D2)

**Architecture**:
1. The `classify/` endpoint receives: promptText, destinationPicklistValues, sampleSourceValues (4-5).
2. It calls Claude API with a structured prompt:
   ```
   Given these categories: [destValues]
   Classify the following text value into one of these categories.
   User instruction: [promptText]
   Value: [sampleValue]
   Respond with only the category name.
   ```
3. One API call per sample value (parallel). Total: 4-5 calls.
4. Returns: `[{ sourceValue, classification, confidence? }]`.

**Fallback**: If `ANTHROPIC_API_KEY` is not set or API fails, return `{ sourceValue, classification: null, error: "Classification unavailable" }`. The prompt can still be saved.

**Debounce**: When the consultant edits the prompt, debounce 1 second before re-triggering classification. Avoids excessive API calls during typing.

## Decision 4: Save vs. Validate Semantics

- **Save**: Persists the migration logic with status `DEFINED`. Link color changes to orange.
- **Validate**: Persists the migration logic with status `VALIDATED`. Link color changes to green.
- Both use the same PUT endpoint with a `status` field in the request body.
- For D3 (Error): neither Save nor Validate is available. The MigrationLogic record is auto-created with status `INCOMPATIBLE` when the modal opens (if it doesn't exist yet).
- For D4 (Informational): Save is hidden. Only Validate is available (and Cancel). No user-defined data to save.

## Decision 5: Auto-Equivalence for D1

When the D1 section opens, auto-link values with case-insensitive exact match. This is a simple `O(n*m)` comparison (source values x destination values) which is fine for typical picklist sizes (< 100 values each). No fuzzy matching -- "Web" and "Online" are NOT auto-linked.

The auto-equivalences are ephemeral until the consultant clicks Save. If the consultant closes without saving, auto-equivalences are discarded.

## Decision 6: Sample Source Values for D2

The 4-5 example rows require real source record values. These are fetched via the record preview capability (feature 009). If feature 009 is not yet implemented, the D2 section shows placeholder text: "Connect to source system to see example classifications."

The `classify/` endpoint accepts `sampleSourceValues` directly -- it does not fetch them itself. The frontend fetches samples and passes them.
