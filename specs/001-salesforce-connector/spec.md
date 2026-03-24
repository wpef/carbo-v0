# Feature Specification: Salesforce Source Connector

**Feature Branch**: `001-salesforce-connector`
**Created**: 2026-03-19
**Status**: Draft
**Input**: User description: "Salesforce source connector — connect to Salesforce, read schema (objects, fields, types), read records for migration"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Connect to a Salesforce org and browse its schema (Priority: P1)

The consultant enters their Salesforce credentials. The system authenticates and retrieves the full
list of available objects (Contacts, Accounts, Leads, custom objects, etc.). The consultant selects
an object and sees all its fields with their type (text, number, date, picklist, lookup, etc.) and
constraints (required, unique, read-only).

**Why this priority**: Without schema access, no mapping is possible. This is the foundational
capability that every downstream feature depends on.

**Independent Test**: A consultant can connect to a Salesforce sandbox, browse objects, select
"Contact", and see all fields with their types and constraints — without doing anything else.

**Acceptance Scenarios**:

1. **Given** valid Salesforce credentials, **When** the consultant initiates a connection, **Then**
   the system authenticates successfully and displays a confirmation with the org name.
2. **Given** a successful connection, **When** the consultant browses objects, **Then** the full
   list of standard and custom objects is displayed with their labels and API names.
3. **Given** a selected object (e.g. Contact), **When** the consultant views its fields, **Then**
   each field is displayed with: label, API name, data type, required/optional status, and
   relationship info (if lookup/master-detail).
4. **Given** a Salesforce org with custom objects (e.g. `Invoice__c`), **When** the consultant
   browses objects, **Then** custom objects appear alongside standard objects, clearly identified
   as custom.

---

### User Story 2 - Read records from a Salesforce object (Priority: P2)

The consultant has selected an object and wants to preview its data before creating a mapping plan.
The system retrieves a sample of records from the selected object so the consultant can understand
the actual data shape, spot anomalies, and make informed mapping decisions. In addition to the raw
paginated data, the system displays basic stats per field: null count, distinct value count, and
sample values — giving the consultant a quick data quality overview without full profiling.

**Why this priority**: Schema alone is not enough — consultants need to see real data to understand
what they're migrating (empty fields, inconsistent formats, unexpected values). This directly
informs transformation rules in the mapping plan.

**Independent Test**: A consultant can connect to Salesforce, select "Contact", and view a paginated
list of records with all field values — without creating any mapping.

**Acceptance Scenarios**:

1. **Given** a selected object with records, **When** the consultant requests a data preview,
   **Then** a paginated list of records is displayed with all field values, and basic field stats
   are shown (null count, distinct value count, sample values).
2. **Given** a large object (100,000+ records), **When** the consultant requests a preview,
   **Then** the system loads the first page of results without timeout or performance degradation,
   and allows navigation to subsequent pages.
3. **Given** a selected object, **When** the consultant views records, **Then** the total record
   count for that object is displayed.
4. **Given** fields with relationships (lookups), **When** records are displayed, **Then**
   relationship fields show a meaningful reference (name or ID of the related record), not just
   a raw foreign key.

---

### User Story 3 - Reconnect and refresh schema after changes (Priority: P3)

The consultant returns to a previously connected Salesforce org after some time. The system
reconnects (re-authenticating if the session has expired) and refreshes the schema to reflect any
changes made in Salesforce since the last connection (new fields, deleted objects, type changes).

**Why this priority**: Salesforce schemas evolve. The consultant needs confidence that they're
working with the current state. However, this is less critical than initial connection and data
reading.

**Independent Test**: A consultant can reconnect to a Salesforce org after session expiry, see
the refreshed schema, and identify any differences from the previous connection.

**Acceptance Scenarios**:

1. **Given** a previously saved connection whose session has expired, **When** the consultant
   reopens the project, **Then** the system re-authenticates transparently or prompts for
   credentials if re-authentication fails.
2. **Given** a schema that changed since the last connection (e.g. new field added), **When** the
   consultant refreshes the schema, **Then** the updated schema is displayed and changes since
   the last snapshot are highlighted.
3. **Given** a schema where an object or field was deleted in Salesforce, **When** the consultant
   refreshes, **Then** the deleted element is flagged as missing with a clear warning.

---

### Edge Cases

- Salesforce credentials are invalid or the account is locked: the system displays a clear error
  message identifying the cause (wrong password, locked account, IP restriction) without exposing
  sensitive details.
- The Salesforce org has no custom objects: the system displays only standard objects without error.
- A field type is uncommon or proprietary (e.g. encrypted text, external lookup): the system
  displays the type as reported by Salesforce with a note that it may require special handling.
- The network connection drops during schema retrieval: the system reports the failure and allows
  retry without losing the authentication context.
- The Salesforce org contains 500+ objects (large enterprise): the system loads and displays them
  without performance degradation, with search/filter to navigate.
- A record contains null or empty values for most fields: these are displayed as explicitly empty,
  not hidden or omitted.
- API rate limits are reached during record retrieval: the system reports the rate limit, pauses,
  and resumes automatically or informs the consultant of the wait time.
- A field is restricted by field-level security: the field appears in the field list marked "no
  access"; its values are not shown in the record preview but the field is not hidden.

