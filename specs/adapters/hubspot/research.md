# Research: HubSpot Adapter

**Feature**: adapters/hubspot
**Date**: 2026-05-18

## Decision 1: SDK Choice -- @hubspot/api-client

**Decision**: Use `@hubspot/api-client` (official HubSpot Node.js SDK) for all API interactions.

**Rationale**:
- Constitution mandates `@hubspot/api-client` as the HubSpot SDK (Technology Standards).
- The SDK wraps all CRM API v3 endpoints: contacts, companies, deals, tickets, custom objects, properties, schemas, search.
- Provides typed responses, automatic retry on transient errors, and built-in OAuth2 token management.
- Version: latest stable (v12.x as of 2026). Install: `npm install @hubspot/api-client`.

**SDK initialization**:
```typescript
import { Client } from '@hubspot/api-client'

// Private App
const client = new Client({ accessToken: 'pat-xxx' })

// OAuth2
const client = new Client({ accessToken: oauthAccessToken })
```

**Alternatives considered**:
- Raw HTTP with `fetch`: rejected -- would reimplement pagination, error handling, and retry logic that the SDK provides.
- `hubspot` (community package): rejected -- less maintained, fewer types, not the official SDK.

## Decision 2: Authentication Strategy

**Decision**: Support two methods -- Private App (bearer token) and OAuth2 (authorization code flow).

### Private App (simpler, recommended for development)

**Flow**:
1. Consultant enters a Private App access token (created in HubSpot Settings > Integrations > Private Apps).
2. Adapter validates the token by calling the account info endpoint: `GET /account-info/v3/api-usage/daily` or `GET /account-info/v3/details` (SDK: `client.apiRequest({ path: '/account-info/v3/details' })`).
3. On success: store token in connection config, set status CONNECTED, display portal name.

**Token characteristics**:
- Private App tokens start with `pat-na1-` (region-specific prefix).
- Tokens do not expire automatically but can be revoked in the HubSpot UI.
- No refresh mechanism -- if revoked, the consultant must create a new token.
- Scoped to the Private App's permissions (CRM read/write, schemas, etc.).

### OAuth2 (production-ready)

**Flow**:
1. Consultant clicks "Connect via OAuth2".
2. Adapter builds authorization URL: `https://app.hubspot.com/oauth/authorize?client_id=...&redirect_uri=...&scope=...&state=...`.
3. HubSpot redirects back with `code` query parameter.
4. Adapter exchanges code for tokens: `POST https://api.hubapi.com/oauth/v1/token` with `grant_type=authorization_code`.
5. Store access token + refresh token in connection config.

**Token characteristics**:
- Access token expires after 30 minutes (1800 seconds).
- Refresh token expires after 6 months of non-use. Refreshing resets the 6-month window.
- Refresh: `POST https://api.hubapi.com/oauth/v1/token` with `grant_type=refresh_token`.

**Required OAuth scopes**:
```
crm.objects.contacts.read
crm.objects.contacts.write
crm.objects.companies.read
crm.objects.companies.write
crm.objects.deals.read
crm.objects.deals.write
crm.objects.custom.read
crm.objects.custom.write
crm.schemas.contacts.read
crm.schemas.companies.read
crm.schemas.deals.read
crm.schemas.custom.read
crm.schemas.custom.write
```

**Note**: Scopes must match the HubSpot app configuration exactly. Requesting a scope not enabled on the app causes a silent OAuth failure.

**Environment variables** (OAuth2 only):
- `HUBSPOT_CLIENT_ID` -- from HubSpot Developer Portal
- `HUBSPOT_CLIENT_SECRET` -- from HubSpot Developer Portal
- `HUBSPOT_REDIRECT_URI` -- must match the app callback URL (e.g., `http://localhost:3000/api/connectors/hubspot/oauth/callback`)

**Alternatives considered**:
- OAuth2 only: rejected -- Private App is much simpler for development and testing. Many consultants use Private Apps for internal tools.
- API key (deprecated): rejected -- HubSpot deprecated hapikey authentication in 2022. Not supported.

## Decision 3: CRM API v3 -- Object Retrieval

**Decision**: Standard objects via CRM API v3 endpoints; custom objects via Schemas API.

### Standard Objects

The 5 standard CRM objects are known and hardcoded:
- `contacts` -- CRM contacts
- `companies` -- CRM companies
- `deals` -- CRM deals
- `tickets` -- Service Hub tickets
- `line_items` -- Product line items

Each is accessed via its dedicated endpoint (e.g., `client.crm.contacts`).

