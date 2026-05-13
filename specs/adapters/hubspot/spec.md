# Feature Specification: HubSpot Adapter

**Feature**: adapters/hubspot
**Created**: 2026-03-25
**Status**: Draft
**Depends on**: 000-connector-interface, 001-connection, 002-schema-retrieval, 003-object-selection, 004-field-retrieval, 005-record-preview, 006-field-stats, 007-schema-write

## User Story (atomic)

As a consultant, I can connect to HubSpot and use it as a destination system in Carbo-v0, so that I can authenticate, retrieve the full object and property schema, preview existing records with field-level statistics, and create new objects or properties in HubSpot when the source data has no corresponding destination structure.

**Independent Test**: A consultant configures HubSpot Private App credentials, connects to a test portal, sees the portal name confirmed, browses standard objects (contacts, companies, deals, tickets, line_items) and any custom objects, views properties for "contacts" with types and constraints, previews 25 existing records with property stats (null count, distinct values, sample values), creates a new custom property "migration_source_id" on "contacts" of type string, sees it appear in the property list, and disconnects.

**Acceptance Scenarios**:

1. **Given** a valid HubSpot Private App access token, **When** the consultant initiates a connection, **Then** the system validates the token by calling the HubSpot account info endpoint and displays the portal name with CONNECTED status.
2. **Given** valid HubSpot OAuth2 credentials (client ID, client secret, redirect URI), **When** the consultant initiates a connection via OAuth2, **Then** the system redirects to the HubSpot authorization page, exchanges the code for tokens on callback, and displays the portal name with CONNECTED status.

   *Note: The OAuth callback does NOT automatically retrieve schema/properties. Schema retrieval is triggered by the UI layer (feature 002/006) after the callback redirect, allowing the user to confirm the connection first. A manual "Refresh schema" action is also available to re-trigger retrieval on demand when HubSpot properties have been added/removed since the last fetch.*

3. **Given** a CONNECTED HubSpot connection, **When** the system retrieves the object list, **Then** it returns standard objects (contacts, companies, deals, tickets, line_items) via the CRM API v3, plus any custom objects via the Schemas API, each with label, API name, and isCustom flag.
4. **Given** the object list, **When** a custom object query fails because the portal lacks Enterprise tier, **Then** the system reports "Custom objects require HubSpot Enterprise tier" as an informational message and continues with standard objects only — no error is thrown.
5. **Given** a selected object (e.g., contacts), **When** the system retrieves properties, **Then** it calls the Properties API and returns all properties with: label, internal name, data type (string, number, date, datetime, enumeration, boolean, etc.), isRequired, isReadOnly, groupName, and description.
6. **Given** a selected object with records, **When** the consultant requests a record preview, **Then** the system uses the Search API to retrieve paginated records with all property values.
7. **Given** a record preview, **When** the consultant views property stats, **Then** the system calculates and displays per-property statistics: null count, distinct value count, and up to 5 sample values.
8. **Given** a CONNECTED HubSpot connection with schema write capability, **When** the consultant creates a new property on an existing object, **Then** the system calls the Properties API to create the property with the specified label, internal name, type, and group. The property appears in the property list on refresh.
9. **Given** a CONNECTED HubSpot connection on an Enterprise portal, **When** the consultant creates a new custom object, **Then** the system calls the Schemas API to create the object with a name, labels, and primary display property. The object appears in the object list on refresh.
10. **Given** a property creation request with a name that already exists, **When** the request is submitted, **Then** the system rejects it with a clear message indicating the name conflict — no silent overwrite.
11. **Given** a HubSpot API response with status 429 (rate limit), **When** the system detects the rate limit, **Then** it reads the Retry-After header, waits the specified duration, retries with exponential backoff, and logs the rate limit event.
12. **Given** any significant operation, **When** it completes or fails, **Then** it is logged to the audit trail with full details.

## Edge Cases

- HubSpot credentials are invalid or revoked: the system displays a clear error identifying the cause without exposing the access token.
- The HubSpot portal has no custom objects (not Enterprise tier): the system displays only standard objects with an informational note about Enterprise requirement for custom objects.
- A property type is uncommon (calculation, score, rich_text): the system displays the type as reported by HubSpot and flags it as not creatable from Carbo-v0.
- The network connection drops during schema retrieval: the system reports the failure and allows retry without losing the authentication context.
- The HubSpot portal has API rate limits (100 requests per 10 seconds for Private Apps, 100 requests per 10 seconds for OAuth apps): the system detects 429 responses, reads Retry-After, and retries automatically.
- A property creation fails because the portal has reached its custom property limit: the system reports the limit clearly with the HubSpot error message.
- A custom object creation fails because the portal doesn't have Enterprise tier: the system reports this as a tier limitation, not a generic error.
- A property with the same internal name but different type already exists: the system blocks creation and shows the existing property details for comparison.
- A Private App token expires or is rotated: the system detects the 401 response, transitions to EXPIRED status, and prompts re-entry of the new token.
- The consultant tries to create a property with an invalid type (e.g., a type not supported by HubSpot): the system validates locally before sending to HubSpot and reports the invalid type.

