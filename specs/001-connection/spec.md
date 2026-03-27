# Feature Specification: Connection

**Feature**: 001-connection
**Created**: 2026-03-25
**Status**: Draft
**Depends on**: 000-connector-interface

## User Story (atomic)

As a consultant, I can connect to a system by providing credentials, see the connection status, and disconnect when done, so that I have a reliable authenticated session to retrieve schema and data from the source or destination.

**Independent Test**: A consultant enters credentials for a system, the connection is validated and displayed as CONNECTED, the consultant leaves and returns to see the connection restored, then disconnects and confirms the connection is removed.

**Acceptance Scenarios**:

1. **Given** valid credentials for a system, **When** the consultant initiates a connection, **Then** the system authenticates successfully and displays a CONNECTED status with the system name.
2. **Given** invalid credentials, **When** the consultant initiates a connection, **Then** the system displays a clear error message identifying the cause (wrong credentials, access denied, network error) without exposing sensitive details.
3. **Given** a CONNECTED connection, **When** the consultant returns after a session, **Then** the connection is restored from the database and the status is verified (re-authenticated if needed).
4. **Given** a connection whose token has expired, **When** the system detects the expiration, **Then** it attempts a transparent re-authentication (e.g., token refresh). If that fails, the status is set to EXPIRED and the consultant is prompted to re-enter credentials.
5. **Given** a CONNECTED connection, **When** the consultant clicks disconnect, **Then** tokens are revoked (if supported), connection data is cleaned up, and the status is removed.
6. **Given** a connection in ERROR state, **When** the consultant views the connection, **Then** the error reason is displayed with a "Retry" action.

## Edge Cases

- Network drops during initial connection: the system reports failure and allows retry without losing any entered configuration.
- The external system is temporarily unavailable (503): the system reports the issue and allows retry.
- The consultant has multiple connections (one source, one destination): each is independent and managed separately.
- Token refresh succeeds silently: the consultant never sees the EXPIRED state; the connection remains CONNECTED.
- Token refresh fails (revoked access): the status transitions to EXPIRED and the consultant must re-authenticate.
- The consultant disconnects a connection that has dependent data (schema snapshots, selections): the system warns before proceeding and cleans up dependent data.

## Functional Requirements

- **FR-001**: The system MUST allow the consultant to initiate a connection by providing system-specific credentials or configuration (OAuth2, API key, token — determined by the adapter).
- **FR-002**: The system MUST validate the connection by performing a test call to the external system before marking it as CONNECTED.
- **FR-003**: The system MUST persist connection information (identifier, type, status, encrypted credentials/tokens, timestamps) in the database.
- **FR-004**: The system MUST manage three connection statuses: CONNECTED (active and usable), EXPIRED (token expired, needs refresh or re-auth), ERROR (connection failed).
- **FR-005**: The system MUST attempt transparent token refresh when a connection's token expires. If refresh fails, the status MUST transition to EXPIRED.
- **FR-006**: The system MUST allow the consultant to disconnect, revoking tokens (if the system supports it) and removing connection data.
- **FR-007**: The system MUST restore previously saved connections on return, verifying their status by performing a lightweight health check.
- **FR-008**: The system MUST log every connection event (connect, disconnect, refresh, error) to the audit trail.
- **FR-009**: Credentials and tokens MUST be stored encrypted at rest, never in plaintext.
- **FR-010**: The system MUST display the connection status and last-connected timestamp to the consultant at all times.

## Key Entities

- **Connection**: Represents a configured and authenticated connection to an external system. Fields: id, name, connectorType, status (CONNECTED | EXPIRED | ERROR), config (encrypted), lastConnectedAt, createdAt.

## Success Criteria

- **SC-001**: A consultant can connect to a system and see CONNECTED status within 30 seconds of providing valid credentials.
- **SC-002**: A restored connection is health-checked and its status is accurate within 10 seconds of page load.
- **SC-003**: Token refresh is transparent to the consultant — no manual action required when a refresh token is available and valid.
- **SC-004**: All connection lifecycle events are present in the audit trail.
- **SC-005**: No credentials or tokens are stored in plaintext in the database.

## Assumptions

- Each connection targets one external system instance (e.g., one CRM org, one marketing platform portal).
- The actual authentication mechanism (OAuth2, API key, etc.) is implemented by the connector adapter, not by this feature. This feature orchestrates the flow.
- A project has at most one source connection and one destination connection.
- The database is SQLite (local-first for v0), migratable to PostgreSQL.

## Workflow Navigation

After a successful connection, the UI MUST display a call-to-action guiding the consultant
to the next step:
- If this is a source connection: "Source connected. Next: [Retrieve Schema →]"
- If this is a destination connection: "Destination connected. Next: [Retrieve Schema →]"
- If both source and destination are connected: "Both systems connected. Next: [Create Mapping Plan →]"
