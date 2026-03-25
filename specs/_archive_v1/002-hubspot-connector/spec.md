# Feature Specification: HubSpot Destination Connector

**Feature Branch**: `002-hubspot-connector`
**Created**: 2026-03-19
**Status**: Draft
**Input**: User description: "HubSpot destination connector — connect to HubSpot, read schema, read records, create objects and fields in destination schema"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Connect to a HubSpot portal and browse its schema (Priority: P1)

The consultant enters their HubSpot credentials. The system authenticates via OAuth2 and retrieves
the full list of available objects (Contacts, Companies, Deals, Tickets, custom objects, etc.). The
consultant selects an object and sees all its properties with their type (string, number, date,
enumeration, etc.) and constraints (required, read-only, unique).

**Why this priority**: Without destination schema access, no mapping is possible. The consultant
needs to see what objects and properties exist in HubSpot before deciding how to map source fields.

**Independent Test**: A consultant can connect to a HubSpot test portal, browse objects, select
"Contacts", and see all properties with their types and constraints — without doing anything else.

**Acceptance Scenarios**:

1. **Given** valid HubSpot credentials, **When** the consultant initiates a connection, **Then**
   the system authenticates successfully and displays a confirmation with the portal name.
2. **Given** a successful connection, **When** the consultant browses objects, **Then** the full
   list of standard and custom objects is displayed with their labels and API names.
3. **Given** a selected object (e.g. Contacts), **When** the consultant views its properties,
   **Then** each property is displayed with: label, internal name, data type, required/optional
   status, and group info.
4. **Given** a HubSpot portal with custom objects, **When** the consultant browses objects,
   **Then** custom objects appear alongside standard objects, clearly identified as custom.

---

### User Story 2 - Read records from a HubSpot object (Priority: P2)

The consultant has selected a destination object and wants to preview its existing data. This helps
them understand what data already exists in HubSpot, check for duplicates, and inform their mapping
decisions (e.g., whether to overwrite or merge).

**Why this priority**: Seeing existing destination data is critical for migration planning —
the consultant needs to know what's already there to avoid duplicates and data conflicts.

**Independent Test**: A consultant can connect to HubSpot, select "Contacts", and view a paginated
list of existing records with all property values.

**Acceptance Scenarios**:

1. **Given** a selected object with records, **When** the consultant requests a data preview,
   **Then** a paginated list of records is displayed with all property values, and basic property
   stats are shown (null count, distinct value count, sample values).
2. **Given** a large object (100,000+ records), **When** the consultant requests a preview,
   **Then** the system loads the first page of results without timeout and allows navigation to
   subsequent pages.
3. **Given** a selected object, **When** the consultant views records, **Then** the total record
   count for that object is displayed.

---

### User Story 3 - Create new objects and properties in HubSpot (Priority: P3)

During mapping, the consultant realizes that certain source data has no corresponding destination
in HubSpot. They need to create new custom objects or add new properties to existing objects
directly from Carbo-v0, without switching to the HubSpot admin panel. This happens when:
- The source has data that doesn't fit any existing HubSpot structure
- The consultant wants to restructure data during migration
- Unmapped source fields need a new destination property to avoid data loss

**Why this priority**: This is the key differentiator of a destination connector vs. a source
connector. Without schema write capability, the consultant must manually create fields in HubSpot,
breaking their workflow. However, read access (US1 + US2) is usable on its own.

**Independent Test**: A consultant can create a new custom property on the Contacts object in
HubSpot from within Carbo-v0, then see it appear in the property list upon refresh.

**Acceptance Scenarios**:

1. **Given** an existing HubSpot object (e.g. Contacts), **When** the consultant creates a new
   property (label, internal name, type, group), **Then** the property is created in HubSpot
   and appears in the property list.
2. **Given** a HubSpot portal with custom objects enabled, **When** the consultant creates a new
   custom object with a name and primary property, **Then** the object is created in HubSpot
   and appears in the object list.
3. **Given** a newly created property, **When** the consultant adds it to a property group,
   **Then** the property is correctly grouped in HubSpot.
4. **Given** a property creation request with a name that already exists, **When** the consultant
   submits, **Then** the system displays a clear error indicating the name conflict — no silent
   overwrite.
5. **Given** a property creation, **When** the operation succeeds or fails, **Then** the action
   is logged in the audit trail with full details (property name, type, target object, result).

---

### Edge Cases

- HubSpot credentials are invalid or the account is locked: the system displays a clear error
  message identifying the cause without exposing sensitive details.
- The HubSpot portal has no custom objects: the system displays only standard objects without error.
- A property type is uncommon (e.g., calculation, score): the system displays the type as reported
  by HubSpot with a note that it may require special handling.