## Functional Requirements

- **FR-001**: The adapter MUST implement the Connector Interface (feature 000) with capabilities: canRead=true, canWrite=false, canWriteSchema=true.
- **FR-002**: The adapter MUST support two authentication methods: Private App (bearer token) and OAuth2 (authorization code flow). Both methods MUST validate the token by calling the HubSpot account info endpoint.
- **FR-003**: The adapter MUST retrieve standard objects (contacts, companies, deals, tickets, line_items) via the CRM API v3 and map them to `ConnectorObject`.
- **FR-004**: The adapter MUST attempt to retrieve custom objects via the Schemas API. If the API returns a 403 or tier-related error, the adapter MUST log the limitation and continue with standard objects only — no exception propagated to the consultant.
- **FR-005**: The adapter MUST retrieve properties for a selected object via the Properties API and map them to `ConnectorField` (apiName, label, dataType, isRequired, isReadOnly, groupName).
- **FR-006**: The adapter MUST retrieve records via the Search API and return paginated results as `PaginatedRecords`.
- **FR-007**: The adapter MUST calculate per-property statistics (null count, distinct count, sample values) from retrieved records and return them as `FieldStats`.
- **FR-008**: The adapter MUST allow creating new properties on existing objects via the Properties API, supporting types: string, number, date, datetime, enumeration, boolean.
- **FR-009**: The adapter MUST allow creating new custom objects via the Schemas API (requires Enterprise tier). If the portal lacks Enterprise, the adapter MUST return a clear error indicating the tier requirement.
- **FR-010**: The adapter MUST validate property creation requests locally before sending to HubSpot: name uniqueness check (against cached schema), type validity, required fields present.
- **FR-011**: The adapter MUST handle rate limits by detecting 429 responses, reading the Retry-After header, and applying exponential backoff. Rate limit events MUST be logged.
- **FR-012**: The adapter MUST handle token expiration: for OAuth2, attempt token refresh using the refresh token; for Private App, transition to EXPIRED and prompt re-authentication.
- **FR-013**: The adapter MUST log every significant operation (connect, disconnect, schema retrieval, record read, property/object creation, rate limit, error) to the audit trail (Constitution Principle VI).
- **FR-014**: The adapter MUST use @hubspot/api-client as the SDK for all HubSpot API interactions.

## Key Entities

This adapter does not introduce new entities beyond those defined in the Connector Interface (feature 000). It implements:
- `ConnectorConnection` as a HubSpot portal connection (Private App token or OAuth2)
- `ConnectorSchema` as a CRM API schema snapshot (standard + custom objects)
- `ConnectorObject` as a HubSpot standard or custom object
- `ConnectorField` as a HubSpot property with full metadata

Additionally, for schema write operations:
- Property creation maps to the `createField` method of the Connector Interface
- Object creation maps to the `createObject` method of the Connector Interface

## Success Criteria

- A consultant can connect to a HubSpot test portal and browse its full schema in under 2 minutes.
- 100% of standard objects and their properties are retrieved — no silent omissions.
- Custom objects are retrieved when the portal has Enterprise tier; a clear message is shown otherwise.
- Record preview loads the first page in under 5 seconds for objects with up to 100,000 records.
- A consultant can create a new property on an existing object in under 10 seconds and see it in the schema immediately.
- Rate limit handling prevents 429 errors from disrupting the consultant's workflow.
- All operations are traceable in the audit trail.

## Assumptions

- The consultant has a HubSpot account with API access (appropriate Hub and tier).
- @hubspot/api-client is the SDK for all HubSpot API interactions.
- The HubSpot CRM API v3 is the integration mechanism for objects and properties.
- Custom object creation requires Enterprise tier — this is detected and reported gracefully.
- Property creation supports common types: string, number, date, datetime, enumeration, boolean. Uncommon types (calculation, score, rich_text) are displayed in schema but not creatable from Carbo-v0.
- Record reading is for preview purposes — the adapter reads but does not write records (record writing is part of feature 021 — migration execution).
- A single adapter instance targets one HubSpot portal at a time.
- Private App authentication does not support token refresh — a new token must be entered if the old one is revoked or rotated.
