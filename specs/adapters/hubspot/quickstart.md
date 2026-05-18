# Quickstart: HubSpot Adapter

**Feature**: adapters/hubspot
**Date**: 2026-05-18

## Prerequisites

### Option A: Private App (recommended for development)

1. In HubSpot: Settings > Integrations > Private Apps > Create a private app
2. Name: "Carbo Migration" (or any name)
3. Scopes: enable all CRM read/write scopes + Schemas read/write
4. Create app and copy the access token (`pat-na1-...`)
5. No environment variables needed -- the token is entered directly in the UI

### Option B: OAuth2 (production)

1. In HubSpot Developer Portal: create a new app
2. Set redirect URI to match `HUBSPOT_REDIRECT_URI` (e.g., `http://localhost:3000/api/connectors/hubspot/oauth/callback`)
3. Enable required OAuth scopes (see research.md for full list)
4. Copy Client ID and Client Secret

**Environment variables** (`.env.local`):
```
HUBSPOT_CLIENT_ID=your-client-id
HUBSPOT_CLIENT_SECRET=your-client-secret
HUBSPOT_REDIRECT_URI=http://localhost:3000/api/connectors/hubspot/oauth/callback
```

## Integration Scenario 1: Connect and Browse Schema

**Actor**: Consultant connecting HubSpot as a destination system.

1. Consultant opens a migration plan and navigates to the Destination step
2. Selects "HubSpot" as the adapter type
3. Enters Private App token (or clicks "Connect via OAuth2")
4. App validates the token and displays: "Connected to Acme Corp (Portal ID: 12345678)"
5. Schema retrieval triggers automatically (per 006 FR-016)
6. Consultant sees 5 standard objects (contacts, companies, deals, tickets, line_items)
7. If Enterprise portal: custom objects also appear with an `isCustom` badge
8. If non-Enterprise: informational note "Custom objects require HubSpot Enterprise tier"
9. Consultant clicks "contacts" to browse properties
10. Sees 87 properties with types (string, number, enumeration, etc.), groups, and read-only flags

**Result**: Full destination schema is available for mapping.

## Integration Scenario 2: Preview Records and Assess Data Quality

**Actor**: Consultant checking existing destination data before mapping.

1. Consultant selects "contacts" object
2. Clicks "Preview records"
3. Sees 25 records with all property values (paginated)
4. Reviews field stats: `email` has 0 nulls, `firstname` has 342 nulls out of 15,420
5. Pages to page 2, 3, etc. to see more data
6. Notes that the `phone` field has high null rate -- may need a transformation rule

**Result**: Consultant understands the current state of destination data.

## Integration Scenario 3: Create a Custom Property for Migration

**Actor**: Consultant preparing the destination schema before migration execution.

1. Consultant is on the schema write page for "contacts"
2. Clicks "Create property"
3. Fills in: name=`migration_source_id`, label="Migration Source ID", type=string, group=contactinformation
4. App validates locally: name does not conflict, type is creatable
5. Clicks "Create"
6. App calls HubSpot Properties API, property is created
7. Property appears in the property list after refresh
8. Audit trail shows: "Created property 'migration_source_id' on 'contacts'"

**Result**: Destination schema is extended to accommodate source data.

## Integration Scenario 4: Handle Rate Limits Gracefully

**Actor**: Consultant browsing a large portal with many objects.

1. Consultant triggers multiple operations in quick succession (browse objects, load properties, preview records)
2. HubSpot returns 429 (rate limited)
3. App detects the 429, reads Retry-After header (e.g., 2 seconds)
4. App pauses, then retries automatically
5. Consultant sees a brief loading indicator but the operation completes without error
6. Audit trail logs: "Rate limit hit on GET /crm/v3/properties/contacts. Retried after 2s."

**Result**: Rate limits are handled transparently.

## Integration Scenario 5: Reconnect After Token Expiration (OAuth2)

**Actor**: Consultant returning after 30+ minutes (OAuth2 access token expired).

1. Consultant opens the destination page
2. App detects 401 on the first API call
3. App attempts token refresh using the stored refresh token
4. Refresh succeeds: new access token stored, operation retried
5. Consultant sees no interruption -- schema loads normally
6. Audit trail logs: "OAuth2 token refreshed for portal 12345678"

If refresh fails (refresh token revoked):
1. App transitions connection status to EXPIRED
2. Consultant sees: "Connection expired. Please reconnect."
3. Consultant clicks "Reconnect" and re-authenticates

**Result**: Token lifecycle is managed transparently for OAuth2; clearly for Private App.

## Integration with Downstream Features

### Feature 006: Destination Connection

The HubSpot adapter is registered in the adapter registry and is available as a destination adapter choice. The connection is stored as `MigrationPlan.destinationConnectionId` with `type: "hubspot"`.

### Feature 007: Destination Schema Retrieval

The adapter's `getSchema()` and `getFields()` methods provide the destination-side schema snapshot used by the schema retrieval feature. All objects are available (no selection step for destination).

### Feature 022: Schema Write (future)

The adapter's `createField()` and `createObject()` methods (`canWriteSchema=true`) are consumed by the schema write feature to extend the HubSpot schema before migration execution.

### Connector SDK (future)

The HubSpot adapter's service layer (`src/lib/adapters/hubspot/`) alongside the Salesforce adapter will inform the Connector SDK extraction. Both adapters implement `ConnectorAdapter` and follow the same file structure.

## Dependencies

- **Depends on**: 000-connector-interface (types), 006-destination-connection (plan integration)
- **Used by**: 007 (destination schema retrieval), 012 (field mapping), 022 (schema write)
