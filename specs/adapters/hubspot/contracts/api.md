# API Contracts: HubSpot Adapter

## Authentication Routes

---

## POST /api/connectors/hubspot/auth

Validate a Private App token and establish connection.

**Request Body**:

```typescript
{
  method: "private-app";
  accessToken: string;
  planId: string;
}
```

**Response** `200 OK`

```typescript
{
  connectionId: string;
  portalName: string;
  portalId: number;
  status: "CONNECTED";
  authMethod: "private-app";
}
```

**Errors**:
- `400 Bad Request` — missing accessToken or planId
- `401 Unauthorized` — invalid or revoked token

---

## GET /api/connectors/hubspot/auth

Initiate HubSpot OAuth2 flow.

**Query Parameters**:
- `planId` (required): Migration plan ID

**Response**: `302 Redirect` to HubSpot authorization URL with:
- `client_id` from env
- `redirect_uri` from env
- `scope` (crm.objects, crm.schemas, etc.)
- `state` (encoded planId)

**Errors**:
- `400 Bad Request` — missing planId
- `500 Internal Server Error` — missing environment variables

---

## GET /api/connectors/hubspot/callback

Handle HubSpot OAuth2 callback.

**Query Parameters** (from HubSpot redirect):
- `code` (required): Authorization code
- `state` (required): Encoded planId

**Behavior**:
1. Exchange code for tokens via `POST /oauth/v1/token`
2. Validate token by calling account info endpoint
3. Store tokens, set connection CONNECTED
4. Log to audit trail
5. Redirect to plan page

**Response**: `302 Redirect` to `/plans/[planId]`

**Errors**:
- `400 Bad Request` — missing code or state
- `401 Unauthorized` — token exchange failed

---

## Adapter Methods (programmatic, not HTTP routes)

### connect(config: HubSpotConfig)
Private App: validates token via account info endpoint. OAuth2: initiates flow. Returns ConnectorConnection.

### disconnect(connectionId)
Clears stored token/credentials. Sets status to disconnected.

### getSchema()
Returns standard objects (hardcoded list) + custom objects (Schemas API, graceful degradation on 403). Returns ConnectorSchema.

### getFields(objectApiName)
Calls Properties API. Returns ConnectorField array with all property metadata.

### getRecords(objectApiName, options)
Uses Search API with cursor pagination. Returns PaginatedRecords.

Options: `{ page: number, pageSize: number, fields?: string[] }`

### getRecordCount(objectApiName)
Uses Search API with limit=0 to get total count. Returns number.

### getFieldStats(objectApiName, records)
Computes per-property stats from provided records. Returns FieldStats array.

### createField(objectApiName, fieldDef)
Creates a property via Properties API. Validates locally first (name uniqueness, type validity). Returns created ConnectorField.

```typescript
fieldDef: {
  name: string;
  label: string;
  type: "string" | "number" | "date" | "datetime" | "enumeration" | "bool";
  groupName?: string;
  description?: string;
  options?: { label: string; value: string }[]; // for enumeration type
}
```

### createObject(objectDef)
Creates a custom object via Schemas API. Requires Enterprise tier. Returns created ConnectorObject.

```typescript
objectDef: {
  name: string;
  labels: { singular: string; plural: string };
  primaryDisplayProperty: string;
  properties: { name: string; label: string; type: string }[];
}
```

**Errors**: `403` if portal lacks Enterprise tier.
