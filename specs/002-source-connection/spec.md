# Feature Specification: Source Connection

**Feature**: 002-source-connection
**Created**: 2026-03-27
**Status**: Draft
**Depends on**: 001-migration-plan, 000-connector-interface

## User Story (atomic)

As a consultant, within my migration plan, I can connect to a source system by choosing an
adapter type (e.g., Salesforce) and providing credentials. The connection is stored as part
of the plan.

**Independent Test**: A consultant opens a plan, clicks "Configure Source", selects "Salesforce"
from the adapter list, authenticates, and sees the connection status as CONNECTED within the plan.

**Acceptance Scenarios**:

1. **Given** a plan with no source connection, **When** the consultant opens the source step,
   **Then** a list of available source adapters is displayed (e.g., Salesforce).
2. **Given** a selected adapter type, **When** the consultant provides valid credentials,
   **Then** the system authenticates and stores the connection linked to the plan.
3. **Given** a connected source, **When** the consultant views the plan, **Then** the source
   step shows CONNECTED with the system name, and the workflow advances to the next step.
4. **Given** a connected source, **When** the consultant disconnects, **Then** dependent data
   (schema, selections) is cleaned up and the step reverts to pending.

## Edge Cases

- The consultant switches adapter type after connecting: the old connection and all dependent
  data are removed, the new adapter flow starts fresh.
- Authentication fails: clear error message, the step remains pending.

## Functional Requirements

- **FR-001**: The source connection step MUST be accessible only within a plan context.
- **FR-002**: The system MUST display available source adapters from the adapter registry.
- **FR-003**: The connection MUST be stored linked to the plan (planId → sourceConnectionId).
- **FR-004**: Disconnecting MUST cascade-delete dependent data (schema snapshots, selections).
- **FR-005**: A "Use Demo Data" option MUST be available as an alternative to real authentication.
  It creates a mock connection with seeded schema data. Clearly labeled as demo.

## Key Entities

No new entities — uses ConnectorConnection (from 000) linked to MigrationPlan.sourceConnectionId.

## Success Criteria

- **SC-001**: Source connection completes in under 30 seconds (excluding external auth flow time).

## Assumptions

- The actual auth mechanism is handled by the adapter, not this feature.
- One source per plan.

## Demo Mode

The connection step MAY offer "Use Demo Data" which creates a mock connection with
pre-seeded schema. This replaces real authentication only — the rest of the plan
(mapping, documents) works identically with demo or real connections.