**Mapping to ConnectorObject**:
```typescript
{
  apiName: 'contacts',
  label: 'Contacts',
  description: 'HubSpot CRM contacts',
  isCustom: false,
  isSelected: false  // destination: all objects available, no selection step
}
```

### Custom Objects (Enterprise tier only)

Custom objects are retrieved via the Schemas API:
```typescript
const schemas = await client.crm.schemas.coreApi.getAll()
// Returns: { results: [{ objectTypeId, name, labels, ... }] }
```

**Tier detection**: If the Schemas API returns 403 or a response indicating the portal lacks Enterprise, the adapter logs an informational message and continues with standard objects only (FR-004).

**Mapping to ConnectorObject**:
```typescript
{
  apiName: schema.objectTypeId,  // e.g., '2-12345' or the fully qualified ID
  label: schema.labels.singular,
  description: schema.description,
  isCustom: true,
  isSelected: false
}
```

**Alternatives considered**:
- Dynamic discovery of standard objects: rejected -- HubSpot does not have a `describeGlobal` equivalent. The standard objects are well-known and stable.

## Decision 4: Properties API -- Field Retrieval

**Decision**: Use the Properties API (`GET /crm/v3/properties/{objectType}`) via the SDK.

**SDK call**:
```typescript
const properties = await client.crm.properties.coreApi.getAll('contacts')
// Returns: { results: [{ name, label, type, fieldType, groupName, ... }] }
```

**Property metadata mapping to ConnectorField**:

| HubSpot Property | ConnectorField | Notes |
|---|---|---|
| `name` | `apiName` | Internal property name |
| `label` | `label` | Display label |
| `type` | `dataType` | string, number, date, datetime, enumeration, bool |
| `fieldType` | (informational) | text, textarea, select, checkbox, etc. |
| `groupName` | `groupName` (extended) | Property group |
| `description` | (informational) | Property description |
| `modificationMetadata.readOnlyValue` | `isReadOnly` | |
| `hasUniqueValue` | `isUnique` | |
| required (via `validationRules`) | `isRequired` | Check validation rules |

**Extended ConnectorField for HubSpot**: The `ConnectorField` interface is system-agnostic. HubSpot-specific metadata (groupName, fieldType, description) is stored in the adapter's internal types and surfaced where needed.

**Type mapping**:

| HubSpot `type` | HubSpot `fieldType` | Notes |
|---|---|---|
| `string` | text, textarea, phonenumber, etc. | General text |
| `number` | number | Numeric |
| `date` | date | Date only |
| `datetime` | date | Date + time |
| `enumeration` | select, radio, checkbox | Picklist/multiselect |
| `bool` | booleancheckbox | Boolean |
| `object_coordinates` | -- | Geolocation (not creatable) |

**Non-creatable types**: `calculation`, `score`, `rich_text`, `object_coordinates`. These are displayed in the schema but flagged as not creatable from Carbo-v0 (spec edge case).

**Alternatives considered**:
- Fetching properties on-demand per object: rejected -- the Properties API returns all properties in one call, which is efficient. Caching per object in the schema snapshot.

## Decision 5: Search API -- Record Retrieval

**Decision**: Use the CRM Search API (`POST /crm/v3/objects/{objectType}/search`) for record retrieval.

**SDK call**:
```typescript
const response = await client.crm.contacts.searchApi.doSearch({
  limit: 25,
  after: '0',    // cursor-based pagination
  properties: ['firstname', 'lastname', 'email'],
  sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }]
})
```

**Pagination model**:
- HubSpot Search API uses cursor-based pagination (`after` parameter), not offset-based.
- The response includes `paging.next.after` for the next cursor.
- Maximum `limit` per request: 100 records.
- Maximum total results from Search API: 10,000 (HubSpot hard limit).

**Mapping to ConnectorAdapter.getRecords (1-indexed per FR-012)**:
- `page=1`: first request with `after=0` (or omitted).
- `page=N` (N>1): walk cursors from page 1 to page N. Cache cursors for visited pages to avoid re-walking.
- **Cursor caching strategy**: store `Map<page, afterCursor>` in memory per connection+object. `page=1` -> `after=undefined`, response provides the `after` for `page=2`, etc.

**Alternatives considered**:
- List API (`GET /crm/v3/objects/{objectType}`): simpler but does not support filtering or sorting. Search API is more powerful and returns the same structure.
- GraphQL API: rejected -- not available for all object types and has different pagination semantics.

## Decision 6: Schema Write -- Properties and Custom Objects

