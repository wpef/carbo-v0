# Research: Field Mapping

## Decision 1: Table-Based UI vs SVG Two-Column View

**Decision**: Table-based UI for field mapping. Mapped fields shown in a table with columns: Source Field (name + type badge) -> Dest Field (name + type badge) | Status (OK/Warning/Incompatible) | Actions (Configure, Delete). Unmapped fields shown separately with a "Map to..." dropdown.

**Rationale**: Session learning #1 from v3 — the SVG two-column approach was fundamentally broken:
- Wrong coordinate system (SVG inside bridge column vs full container)
- Infinite render loops (`useLayoutEffect` with array deps)
- `hsl()` wrapping `oklch()` CSS values producing invisible colors

A table layout is more reliable, accessible, maintainable, and works naturally with 200+ fields. The visual link metaphor matters more for object mapping (fewer items, spatial relationships) than for field mapping (many items, data-oriented work).

**Alternatives**: Fixed SVG approach (fragile, re-implementing all session fixes), Canvas (harder to style), drag-and-drop (poor accessibility).

## Decision 2: Auto-Match Strategy — Registry + Name Fallback

**Decision**: Union of two strategies:
1. **Registry pairs**: Hardcoded equivalences per adapter combo (e.g., `Website` SF -> `domain` HS)
2. **Name-based fallback**: Case-insensitive `apiName` match for fields not already covered by the registry

Both run in a single pass. Registry pairs take precedence. Fallback only matches fields where neither side is already matched.

