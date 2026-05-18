# Data Model: HubSpot Adapter

**Feature**: adapters/hubspot
**Date**: 2026-05-18

This adapter is runtime-only. No Prisma models are introduced. All types below live in
`src/lib/adapters/hubspot/types.ts` and are internal to the adapter module. The public
surface uses the Connector Interface types from `src/lib/types/connector.ts` (feature 000).

## Adapter Config Shape

The `config` parameter passed to `connect()` and stored in `ConnectorConnection.config`:

```typescript
interface HubSpotConnectionConfig {
  /** "private_app" or "oauth2" */
  authMethod: 'private_app' | 'oauth2'

  // --- Private App auth ---
  /** Private App access token (pat-na1-...) -- stored for private_app method */
  accessToken?: string

  // --- OAuth2 auth ---
  /** OAuth2 access token -- short-lived (30 min) */
  oauthAccessToken?: string
  /** OAuth2 refresh token -- long-lived (6 months of inactivity) */
  oauthRefreshToken?: string
  /** ISO timestamp of last successful token refresh */
  tokenRefreshedAt?: string

  // --- Portal info (set after successful validation) ---
  /** HubSpot portal (account) ID */
  portalId?: string
  /** Portal display name */
  portalName?: string

  // --- OAuth2 env-driven (not stored in config, read from env at runtime) ---
  // HUBSPOT_CLIENT_ID, HUBSPOT_CLIENT_SECRET, HUBSPOT_REDIRECT_URI
}
```

## Token Storage

Tokens are stored in the `ConnectorConnection.config` JSON field (managed by feature 006).
The adapter is stateless: it reads tokens from the connection record on each call and
creates a fresh `@hubspot/api-client` `Client` instance.

For OAuth2, a CSRF `state` token is stored server-side (in-memory Map, keyed by state,
5-minute TTL) during the authorization flow. It is never persisted to the database.

```typescript
interface OAuthStateStore {
  [state: string]: {
    createdAt: number   // Date.now()
  }
}
```

## HubSpot API Response Types

Internal types that model raw HubSpot API responses before mapping to Connector Interface
types. These are NOT exported beyond the adapter.

### HSAccountInfo

```typescript
/** Response from GET /account-info/v3/details */
interface HSAccountInfo {
  portalId: number
  accountType: string           // e.g. "STANDARD", "DEVELOPER"
  timeZone: string
  companyCurrency: string
  uiDomain: string              // e.g. "app.hubspot.com"
  dataHostingLocation: string   // e.g. "na1"
}
```

### HSObjectSchema (custom objects via Schemas API)

```typescript
/** Response item from GET /crm/v3/schemas */
interface HSObjectSchema {
  objectTypeId: string          // e.g. "2-12345"
  name: string                  // internal name
  labels: {
    singular: string
    plural: string
  }
  description: string
  primaryDisplayProperty: string
  requiredProperties: string[]
  properties: HSPropertyDefinition[]
  createdAt: string
  updatedAt: string
}
```

### HSPropertyDefinition

```typescript
/** Response item from GET /crm/v3/properties/{objectType} */
interface HSPropertyDefinition {
  name: string                  // internal property name (e.g. "firstname")
  label: string                 // display label (e.g. "First Name")
  type: string                  // HubSpot type (see type mapping below)
  fieldType: string             // HubSpot field type (text, textarea, select, etc.)
  groupName: string             // property group (e.g. "contactinformation")
  description: string
  options: HSPropertyOption[]   // populated for enumeration types
  hasUniqueValue: boolean
  hidden: boolean
  modificationMetadata: {
    readOnlyValue: boolean
    readOnlyDefinition: boolean
    archivable: boolean
  }
  formField: boolean
  calculated: boolean           // true = calculation/score property
  externalOptions: boolean
  createdAt: string
  updatedAt: string
}

interface HSPropertyOption {
  label: string
  value: string
  description: string
  displayOrder: number
  hidden: boolean
}
```

### HSSearchResponse

```typescript
/** Response from POST /crm/v3/objects/{objectType}/search */
interface HSSearchResponse {
  total: number                 // total matching records
  results: HSRecord[]
  paging?: {
    next?: {
      after: string             // cursor for next page
      link: string
    }
  }
}

interface HSRecord {
  id: string                    // HubSpot object ID
  properties: Record<string, string | null>
  createdAt: string
  updatedAt: string
  archived: boolean
}
```

### HSCreatePropertyRequest

```typescript
/** Request body for POST /crm/v3/properties/{objectType} */
interface HSCreatePropertyRequest {
  name: string                  // internal name (lowercase, underscores)
  label: string                 // display label
  type: HSCreatableType         // see creatable types below
  fieldType: string             // UI field type (text, textarea, select, etc.)
  groupName: string             // must be an existing property group
  description?: string
  options?: HSPropertyOption[]  // required for enumeration type
}

type HSCreatableType = 'string' | 'number' | 'date' | 'datetime' | 'enumeration' | 'bool'
```