- The network connection drops during schema retrieval: the system reports the failure and allows
  retry without losing the authentication context.
- The HubSpot portal has API rate limits: the system detects 429 responses, pauses, and retries
  automatically or informs the consultant of the wait time.
- A property creation fails because the portal has reached its custom property limit: the system
  reports the limit clearly.
- A custom object creation fails because the portal doesn't have the custom objects feature: the
  system reports this as a plan/tier limitation, not a generic error.
- A property with the same internal name but different type already exists: the system blocks
  creation and shows the existing property details.

## Clarifications

### Session 2026-03-19

- Q: How many schema snapshots should be retained? → A: Current + previous only (same strategy as Salesforce connector).
- Q: Should the record preview include data quality insights? → A: Yes — basic stats per property (null count, distinct values, sample values), consistent with Salesforce connector.
- Q: Should property creation support all HubSpot property types? → A: Support the common types (string, number, date, datetime, enumeration, boolean). Uncommon types (calculation, score, rich text) are displayed but not creatable from Carbo-v0.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow the consultant to authenticate with a HubSpot portal using
  OAuth2 (private app or public app flow).
- **FR-002**: The system MUST retrieve and display the complete list of objects (standard and
  custom) from the connected HubSpot portal, with label and API name.
- **FR-003**: The system MUST retrieve and display all properties for a selected object, including:
  label, internal name, data type, required/optional, read-only, and group info.
- **FR-004**: The system MUST retrieve and display records from a selected object in paginated form.
- **FR-005**: The system MUST display the total record count for a selected object.
- **FR-005b**: The system MUST display basic property-level stats alongside the record preview:
  null count, distinct value count, and sample values for each property.
- **FR-006**: The system MUST persist connection information for reuse across sessions (credentials
  stored securely, not in plaintext).
- **FR-007**: The system MUST detect and handle expired sessions by re-authenticating or prompting
  the consultant.
- **FR-008**: The system MUST allow the consultant to refresh the schema to reflect changes made
  in HubSpot since the last retrieval.
- **FR-009**: The system MUST allow the consultant to create new properties on existing HubSpot
  objects, specifying: label, internal name, data type, group, and description.
- **FR-010**: The system MUST allow the consultant to create new custom objects in HubSpot,
  specifying: name, primary display property, and description.
- **FR-011**: The system MUST validate property/object creation requests before sending them to
  HubSpot (name uniqueness, type compatibility, required fields).
- **FR-012**: The system MUST log every significant operation (connection, schema retrieval, record
  read, property/object creation, error) to the audit trail.
- **FR-013**: The system MUST handle HubSpot API rate limits gracefully, informing the consultant
  and retrying when possible.

### Key Entities

- **HubSpotConnection**: Represents a configured connection to a HubSpot portal. Holds portal
  identity, authentication state, and last connection timestamp. One connection per destination
  in a project.
- **DestinationSchema**: A snapshot of the HubSpot portal's schema at a point in time. Contains
  the list of objects and their properties. The system retains only the current and previous
  snapshot (two maximum), enabling diff comparison on refresh.
- **DestinationObject**: An object (standard or custom) within the schema. Has a label, API name,
  and a list of properties.
- **DestinationProperty**: A property within an object. Has a label, internal name, data type,
  constraints (required, read-only), and group info.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A consultant can connect to a HubSpot test portal and browse its full schema in
  under 2 minutes from first interaction.
- **SC-002**: 100% of standard and custom objects and their properties are retrieved — no silent
  omissions.
- **SC-003**: Record preview loads the first page of results in under 5 seconds for objects with
  up to 100,000 records.
- **SC-004**: A consultant can create a new property on an existing object in under 1 minute,
  and see it appear in the schema immediately after creation.
- **SC-005**: All connector operations (connect, browse, read, create, refresh) are traceable in
  the audit trail without requiring the consultant to enable logging manually.

## Assumptions

- The consultant has a HubSpot account with API access (Marketing Hub, Sales Hub, or CMS Hub
  with appropriate tier).
- HubSpot OAuth2 authentication is used (public app or private app token).
- The HubSpot CRM API v3 is the integration mechanism.
- Custom object creation requires a HubSpot Enterprise tier — the system detects and reports
  this gracefully if the portal lacks the feature.
- Property creation supports common types: string, number, date, datetime, enumeration, boolean.
  Uncommon types (calculation, score, rich text) are displayed in schema but not creatable from
  Carbo-v0.
- Record reading is for preview purposes — the system reads but does not write records in this
  feature (record writing is part of feature 006 — migration execution).
- A single connection targets one HubSpot portal at a time.
