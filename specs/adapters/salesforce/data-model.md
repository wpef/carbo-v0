# Data Model: Salesforce Adapter

**Feature**: adapters/salesforce
**Date**: 2026-05-18

This adapter is runtime-only. No Prisma models are introduced. All types below live in
`src/lib/adapters/salesforce/types.ts` and are internal to the adapter module. The public
surface uses the Connector Interface types from `src/lib/types/connector.ts` (feature 000).

## Adapter Config Shape

The `config` parameter passed to `connect()` and stored in `ConnectorConnection.config`:

```typescript
interface SalesforceConnectionConfig {
  /** Consumer Key from the Connected App */
  clientId: string
  /** Consumer Secret from the Connected App */
  clientSecret: string
  /** Must match the Connected App callback URL exactly */
  callbackUrl: string
  /** login.salesforce.com (production) or test.salesforce.com (sandbox) */
  loginUrl: string
  /** Obtained from token exchange -- stored after successful connect */
  accessToken?: string
  /** Long-lived; used for transparent token refresh */
  refreshToken?: string
  /** e.g. https://na1.salesforce.com -- base URL for all API calls */
  instanceUrl?: string
  /** Salesforce org ID from the identity URL */
  orgId?: string
  /** Display name of the org (from identity response) */
  orgName?: string
  /** ISO timestamp of last successful token refresh */
  tokenRefreshedAt?: string
}
```

## Token Storage

Tokens are stored in the `ConnectorConnection.config` JSON field (managed by feature 002).
The adapter itself is stateless: it reads tokens from the connection record on each call.

The PKCE code verifier is transient and lives on `globalThis.__pkceStore` (keyed by OAuth
`state` parameter, 10-minute TTL). It is never persisted to the database.

```typescript
interface PkceStore {
  [state: string]: {
    codeVerifier: string
    createdAt: number   // Date.now()
  }
}

// Declared on globalThis to survive Next.js HMR in dev mode
declare global {
  var __pkceStore: PkceStore | undefined
}
```

## Salesforce API Response Types

Internal types that model raw Salesforce API responses before mapping to Connector Interface
types. These are NOT exported beyond the adapter.

### SFTokenResponse

```typescript
/** Response from POST /services/oauth2/token */
interface SFTokenResponse {
  access_token: string
  refresh_token: string
  instance_url: string          // e.g. "https://na1.salesforce.com"
  id: string                    // e.g. "https://login.salesforce.com/id/00Dxx.../005xx..."
  token_type: 'Bearer'
  scope: string                 // e.g. "full refresh_token"
  issued_at: string             // Unix timestamp in milliseconds (as string)
  signature: string             // HMAC-SHA256 of id + issued_at
}
```

### SFDescribeGlobalResult

```typescript
/** Subset of jsforce describeGlobal() response used by the adapter */
interface SFDescribeGlobalResult {
  sobjects: SFDescribeGlobalSObject[]
}

interface SFDescribeGlobalSObject {
  name: string                  // API name (e.g. "Contact", "Invoice__c")
  label: string                 // Display label
  labelPlural: string
  custom: boolean               // true for __c objects
  queryable: boolean
  searchable: boolean
  createable: boolean
  updateable: boolean
  deletable: boolean
  keyPrefix: string | null      // 3-character ID prefix
}
```

### SFDescribeResult (per object)

```typescript
/** Subset of jsforce describe(objectApiName) response */
interface SFDescribeResult {
  name: string
  label: string
  fields: SFFieldDescribe[]
  recordTypeInfos: SFRecordTypeInfo[]
}

interface SFFieldDescribe {
  name: string                  // API name (e.g. "FirstName")
  label: string                 // Display label
  type: string                  // Salesforce type (see type mapping below)
  length: number
  precision: number
  scale: number
  nillable: boolean             // true = field accepts null
  defaultValue: unknown
  updateable: boolean
  createable: boolean
  accessible: boolean           // false = FLS-restricted
  unique: boolean
  externalId: boolean
  referenceTo: string[]         // target object(s) for lookup fields
  relationshipName: string | null
  relationshipOrder: number | null  // 0=lookup, 1=master-detail
  picklistValues: SFPicklistValue[]
  calculated: boolean           // true = formula field
  autoNumber: boolean
  compoundFieldName: string | null
}

interface SFPicklistValue {
  value: string
  label: string
  active: boolean
  defaultValue: boolean
}

interface SFRecordTypeInfo {
  recordTypeId: string
  name: string
  available: boolean
  defaultRecordTypeMapping: boolean
}
```