**Decision**: Use Properties API for property creation, Schemas API for custom object creation.

### Property Creation (FR-008)

**SDK call**:
```typescript
await client.crm.properties.coreApi.create('contacts', {
  name: 'migration_source_id',
  label: 'Migration Source ID',
  type: 'string',
  fieldType: 'text',
  groupName: 'contactinformation'
})
```

**Creatable types** (FR-008): `string`, `number`, `date`, `datetime`, `enumeration`, `boolean`.

**Local validation before API call** (FR-010):
1. Check name uniqueness against cached schema (avoid round-trip for obvious conflicts).
2. Validate type is in the creatable list.
3. Validate required fields: `name`, `label`, `type`, `fieldType`, `groupName`.

**Error handling**:
- 409 (Conflict): property already exists -- surface existing property details for comparison.
- 400 (Bad Request): invalid type or missing fields -- surface HubSpot error message.
- Custom property limit reached: surface HubSpot error message with limit details.

### Custom Object Creation (FR-009, Enterprise only)

**SDK call**:
```typescript
await client.crm.schemas.coreApi.create({
  name: 'custom_migration_entity',
  labels: { singular: 'Migration Entity', plural: 'Migration Entities' },
  primaryDisplayProperty: 'name',
  requiredProperties: ['name'],
  properties: [
    { name: 'name', label: 'Name', type: 'string', fieldType: 'text' }
  ]
})
```

**Tier detection**: If the Schemas API returns 403, report "Custom objects require HubSpot Enterprise tier" (FR-009).

**Alternatives considered**:
- Batch property creation: not supported by the Properties API -- properties are created one at a time. If batch is needed in the future, implement a serial loop with rate limit awareness.

## Decision 7: Rate Limit Handling

**Decision**: Intercept 429 responses, read `Retry-After` header, apply exponential backoff with jitter.

**HubSpot rate limits**:
- Private Apps: 100 requests per 10 seconds (per app).
- OAuth apps: 100 requests per 10 seconds (per account).
- Secondary limits: 10 Search API requests per second.

**Implementation**:
```typescript
// Wrapper around SDK calls
async function withRateLimit<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    if (error.code === 429) {
      const retryAfter = parseInt(error.headers?.['retry-after'] || '1', 10)
      await delay(retryAfter * 1000 + jitter())
      return withRateLimit(fn) // retry with backoff
    }
    throw error
  }
}
```

**Backoff strategy**: initial delay from `Retry-After` header, then double on each subsequent retry, max 3 retries, with random jitter (0-500ms) to avoid thundering herd.

**Alternatives considered**:
- Pre-emptive throttling (limit to 80 req/10s): adds complexity without clear benefit. Reactive approach (handle 429 when it happens) is simpler and the SDK already handles basic retries.

## Decision 8: Token Expiration Handling

**Decision**: Different strategies for each auth method.

**Private App**: Tokens do not expire but can be revoked. On 401 response, transition connection to EXPIRED status and prompt re-entry of a new token. No automatic refresh possible.

**OAuth2**: Access token expires after 30 minutes. On 401 response:
1. Attempt refresh using `POST /oauth/v1/token` with `grant_type=refresh_token`.
2. If refresh succeeds: update stored tokens, retry the original request.
3. If refresh fails (refresh token expired or revoked): transition to EXPIRED, prompt re-authentication.

**Implementation**: The SDK's `Client` does not handle token refresh automatically. The adapter wraps all SDK calls with a try/catch that detects 401 and triggers the refresh flow.

## Decision 9: Adapter File Organization

**Decision**: Single adapter directory at `src/lib/adapters/hubspot/` with focused modules.

**Rationale**: Follows the pattern established by the Salesforce adapter (`src/lib/adapters/salesforce/`). Each module has a single responsibility:
- `hubspot-adapter.ts`: implements `ConnectorAdapter`, delegates to specialized modules.
- `auth.ts`: authentication logic (both methods).
- `schema.ts`: object and property retrieval.
- `records.ts`: record reading and stats computation.
- `schema-write.ts`: property and object creation.
- `rate-limiter.ts`: rate limit wrapper (cross-cutting, used by all modules).
- `types.ts`: HubSpot-specific types (not exported beyond the adapter).
- `constants.ts`: standard objects list, creatable types, etc.

**Alternatives considered**:
- Single file: rejected -- too large (~800+ lines). Separate modules improve readability (Principle II).
- Shared rate limiter in `src/lib/`: rejected for now -- only HubSpot and Salesforce exist. Extract when the Connector SDK is built.