## Clarifications

### Session 2026-03-19

- Q: How many schema snapshots should be retained? → A: Current + previous only (enables diff, minimal storage).
- Q: Should the record preview include data quality insights? → A: Yes — basic stats per field (null count, distinct values, sample values) alongside raw paginated data.
- Q: How should field-level security (hidden/restricted fields) be handled? → A: Show all fields including inaccessible ones, mark restricted fields as "no access".

### Session 2026-03-24

- Q: Salesforce OAuth2 requires PKCE? → A: Yes. All Connected Apps now require PKCE (code_challenge + code_verifier, S256 method). The jsforce library does not handle PKCE natively — token exchange must be done via direct HTTP POST to /services/oauth2/token with code_verifier.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow the consultant to authenticate with a Salesforce org using
  OAuth2 (Connected App flow) with PKCE (Proof Key for Code Exchange, S256 method). The token
  exchange MUST include the code_verifier parameter, as Salesforce requires PKCE for all
  Connected Apps.
- **FR-002**: The system MUST retrieve and display the complete list of objects (standard and
  custom) from the connected Salesforce org, with label and API name.
- **FR-003**: The system MUST retrieve and display all fields for a selected object, including:
  label, API name, data type, required/optional, unique, read-only, and relationship info. Fields
  that are inaccessible due to field-level security MUST still be listed but clearly marked as
  "no access".
- **FR-004**: The system MUST retrieve and display records from a selected object in paginated form.
- **FR-005**: The system MUST display the total record count for a selected object.
- **FR-005b**: The system MUST display basic field-level stats alongside the record preview: null
  count, distinct value count, and sample values for each field.
- **FR-006**: The system MUST persist connection information for reuse across sessions (credentials
  stored securely, not in plaintext).
- **FR-007**: The system MUST detect and handle expired sessions by re-authenticating or prompting
  the consultant.
- **FR-008**: The system MUST allow the consultant to refresh the schema to reflect changes made
  in Salesforce since the last retrieval.
- **FR-009**: The system MUST log every significant operation (connection, schema retrieval, record
  read, error) to the audit trail.
- **FR-010**: The system MUST handle Salesforce API rate limits gracefully, informing the consultant
  and retrying when possible.

### Key Entities

- **SalesforceConnection**: Represents a configured connection to a Salesforce org. Holds org
  identity, authentication state, and last connection timestamp. One connection per source in a
  project.
- **SourceSchema**: A snapshot of the Salesforce org's schema at a point in time. Contains the list
  of objects and their fields. Used as the "source" input for the mapping plan feature. The system
  retains only the current and previous snapshot (two maximum), enabling diff comparison on refresh.
- **SourceObject**: An object (standard or custom) within the schema. Has a label, API name, and
  a list of fields.
- **SourceField**: A field within an object. Has a label, API name, data type, constraints
  (required, unique, read-only), and relationship metadata if applicable.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A consultant can connect to a Salesforce sandbox and browse its full schema in under
  2 minutes from first interaction.
- **SC-002**: 100% of standard and custom objects and their fields are retrieved — no silent
  omissions.
- **SC-003**: Record preview loads the first page of results in under 5 seconds for objects with
  up to 100,000 records.
- **SC-004**: Schema refresh detects and reports all structural changes (added/removed/modified
  objects and fields) since the last snapshot.
- **SC-005**: All connector operations (connect, browse, read, refresh) are traceable in the audit
  trail without requiring the consultant to enable logging manually.

## Assumptions

- The consultant has a Salesforce account with API access enabled (API Enabled permission).
- The Salesforce org has a Connected App configured for OAuth2 authentication (or the consultant
  can create one).
- The Salesforce REST API (or Metadata API for schema) is the integration mechanism. The specific
  API choice will be determined during planning.
- This connector is read-only — it does not create, modify, or delete data or schema in Salesforce.
- Record reading is for preview and migration purposes — the system does not need to support
  real-time sync or streaming.
- A single connection targets one Salesforce org at a time.

## Connected App Setup Prerequisites

The consultant must configure a Connected App in Salesforce before using this connector:

1. **Create the Connected App**: Setup → App Manager → New Connected App
2. **Enable OAuth Settings**: check "Enable OAuth Settings"
3. **Callback URL**: must exactly match the `SALESFORCE_CALLBACK_URL` env var (e.g.,
   `http://localhost:3001/api/connectors/salesforce/callback`)
4. **OAuth Scopes**: select "Full access (full)" and "Perform requests at any time
   (refresh_token, offline_access)"
5. **IP Relaxation**: in Manage → Edit Policies, set to "Relax IP restrictions" (required for
   localhost development)
6. **Permitted Users**: set to "All users may self-authorize"
7. **Propagation delay**: after creating or modifying the Connected App, wait 10-15 minutes for
   Salesforce to propagate changes

**Environment variables required**:
- `SALESFORCE_CLIENT_ID` — Consumer Key from the Connected App
- `SALESFORCE_CLIENT_SECRET` — Consumer Secret from the Connected App
- `SALESFORCE_CALLBACK_URL` — must match the Connected App callback URL exactly
- `SALESFORCE_LOGIN_URL` (optional) — defaults to `https://login.salesforce.com`, use
  `https://test.salesforce.com` for sandbox orgs