**Rationale**: Session learnings #2-3 from v3:
- Registry-only was too narrow (only 4 of 12 fields matched for a typical object)
- Name-only missed semantic equivalences (e.g., `Website` != `domain`)
- The union approach catches both explicit semantic pairs AND obvious name matches
- Case-insensitive matching is essential (`Phone` vs `phone` — session learning #3)

**Known registry pairs for `salesforce:hubspot`**:
- Contact: `FirstName->firstname`, `LastName->lastname`, `Email->email`, `Phone->phone`, `Title->jobtitle`, `Website->website`
- Account/Company: `Name->name`, `Website->domain`, `Phone->phone`, `Industry->industry`, `AnnualRevenue->annualrevenue`
- Opportunity/Deal: `Name->dealname`, `Amount->amount`, `CloseDate->closedate`, `StageName->dealstage`

**Alternatives**: ML-based matching (overkill, violates Principle IX), edit distance (false positives on short names), schema metadata matching (connectors don't expose enough metadata).

## Decision 3: Type Compatibility Matrix

**Decision**: A 5x5 matrix mapping normalized type pairs to `CompatibilityStatus`:

| | Text | Number | Date | Picklist | Boolean |
|---|---|---|---|---|---|
| **Text** | COMPATIBLE | INCOMPATIBLE | INCOMPATIBLE | WARNING | INCOMPATIBLE |
| **Number** | COMPATIBLE | COMPATIBLE | INCOMPATIBLE | WARNING | INCOMPATIBLE |
| **Date** | COMPATIBLE | INCOMPATIBLE | COMPATIBLE | WARNING | INCOMPATIBLE |
| **Picklist** | COMPATIBLE | INCOMPATIBLE | INCOMPATIBLE | COMPATIBLE | WARNING |
| **Boolean** | COMPATIBLE | COMPATIBLE | INCOMPATIBLE | WARNING | COMPATIBLE |

- **COMPATIBLE**: Direct copy or trivial conversion (D4 informational message)
- **WARNING**: Requires migration logic (D1 value equivalence or D2 LLM prompt)
- **INCOMPATIBLE**: Cannot be linked meaningfully (D3 error, CSV fallback)

**Rationale**: Spec assumption states the matrix is 5x5 with text, number, date, picklist, boolean. This aligns with the Type Compatibility Matrix in spec 013. The matrix is symmetric for COMPATIBLE/INCOMPATIBLE but not for WARNING (direction matters for picklist conversions).

**Type normalization table** (30+ raw types -> 5 canonical categories):

| Canonical | Raw types (Salesforce) | Raw types (HubSpot) |
|---|---|---|
| text | `string`, `textarea`, `url`, `email`, `phone`, `id`, `reference`, `address`, `encryptedstring` | `string`, `phonenumber`, `enumeration` (when single) |
| number | `int`, `double`, `currency`, `percent`, `long` | `number` |
| date | `date`, `datetime`, `time` | `date`, `datetime` |
| picklist | `picklist`, `multipicklist`, `combobox` | `enumeration` (when multiple options) |
| boolean | `boolean` | `bool`, `boolean` |

Unknown types default to `text` (most permissive — Spec assumption).

**Alternatives**: Strict unknown-type rejection (too restrictive — many custom field types would fail), per-connector matrices (unnecessary duplication — normalization handles differences).

## Decision 4: LinkStatus Computation

**Decision**: `LinkStatus` is a computed enum, not a stored field. Derived at query time from:

```
if (field/object absent from current schema) -> BROKEN
if (compatibilityStatus === INCOMPATIBLE)    -> RED_DASHED
if (no migration logic exists)               -> RED_SOLID
if (logic exists but not validated)           -> ORANGE
if (logic exists and validated)              -> GREEN
```

Precedence: BROKEN > RED_DASHED > RED_SOLID > ORANGE > GREEN.

**Rationale**: Spec assumption states "Link color status is derived from: (1) type compatibility, (2) whether migration logic exists, and (3) whether that logic is validated. This is a computed state, not stored separately." Storing it would create cache invalidation problems (logic changes, schema refresh, drift detection all affect status).

**Alternatives**: Stored enum (stale data risk, requires update triggers), event-sourced status (over-engineering for a read-heavy, write-light scenario).

## Decision 5: Migration Preview Architecture

**Decision**: Client-side preview computation. The sidebar:
1. Loads 25 source records via existing `getRecords` API (page 1, pageSize 25)
2. For each mapped field, applies value equivalences (if any) as a simple lookup: `sourceValue -> equivalenceMap[sourceValue] || sourceValue`
3. Renders a two-column Source | Destination view. Transformed values highlighted in amber.
4. No JS transforms, no LLM classification in preview (those require server-side execution).

**Rationale**: Client-side computation keeps the preview instant and reactive. Value equivalences are small lookup tables (typically <50 entries) that can be applied in-memory. Limiting to 25 records keeps the payload manageable. The preview is a confidence tool, not a full migration simulation.

**Alternatives**: Server-side preview with full transform pipeline (too slow for interactive use), real-time LLM classification (expensive, slow, not needed for preview confidence).

## Decision 6: One-to-One Constraint Enforcement

**Decision**: Enforce 1:1 at both the database level (unique constraints) and the API validation level.

```prisma
@@unique([objectMappingId, sourceFieldName])    // one source field maps to at most one destination
@@unique([objectMappingId, destinationFieldName]) // one destination receives at most one source
```

**Rationale**: FR-005 requires strict 1:1 within an object mapping. The same source field CAN appear in different object mappings (e.g., if Contact is mapped to both Contacts and Leads). Database-level constraints make violations impossible even under concurrent requests.

**Alternatives**: Application-level only (race condition risk), allow many-to-many (contradicts spec).

## Decision 7: Drift Flags Orthogonal to LinkStatus

**Decision**: `driftFlag` is a separate property on the field mapping row, independent of `linkStatus`. Both are rendered simultaneously (badge stack). Drift flags are informational (no editability impact except when `linkStatus=BROKEN`, which is handled by existing logic).

**Rationale**: FR-Drift-FM-2 explicitly states drift flags are orthogonal to linkStatus. A mapping can be `GREEN` (logic validated) AND have `driftFlag='Desormais obligatoire'`. Merging them into a single status would lose information.

Coverage categories:
- **Already covered by linkStatus**: `OBJECT_REMOVED`, `FIELD_REMOVED`, `FIELD_TYPE_CHANGED` (to incompatible) -> BROKEN
- **New driftFlag needed**: `FIELD_TYPE_CHANGED` (still compatible), `FIELD_BECAME_REQUIRED`, `FIELD_BECAME_OPTIONAL`, `FIELD_LABEL_CHANGED`, `PICKLIST_VALUE_ADDED/REMOVED`, `FIELD_READONLY_CHANGED`, `FIELD_UNIQUE_CHANGED`, `FIELD_ADDED`

**Alternatives**: Single merged status (loses granularity), separate drift page (too disconnected from field mapping context).