### HSCreateObjectRequest

```typescript
/** Request body for POST /crm/v3/schemas */
interface HSCreateObjectRequest {
  name: string                  // internal name
  labels: {
    singular: string
    plural: string
  }
  primaryDisplayProperty: string
  requiredProperties: string[]
  properties: HSCreatePropertyRequest[]
}
```

## Cursor Cache (pagination)

HubSpot Search API uses cursor-based pagination (`after` parameter). The adapter caches
cursors in-memory to support 1-indexed page access without re-walking from page 1 each time.

```typescript
interface CursorCache {
  /** Map of page number to the `after` cursor that fetches that page's data.
   *  page 1 -> undefined (first request, no cursor needed).
   *  page 2 -> the `after` value from page 1's response.
   */
  cursors: Map<number, string | undefined>
  /** Connection + object key for cache isolation */
  key: string
  /** Timestamp for cache invalidation */
  createdAt: number
}
```

## Constants

Defined in `src/lib/adapters/hubspot/constants.ts`:

```typescript
/** Standard CRM objects -- always available, hardcoded */
const STANDARD_OBJECTS: { apiName: string; label: string }[] = [
  { apiName: 'contacts', label: 'Contacts' },
  { apiName: 'companies', label: 'Companies' },
  { apiName: 'deals', label: 'Deals' },
  { apiName: 'tickets', label: 'Tickets' },
  { apiName: 'line_items', label: 'Line Items' },
]

/** Property types that can be created from Carbo-v0 (FR-008) */
const CREATABLE_PROPERTY_TYPES: HSCreatableType[] = [
  'string', 'number', 'date', 'datetime', 'enumeration', 'bool'
]

/** Property types that exist in HubSpot but cannot be created from Carbo-v0 */
const NON_CREATABLE_TYPES = ['calculation', 'score', 'rich_text', 'object_coordinates'] as const
```

## Type Mapping: HubSpot Property Types to ConnectorField.dataType

The adapter passes the raw HubSpot `type` string as `ConnectorField.dataType`. The mapping
layer (feature 012) normalizes these to a unified type system. This table documents the
mapping from `HSPropertyDefinition.type` to the `dataType` string stored in `ConnectorField`:

| HubSpot `type` | HubSpot `fieldType` (examples) | ConnectorField `dataType` | Notes |
|---|---|---|---|
| `string` | text, textarea, phonenumber, html | `"string"` | General text |
| `number` | number | `"number"` | Numeric |
| `date` | date | `"date"` | Date only (midnight UTC) |
| `datetime` | date | `"datetime"` | Date + time (UTC millis) |
| `enumeration` | select, radio, checkbox | `"enumeration"` | Picklist / multi-select |
| `bool` | booleancheckbox | `"bool"` | Boolean |
| `object_coordinates` | -- | `"object_coordinates"` | Geolocation (not creatable) |
| `calculation` | -- | `"calculation"` | Calculated (not creatable) |
| `score` | -- | `"score"` | Score (not creatable) |
| `rich_text` | -- | `"rich_text"` | Rich text (not creatable) |

**Rule**: the adapter does NOT normalize types. It stores the exact HubSpot type string.
Normalization is the responsibility of the mapping layer (feature 012).

## Property-to-ConnectorField Mapping Logic

```typescript
function mapPropertyToField(prop: HSPropertyDefinition): ConnectorField {
  return {
    apiName: prop.name,
    label: prop.label,
    dataType: prop.type,
    isRequired: false,          // HubSpot has no strict "required" flag on properties;
                                // requiredness is enforced at the form level, not API level.
                                // Custom objects declare requiredProperties at schema level.
    isReadOnly: prop.modificationMetadata.readOnlyValue,
    isUnique: prop.hasUniqueValue,
    referenceTo: undefined,     // HubSpot associations are separate from properties;
                                // handled by the Associations API, not the Properties API.
    relationshipType: undefined,
  }
}
```

**Note on associations**: HubSpot models relationships via the Associations API, not via
property fields (unlike Salesforce lookups). The adapter does not map associations to
`ConnectorField.referenceTo` because they are a separate concept. The mapping layer
(feature 012) will handle association-to-relationship mapping when needed.

## Relationships

```
HubSpotConnectionConfig (1) ──► (1) ConnectorConnection.config
STANDARD_OBJECTS (const) ──► (5) ConnectorObject (always present)
HSObjectSchema (N) ──► (N) ConnectorObject (custom, Enterprise only)
HSPropertyDefinition (N) ──map──► (N) ConnectorField
HSSearchResponse (1) ──► (N) HSRecord ──map──► ConnectorRecord
CursorCache (1) ──► per-connection+object in-memory cache
HSCreatePropertyRequest ──► Properties API ──► ConnectorField (returned on success)
HSCreateObjectRequest ──► Schemas API ──► ConnectorObject (returned on success)
```
