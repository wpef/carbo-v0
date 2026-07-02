# Research: Schema Write

## Decision 1: ConnectorAdapter Extension for modifyField

**Decision**: Extend the `ConnectorAdapter` interface (000) with an optional `modifyField` method alongside the existing `createObject` and `createField`.

**Rationale**: The spec requires modifying existing destination fields (US-2: name, type, picklist values, description, group). The current interface only has `createObject?` and `createField?`. A `modifyField?` method is needed.

```typescript
// Addition to ConnectorAdapter (000):
modifyField?(
  connectionId: string,
  objectApiName: string,
  fieldApiName: string,
  updates: Partial<Omit<ConnectorField, 'apiName' | 'isReadOnly' | 'isUnique'>>
): Promise<ConnectorField>
```

All three write methods remain optional, gated by `capabilities.canWriteSchema`. If `canWriteSchema=false`, these methods are `undefined` and the UI hides all schema write features (FR-001).

**Alternatives**: Separate `canModifyField` capability flag (over-granular for v0 -- HubSpot supports all three if it supports any), single `writeSchema(operation)` method with union types (less discoverable, harder to type).

## Decision 2: Pre-Validation Before API Call

**Decision**: Validate field name uniqueness and type compatibility locally before sending the request to the destination system.

**Rationale**: FR-008 requires "validate inputs before submitting: name uniqueness (against known schema), type compatibility (against destination's supported types), required fields." Catching these errors locally provides instant feedback (~0ms) vs. a round-trip to the external API (~2-5s). The local check uses the current schema snapshot -- if the snapshot is stale, the remote API will catch the conflict as a second line of defense.

Local validation catches:
- Name already exists in snapshot (field or object)
- Type not in the destination connector's supported types list
- Missing required fields (name, type, picklist values when type is picklist)

**Alternatives**: Only remote validation (slower UX, no instant feedback), optimistic creation with rollback (destination APIs don't support transactional rollback).

## Decision 3: LLM Description Generation Strategy

**Decision**: Use the Claude API (`@anthropic-ai/sdk`) with a structured prompt that includes: company/market metaprompt (configured at project level), object type context, field name and type, and sample values (when GDPR-compliant).

**Rationale**: FR-005 specifies the exact context elements for LLM generation. The Claude API is already in the tech stack (constitution). The prompt is assembled server-side to avoid exposing the API key to the client.

Prompt structure:
```
System: You are a CRM data migration expert. Generate a clear, professional field description.
User: 
Company context: {metaprompt}
Object: {objectLabel} ({objectApiName})
Field: {fieldName} (type: {fieldType})
{sampleValues ? `Sample values: ${sampleValues.join(', ')}` : ''}

Generate a 1-2 sentence description for this field that a business user would understand.
```

**Alternatives**: OpenAI API (not in the stack), local LLM (not available in v0), template-based descriptions (too rigid, can't adapt to context).

## Decision 4: Snapshot Refresh After Write

**Decision**: After a successful schema write, automatically refresh the local schema snapshot for the affected connection (FR-011).

**Rationale**: The newly created or modified field/object must appear in the destination field list immediately. Without a refresh, the consultant would see stale data until the next manual refresh. The refresh is the same operation used by features 003/007 -- we call the existing refresh service.

The refresh triggers the integrity check (017), but since we just added a field/object (not removed one), the check should find no new issues. Edge case: if the destination system returns unexpected data after the write (e.g., type normalization differs from what was requested), the integrity check would catch it.

**Alternatives**: Optimistic local update without refresh (snapshot diverges from reality), manual refresh required (bad UX -- consultant just created a field and can't see it).

## Decision 5: Supported Field Types Per Connector

**Decision**: Each connector adapter exposes a `getSupportedFieldTypes()` method (or a static list) that the UI uses to populate the type dropdown in the creation form.

**Rationale**: FR-008 requires type compatibility validation "against destination's supported types." HubSpot supports ~15 field types, Salesforce supports ~30. The creation form must only offer types the destination can handle.

Implementation: Add a `supportedFieldTypes?: string[]` property to `ConnectorCapabilities` (or a separate method). The DemoAdapter sets this to a sensible default list. Real adapters populate it from their API documentation.

```typescript
// Addition to ConnectorCapabilities (000):
supportedFieldTypes?: string[]  // e.g., ['string', 'number', 'date', 'datetime', 'enumeration', 'bool']
```

**Alternatives**: Hardcode type lists per connector in the UI (not extensible), allow any type and let the API reject (poor UX).

## Decision 6: Copy-From-Source Field Pre-fill

**Decision**: When "Copy from source field" is selected, the form pre-fills name, type, picklist values, and description from the selected source field. The type is mapped to the nearest equivalent destination type using the compatibility matrix.

**Rationale**: FR-003 specifies exact pre-fill behavior. The type mapping is necessary because source and destination systems use different type vocabularies (e.g., Salesforce "Picklist" -> HubSpot "enumeration").

The mapping uses the same type normalization used in 012 (both types normalized to canonical categories, then the canonical category maps to the destination's native type name).

**Alternatives**: Copy raw type name (would fail if type names differ between systems), always set type to "text" (loses information).

## Decision 7: Property Groups

**Decision**: The creation and modification forms include an optional "group" field for property groups (HubSpot) or field groups (Salesforce). If the specified group does not exist, behavior depends on the connector:
- HubSpot: The API creates the group automatically if it doesn't exist.
- Salesforce: The API returns an error. The form should pre-populate the group dropdown from existing groups.

**Rationale**: FR-002 includes "group (optional)" in the field creation form. The group behavior is connector-specific and delegated to the adapter implementation.

The form populates the group dropdown by reading existing groups from the schema snapshot (if available) or allowing free-text input.

**Alternatives**: Always omit group (loses organization capability), require group to exist beforehand (too restrictive for HubSpot which auto-creates).

## Decision 8: Error Handling Strategy

**Decision**: Three-layer error handling:
1. **Local validation** (instant): name conflicts, missing required fields, unsupported types.
2. **Remote API errors** (after submission): tier limits, reserved words, system-specific rejections.
3. **Network errors** (transient): timeout, connection drop.

All three layers produce user-facing error messages (FR-009). All errors (including successful operations) are logged to SchemaWriteOperation for audit (FR-010).

**Rationale**: The spec lists specific error scenarios: "Custom property limit reached", "reserved word conflict", "destination temporarily unavailable", "network drops during write". Each maps to one of the three layers.

**Alternatives**: Single error handler (loses granularity for UX feedback), retry logic for network errors (spec says "allows retry" implicitly via the form staying open, not automatic retry).
