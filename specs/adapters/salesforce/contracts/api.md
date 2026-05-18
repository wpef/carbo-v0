# API Contracts: Salesforce Adapter

**Feature**: adapters/salesforce
**Date**: 2026-05-18

All routes are Next.js Route Handlers under `src/app/api/connectors/salesforce/`.

---

## Authentication

### POST /api/connectors/salesforce/connect

Initiates the OAuth2 Authorization Code flow with PKCE. Generates code_verifier/code_challenge, stores the verifier on `globalThis`, and returns the Salesforce authorization URL.

**Request**: empty body

**Response** (200):
```json
{
  "authorizationUrl": "https://login.salesforce.com/services/oauth2/authorize?response_type=code&client_id=...&redirect_uri=...&scope=full+refresh_token&code_challenge=...&code_challenge_method=S256&state=..."
}
```

**Errors**:
- 500: Missing environment variables (`SALESFORCE_CLIENT_ID`, `SALESFORCE_CLIENT_SECRET`, `SALESFORCE_CALLBACK_URL`)

**Audit**: Logs `SALESFORCE_CONNECT_INITIATED` with state parameter (no secrets).

---

### GET /api/connectors/salesforce/callback?code={code}&state={state}

OAuth2 callback. Retrieves the PKCE verifier by `state`, exchanges the authorization code for tokens via direct HTTP POST to `/services/oauth2/token`, creates a `ConnectorConnection` record.

Does NOT trigger schema retrieval -- the UI layer (feature 002) handles post-connect auto-retrieval.

**Query parameters**:
- `code` (string, required): Authorization code from Salesforce
- `state` (string, required): CSRF/PKCE state token

**Response**: Redirects to `/plans/[planId]/source?connected=salesforce` (302).

On error, redirects to `/plans/[planId]/source?error={errorCode}` (302).

**Token exchange** (server-side, not exposed to client):
```
POST {loginUrl}/services/oauth2/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code={code}
&client_id={SALESFORCE_CLIENT_ID}
&client_secret={SALESFORCE_CLIENT_SECRET}
&redirect_uri={SALESFORCE_CALLBACK_URL}
&code_verifier={stored_verifier}
```

**Salesforce token response** (consumed server-side):
```json
{
  "access_token": "...",
  "refresh_token": "...",
  "instance_url": "https://na1.salesforce.com",
  "id": "https://login.salesforce.com/id/00Dxx.../005xx...",
  "token_type": "Bearer",
  "scope": "full refresh_token"
}
```

**Errors**:
- `invalid_grant`: Code verifier mismatch or expired code. If PKCE store is empty (hot-reload), redirect with `error=pkce_lost`.
- `invalid_client_id`: Connected App not found (possibly propagation delay). Redirect with `error=invalid_client`.

**Audit**: Logs `SALESFORCE_CONNECT_SUCCESS` or `SALESFORCE_CONNECT_FAILURE` with error category (no tokens).

---

### POST /api/connectors/salesforce/{connectionId}/disconnect

Revokes the access token (POST to `{instanceUrl}/services/oauth2/revoke?token={accessToken}`), clears stored tokens, transitions connection status.

**Response** (200):
```json
{
  "status": "DISCONNECTED"
}
```

**Errors**:
- 404: Connection not found
- 500: Revocation failed (connection is still marked disconnected locally)

**Audit**: Logs `SALESFORCE_DISCONNECTED`.

---

## Schema

### GET /api/connectors/salesforce/{connectionId}/schema

Calls `describeGlobal()` via jsforce. Returns all objects (standard + custom) mapped to `ConnectorObject[]`.

**Response** (200):
```json
{
  "objects": [
    {
      "apiName": "Contact",
      "label": "Contact",
      "description": "",
      "isCustom": false,
      "isSelected": false
    },
    {
      "apiName": "Invoice__c",
      "label": "Invoice",
      "description": "Custom invoice object",
      "isCustom": true,
      "isSelected": false
    }
  ],
  "totalCount": 1247,
  "retrievedAt": "2026-05-18T10:00:00Z"
}
```

