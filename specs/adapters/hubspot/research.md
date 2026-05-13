# Research: HubSpot Adapter

## Decision: Authentication strategy (dual method)

**Chosen**: Support both Private App (bearer token) and OAuth2 (authorization code flow). Discriminated via a `method` field in HubSpotConfig: `{ method: 'private-app', accessToken }` or `{ method: 'oauth2', clientId, clientSecret, redirectUri }`.

**Rationale**: FR-002 mandates both. Private App is simpler (just paste a token), suitable for testing and small portals. OAuth2 is required for production use and token refresh.

**Implementation**:
- Private App: `POST /api/connectors/hubspot/auth` with `{ method: 'private-app', accessToken }`. Validate by calling `GET /account-info/v3/details`.
- OAuth2: `GET /api/connectors/hubspot/auth?planId=...` redirects to HubSpot authorization page.

## Decision: @hubspot/api-client initialization

**Chosen**: Create `new hubspot.Client({ accessToken })` for both auth methods. Private App tokens and OAuth2 access tokens are used identically after auth.

**Rationale**: The @hubspot/api-client treats all tokens the same way. The difference is only in how the token is obtained and refreshed.

## Decision: Standard objects list

**Chosen**: Hardcoded list in `hubspot-constants.ts`:
- `contacts` (label: "Contacts")
- `companies` (label: "Companies")
- `deals` (label: "Deals")
- `tickets` (label: "Tickets")
- `line_items` (label: "Line Items")

**Rationale**: HubSpot CRM API v3 does not have a "list all object types" endpoint. Standard objects are known and fixed. Custom objects are discovered via the Schemas API.

**Rejected**: Querying the Schemas API for standard objects. The Schemas API only returns custom objects.

## Decision: Custom objects retrieval

**Chosen**: Call `GET /crm/v3/schemas` via `client.crm.schemas.coreApi.getAll()`. If the API returns 403 or tier-related error, log informational message and continue with standard objects only.

**Rationale**: FR-004. Custom objects require Enterprise tier. Graceful degradation is mandatory.

## Decision: Property retrieval

**Chosen**: `client.crm.properties.coreApi.getAll(objectType)` returns all properties for an object type. Map to ConnectorField:
- `apiName` = `property.name`
- `label` = `property.label`
- `dataType` = `property.type` (string, number, date, datetime, enumeration, boolean)
- `isRequired` = derived from `property.fieldType` or form requirements
- `isReadOnly` = `property.calculated || property.readOnlyValue`
- `groupName` = `property.groupName`

**Rationale**: FR-005. Direct mapping from HubSpot Properties API response.

## Decision: Record retrieval via Search API

**Chosen**: `client.crm.contacts.searchApi.doSearch()` (and equivalent for other objects) with `limit`, `after`, and `properties` array.

**Rationale**: FR-006. The Search API supports pagination, filtering, and property selection. More flexible than the basic list endpoint for preview purposes.

**Pagination**: HubSpot Search API uses cursor-based pagination (`after` token) rather than offset. Map to PaginatedRecords by tracking page number and `hasNextPage` from response.

## Decision: Schema write — property creation

**Chosen**: `client.crm.properties.coreApi.create(objectType, propertyCreateInput)` with:
- `name`: internal name
- `label`: display label
- `type`: string | number | date | datetime | enumeration | bool
- `fieldType`: derived from type (text, number, date, etc.)
- `groupName`: defaults to "contactinformation" or object-specific default group

**Rationale**: FR-008. Creatable types are limited to common types. Uncommon types (calculation, score, rich_text) are flagged as not creatable.

**Local validation** (FR-010): Before calling HubSpot API:
1. Check name uniqueness against cached property list
2. Validate type is in creatable types list
3. Ensure required fields (name, label, type) are present

## Decision: Schema write — custom object creation

**Chosen**: `client.crm.schemas.coreApi.create(objectSchemaEgg)` with name, labels, primaryDisplayProperty, and required properties.

**Rationale**: FR-009. Requires Enterprise tier — detect and report gracefully on 403.

## Decision: Rate limit handling

**Chosen**: Detect 429 responses, read `Retry-After` header (seconds), wait, then retry with exponential backoff (multiply by 2 on each retry, max 5 retries). Log each rate limit event.

**Rationale**: FR-011. HubSpot enforces 100 requests per 10 seconds for Private Apps and OAuth apps. The `Retry-After` header indicates how long to wait.

**Implementation**: Wrap @hubspot/api-client calls in a retry function. On 429, parse Retry-After, wait, retry.

## Decision: Token lifecycle

**Chosen**:
- Private App: No refresh possible. On 401, set status to EXPIRED, prompt re-authentication.
- OAuth2: Attempt refresh via `POST /oauth/v1/token` with `grant_type=refresh_token`. On refresh failure, set EXPIRED.

**Rationale**: FR-012. Private App tokens are manually managed in HubSpot — no programmatic refresh.

## API Reference

### HubSpot CRM API v3 endpoints (via @hubspot/api-client)
- Account info: `GET /account-info/v3/details`
- Properties: `client.crm.properties.coreApi.getAll(objectType)`
- Property create: `client.crm.properties.coreApi.create(objectType, input)`
- Search: `client.crm.{objectType}.searchApi.doSearch(searchRequest)`
- Schemas (custom objects): `client.crm.schemas.coreApi.getAll()`
- Schema create: `client.crm.schemas.coreApi.create(objectSchemaEgg)`

### Environment variables
- `HUBSPOT_PRIVATE_APP_TOKEN`: For Private App auth (optional if using OAuth2)
- `HUBSPOT_CLIENT_ID`: For OAuth2 auth
- `HUBSPOT_CLIENT_SECRET`: For OAuth2 auth
- `HUBSPOT_CALLBACK_URL`: OAuth2 redirect URI (e.g., `http://localhost:3001/api/connectors/hubspot/callback`)
