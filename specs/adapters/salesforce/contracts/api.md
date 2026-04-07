# API Contracts: Salesforce Adapter

## OAuth Routes

These routes handle the Salesforce OAuth2+PKCE flow. They are not called directly by the UI — the UI triggers them via redirect.

---

## GET /api/connectors/salesforce/auth

Initiate the Salesforce OAuth2 flow with PKCE.

**Query Parameters**:
- `planId` (required): The migration plan ID this connection belongs to

**Response**: `302 Redirect` to Salesforce authorization URL with:
- `response_type=code`
- `client_id` from env
- `redirect_uri` from env
- `scope=full refresh_token`
- `code_challenge` (S256)
- `code_challenge_method=S256`
- `state` (encoded planId + PKCE key)

**Errors**:
- `400 Bad Request` — missing planId
- `500 Internal Server Error` — missing environment variables

---

## GET /api/connectors/salesforce/callback

Handle the Salesforce OAuth2 callback. Exchange authorization code for tokens.

**Query Parameters** (from Salesforce redirect):
- `code` (required): Authorization code
- `state` (required): State parameter containing planId + PKCE key

**Behavior**:
1. Retrieve code_verifier from globalThis store using state
2. POST to `{loginUrl}/services/oauth2/token` with code_verifier
3. Store tokens (access_token, refresh_token, instance_url)
4. Set connection status to CONNECTED
5. Log to audit trail
6. Redirect to plan detail page

**Response**: `302 Redirect` to `/plans/[planId]`

**Errors**:
- `400 Bad Request` — missing code or state
- `401 Unauthorized` — token exchange failed (invalid code, expired, PKCE mismatch)
- `500 Internal Server Error` — PKCE verifier not found (hot-reload lost it)

---

## Adapter Methods (programmatic, not HTTP routes)

These are called internally by core features, not exposed as REST endpoints.

### connect(config)
Initiates OAuth flow. Returns ConnectorConnection with status CONNECTED or ERROR.

### disconnect(connectionId)
Clears stored tokens. Sets status to disconnected.

### getSchema()
Calls `describeGlobal()`. Returns ConnectorSchema with all objects (system objects included but flagged).

### getFields(objectApiName)
Calls `describe(objectApiName)`. Returns ConnectorField array.

### getRecords(objectApiName, options)
Executes SOQL query. Returns PaginatedRecords.

Options: `{ page: number, pageSize: number, fields?: string[] }`

### getRecordCount(objectApiName)
Executes `SELECT COUNT() FROM ObjectName`. Returns number.

### getFieldStats(objectApiName, records)
Computes per-field stats from provided records. Returns FieldStats array.