**Errors**:
- 401: Token expired and refresh failed
- 404: Connection not found

**Audit**: Logs `SALESFORCE_SCHEMA_RETRIEVED` with object count.

---

### GET /api/connectors/salesforce/{connectionId}/objects/{apiName}/fields

Calls `describe(apiName)` via jsforce for a single object. Returns all fields mapped to `ConnectorField[]`.

**Response** (200):
```json
{
  "objectApiName": "Contact",
  "objectLabel": "Contact",
  "fields": [
    {
      "apiName": "FirstName",
      "label": "First Name",
      "dataType": "string",
      "isRequired": false,
      "isReadOnly": false,
      "isUnique": false,
      "referenceTo": null,
      "relationshipType": null
    },
    {
      "apiName": "AccountId",
      "label": "Account ID",
      "dataType": "reference",
      "isRequired": false,
      "isReadOnly": false,
      "isUnique": false,
      "referenceTo": "Account",
      "relationshipType": "lookup"
    },
    {
      "apiName": "SSN__c",
      "label": "Social Security Number",
      "dataType": "encryptedstring",
      "isRequired": false,
      "isReadOnly": false,
      "isUnique": false,
      "referenceTo": null,
      "relationshipType": null,
      "_isAccessible": false
    }
  ],
  "fieldCount": 67,
  "accessibleCount": 65,
  "restrictedCount": 2
}
```

**Notes**:
- Fields restricted by FLS appear in the list with `_isAccessible: false`. They are NOT omitted (FR-009, Constitution III).
- `dataType` is the raw Salesforce type string (e.g., `string`, `double`, `reference`, `picklist`, `encryptedstring`). Normalization is handled by the mapping layer (feature 012).
- `relationshipType` is derived from the Salesforce field describe: `lookup` for standard lookups, `master-detail` for master-detail, `external` for external lookups.

**Errors**:
- 404: Object not found in the org
- 401: Token expired and refresh failed

**Audit**: Logs `SALESFORCE_FIELDS_RETRIEVED` with object name and field count.

---

## Records

### GET /api/connectors/salesforce/{connectionId}/objects/{apiName}/records

Executes a SOQL query for the specified object. Returns paginated records.

**Query parameters**:
- `page` (integer, default: 1) -- **1-indexed** per FR-012 of feature 000. page=1 returns the first pageSize records.
- `pageSize` (integer, default: 50, max: 200)

**Response** (200):
```json
{
  "records": [
    {
      "Id": "003xx000004TmjAAI",
      "FirstName": "John",
      "LastName": "Doe",
      "AccountId": "001xx000003DGbYAAW"
    }
  ],
  "totalCount": 45230,
  "pageSize": 50,
  "currentPage": 1,
  "hasNextPage": true
}
```

**SOQL generation**:
```sql
SELECT {accessible_fields} FROM {apiName} LIMIT {pageSize} OFFSET {(page-1) * pageSize}
```

**Notes**:
- Only accessible fields (from the describe result) are included in the SELECT clause.
- Formula fields that are not queryable are excluded.
- Null values are preserved as `null` in the JSON response (not omitted).
- OFFSET limit: Salesforce caps OFFSET at 2000. Requests beyond page 40 (at pageSize=50) return a 400 error with a clear message.

**Errors**:
- 400: Invalid page/pageSize, OFFSET exceeds 2000
- 404: Object not found
- 429: Rate limit approaching (includes `retryAfter` in response body)

**Audit**: Logs `SALESFORCE_RECORDS_QUERIED` with object name, page, and record count.

---

### GET /api/connectors/salesforce/{connectionId}/objects/{apiName}/count

Returns the record count for an object via `SELECT COUNT() FROM {apiName}`.

