# Feature Specification: Destination Connection

**Feature**: 006-destination-connection
**Created**: 2026-03-27
**Status**: Draft
**Depends on**: 001-migration-plan, 000-connector-interface

## User Story (atomic)

As a consultant, within my migration plan, I can connect to a destination system by choosing
an adapter type (e.g., HubSpot) and providing credentials. The connection is stored as part
of the plan.

**Independent Test**: A consultant opens a plan that already has a source connected, clicks
"Configure Destination", selects "HubSpot", authenticates, and sees CONNECTED within the plan.

**Acceptance Scenarios**:

1. **Given** a plan, **When** the consultant opens the destination step, **Then** available
   destination adapters are displayed (e.g., HubSpot).
2. **Given** valid credentials, **When** the consultant authenticates, **Then** the connection
   is stored linked to the plan.
3. **Given** a connected destination, **When** the consultant views the plan, **Then** the
   destination step shows CONNECTED and the workflow advances.
4. **Given** a connected destination, **When** the consultant disconnects, **Then** dependent
   data is cleaned up.

## Functional Requirements

- **FR-001**: The destination connection step MUST be accessible only within a plan context.
- **FR-002**: The system MUST display available destination adapters from the adapter registry.
- **FR-003**: The connection MUST be stored linked to the plan (planId → destinationConnectionId).
- **FR-004**: A "Use Demo Data" option MUST be available as an alternative to real authentication.

## Key Entities

No new entities — uses ConnectorConnection linked to MigrationPlan.destinationConnectionId.

## Success Criteria

- **SC-001**: Destination connection completes in under 30 seconds.

## Assumptions

- One destination per plan.
- The actual auth mechanism is handled by the adapter.
