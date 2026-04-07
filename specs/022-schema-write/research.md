# Research: Schema Write

## Decision: API route nesting

**Chosen**: Routes nested under `/plans/[planId]/connections/[connectionId]/schema-write/...`.

**Rationale**: Schema writes are scoped to a specific destination connection within a plan. The route path makes ownership explicit. The connectionId identifies which adapter to use for the write operation.

**Rejected**: Routes under `/api/connectors/[connectionId]/schema-write`. Loses the plan context, which is needed for audit trail and access control.

## Decision: Pre-submit validation vs. post-submit error handling

**Chosen**: Both. Pre-submit validation checks name uniqueness against the local schema snapshot and type compatibility against the adapter's supported types. Post-submit error handling catches API-level errors (tier limits, reserved words, network failures).

**Rationale**: Pre-validation catches obvious errors without a network round-trip (SC-006). But the destination system may have additional constraints not visible locally (reserved words, tier limits), so robust error handling after the API call is also required.

## Decision: LLM field description context

**Chosen**: The LLM receives a structured prompt with: (1) a metaprompt about the company/market (from plan metadata), (2) the object type, (3) the field name and type, (4) sample values if GDPR-compliant. Returns a 1-2 sentence description.

**Implementation**: Reuse the same `@anthropic-ai/sdk` client pattern from 018, but with a different prompt template. Model: `claude-sonnet-4-20250514`, `max_tokens: 200`, `temperature: 0.3`.

**Rejected**: Reusing the 018 rule-description service directly. The prompt context is different (field description vs. rule explanation). A separate function in `field-description.ts` is cleaner.

## Decision: Schema snapshot refresh after write

**Chosen**: After a successful schema write, the service calls the adapter's `getFields()` for the affected object and updates the local schema snapshot in the database.

**Rationale**: The local snapshot must reflect the newly created/modified field immediately so that the field mapping view shows it. Partial refresh (only the affected object) is more efficient than a full schema re-retrieval.

**Rejected**: Full schema re-retrieval. Too slow for a single field creation -- would re-fetch all objects and fields.

## Decision: "Copy from source field" implementation

**Chosen**: A client-side operation. The UI reads the selected source field's metadata (name, type, picklist values, description) and pre-fills the creation form. No additional API call needed -- source field data is already loaded in the field mapping view.

**Rationale**: Source field metadata is already available in the React state from the field mapping view. Pre-filling is a pure UI operation.

## Decision: Capability gating

**Chosen**: The `canWriteSchema` flag is checked both on the frontend (to show/hide UI elements) and on the backend (to reject API calls). Defense in depth.

**Frontend**: The "Add field" button and field edit modal are conditionally rendered based on the connection's capability flags.

**Backend**: Every schema-write route handler checks `canWriteSchema` before proceeding and returns 403 if false.

## Decision: Adapter type list for field creation

**Chosen**: The available field types for creation/modification come from a new adapter method `getSupportedFieldTypes(): string[]` that returns the types the destination system supports.

**Rationale**: Different systems support different type sets (HubSpot has "string", "number", "date", "enumeration", etc.; Salesforce has "Text", "Number", "Currency", "Picklist", etc.). The adapter knows its system's capabilities.

**Fallback**: If the adapter does not implement `getSupportedFieldTypes()`, use a default set: text, number, date, boolean, picklist.

## Constraint: Source connections are read-only

Schema write features are ONLY available for destination connections. The service rejects any attempt to write to a source connection. The UI does not show write options for source connections.

## Constraint: GDPR configuration for sample values

Sample values are only sent to the LLM when a GDPR compliance flag is enabled (plan-level or system-level setting). When disabled, the prompt omits sample values entirely. The LLM still generates a useful description from the field name, type, and object context.