**Response** (200):
```json
{
  "objectApiName": "Contact",
  "count": 45230
}
```

**Errors**:
- 404: Object not found

**Audit**: Logs `SALESFORCE_COUNT_QUERIED` with object name.

---

## Field Stats

### GET /api/connectors/salesforce/{connectionId}/objects/{apiName}/stats

Computes per-field statistics from a SOQL query sample.

**Query parameters**:
- `fields` (string, required): Comma-separated field API names
- `sampleSize` (integer, default: 200, max: 2000): Number of records to sample

**Response** (200):
```json
{
  "objectApiName": "Contact",
  "sampleSize": 200,
  "totalCount": 45230,
  "stats": [
    {
      "fieldApiName": "FirstName",
      "nullCount": 12,
      "distinctCount": 145,
      "sampleValues": ["John", "Jane", "Ahmed", "Maria", "Li"]
    },
    {
      "fieldApiName": "Email",
      "nullCount": 34,
      "distinctCount": 198,
      "sampleValues": ["john@acme.com", "jane@co.org", "ahmed@test.io", "m@x.com", "li@co.cn"]
    }
  ]
}
```

**Notes**:
- Stats are computed from `sampleSize` records (not the full dataset). The response includes `sampleSize` and `totalCount` so the UI can label the scope.
- Stats computation happens server-side: a single SOQL query fetches the sample, then stats are computed in-memory.

**Errors**:
- 400: Missing `fields` parameter, invalid field names
- 404: Object not found

**Audit**: Logs `SALESFORCE_STATS_COMPUTED` with object name and field count.

---

## Error Response Format

All error responses follow a consistent shape:

```json
{
  "error": {
    "code": "SALESFORCE_TOKEN_EXPIRED",
    "message": "Access token expired and refresh failed. Please reconnect.",
    "details": {}
  }
}
```

**Error codes**:
| Code | HTTP | Description |
|------|------|-------------|
| `SALESFORCE_NOT_CONFIGURED` | 500 | Missing env vars |
| `SALESFORCE_PKCE_LOST` | 400 | Code verifier lost (hot-reload) |
| `SALESFORCE_INVALID_CLIENT` | 400 | Connected App not found (propagation?) |
| `SALESFORCE_AUTH_FAILED` | 401 | OAuth exchange failed |
| `SALESFORCE_TOKEN_EXPIRED` | 401 | Token expired, refresh failed |
| `SALESFORCE_RATE_LIMIT` | 429 | API limit approaching/exceeded |
| `SALESFORCE_OBJECT_NOT_FOUND` | 404 | Object not in org |
| `SALESFORCE_CONNECTION_NOT_FOUND` | 404 | Connection ID unknown |
| `SALESFORCE_OFFSET_EXCEEDED` | 400 | SOQL OFFSET > 2000 |
| `SALESFORCE_NETWORK_ERROR` | 502 | Network failure to Salesforce |

---

## ConnectorAdapter Interface Implementation

The Salesforce adapter implements `ConnectorAdapter` from `@/lib/types/connector`:

```typescript
const salesforceAdapter: ConnectorAdapter = {
  capabilities: { canRead: true, canWrite: false, canWriteSchema: false },

  connect(config)                     // Initiates OAuth2 flow, returns ConnectorConnection
  disconnect(connectionId)            // Revokes tokens
  getSchema(connectionId)             // describeGlobal -> ConnectorSchema
  getFields(connectionId, apiName)    // describe -> ConnectorField[]
  getRecords(connectionId, apiName, page, pageSize) // SOQL -> PaginatedRecords (page is 1-indexed)
  getRecordCount(connectionId, apiName)             // SELECT COUNT() -> number
  getFieldStats(connectionId, apiName, fieldNames)  // SOQL sample -> FieldStats[]

  // Not implemented (read-only adapter):
  // createObject -> undefined
  // createField  -> undefined
}
```

Registered in `src/lib/adapters/registry.ts` as `"salesforce"`.