### SFQueryResult

```typescript
/** Subset of jsforce query() response */
interface SFQueryResult {
  totalSize: number
  done: boolean
  nextRecordsUrl?: string
  records: Record<string, unknown>[]
}
```

### RateLimitInfo

```typescript
/** Parsed from Sforce-Limit-Info header */
interface RateLimitInfo {
  used: number                  // current API calls consumed
  limit: number                 // daily API call limit
  percentUsed: number           // (used / limit) * 100
  isApproachingLimit: boolean   // percentUsed > 80
}
```

## Type Mapping: Salesforce Field Types to ConnectorField.dataType

The adapter passes the raw Salesforce type string as `ConnectorField.dataType`. The mapping
layer (feature 012) normalizes these to a unified type system. This table documents the
mapping from `SFFieldDescribe.type` to the `dataType` string stored in `ConnectorField`:

| Salesforce `field.type` | ConnectorField `dataType` | Notes |
|---|---|---|
| `id` | `"id"` | 18-character Salesforce ID |
| `string` | `"string"` | Short text (up to 255 chars) |
| `textarea` | `"textarea"` | Long text |
| `phone` | `"phone"` | Phone number (text) |
| `email` | `"email"` | Email address (text) |
| `url` | `"url"` | URL (text) |
| `int` | `"int"` | Integer |
| `double` | `"double"` | Decimal number |
| `currency` | `"currency"` | Currency amount (decimal) |
| `percent` | `"percent"` | Percentage (decimal) |
| `boolean` | `"boolean"` | Checkbox |
| `date` | `"date"` | Date only |
| `datetime` | `"datetime"` | Date + time |
| `time` | `"time"` | Time only |
| `picklist` | `"picklist"` | Single-select picklist |
| `multipicklist` | `"multipicklist"` | Multi-select picklist (semicolon-delimited) |
| `reference` | `"reference"` | Lookup / master-detail (referenceTo populated) |
| `base64` | `"base64"` | Binary data (base64 encoded) |
| `encryptedstring` | `"encryptedstring"` | Encrypted text (FLS-restricted) |
| `combobox` | `"combobox"` | Combination text + picklist |
| `address` | `"address"` | Compound address |
| `location` | `"location"` | Geolocation (compound) |
| `anyType` | `"anyType"` | Polymorphic (formula results) |

**Rule**: the adapter does NOT normalize types. It stores the exact Salesforce type string.
Normalization is the responsibility of the mapping layer (feature 012).

## Relationship Type Derivation

`ConnectorField.relationshipType` is derived from the Salesforce field describe:

```typescript
function deriveRelationshipType(field: SFFieldDescribe): ConnectorField['relationshipType'] {
  if (field.type !== 'reference') return undefined
  if (field.relationshipOrder === 1) return 'master-detail'
  if (field.externalId) return 'external'
  return 'lookup'
}
```

## Relationships

```
SalesforceConnectionConfig (1) ──► (1) ConnectorConnection.config
SFDescribeGlobalResult (1) ──► (N) SFDescribeGlobalSObject ──map──► ConnectorObject
SFDescribeResult (1) ──► (N) SFFieldDescribe ──map──► ConnectorField
SFQueryResult (1) ──► (N) Record<string, unknown> ──map──► ConnectorRecord
RateLimitInfo (1) ──► per-connection in-memory tracking
PkceStore (1) ──► transient on globalThis, keyed by state
```
