# Pipedrive — Connector Research

**Date**: 2026-03-27
**Role**: Source + Destination (both)
**API Version**: v2 (v1 deprecated, removed July 2026)

## 1. API Overview

| Aspect | Details |
|--------|---------|
| **Base URL** | `https://{COMPANY_DOMAIN}.pipedrive.com/api/v2` |
| **Rate Limits** | Token-based: `30,000 base x plan multiplier x seats`. Burst: 2-second rolling window per token. v2 = 50% fewer tokens than v1. |
| **Pagination** | **Cursor-based** (opaque `next_cursor` string). Limit: 1-500, default 100. **No total_count.** |

## 2. Authentication

| Method | Details |
|--------|---------|
| **API Token** | `x-api-token` header. Tied to user+company. No scopes. Simple. |
| **OAuth 2.0** | Authorization code flow. Granular scopes per entity (deals, contacts, etc.) with read/full levels. Auto-refresh in SDK. |

**Config needed**: `companyDomain`, `apiToken` (or OAuth fields).

## 3. Data Model

### Core Objects (fixed set, no custom objects)
Deals, Persons, Organizations, Activities, Products, Leads, Pipelines, Stages, Notes, Projects.

### Custom Fields
- Added to existing objects only (Deals, Persons, Organizations, Products, Leads)
- API name = **40-char hash** (e.g., `dcf558aac1ae4e8c4f849ba5e668430d8df9be12`) — not human-readable
- 16 types: varchar, varchar_auto, text, double, monetary, date, daterange, time, timerange, set, enum, phone, address, int, user, org, people
- Compound types: monetary (value + currency), daterange (start + end), address (multi-component)

### Relationships
- Person -> Organization (via `org_id`)
- Deal -> Person + Organization + Pipeline/Stage
- Activity -> Deal/Person/Org
- Product -> Deal (via DealProducts join with price, quantity, discount)
- All ID-based foreign keys

## 4. Schema Discovery

**No "list all objects" endpoint.** Object list is **hardcoded** (same pattern as Act! CRM).

### Get Fields
- `GET /api/v2/dealFields`, `GET /api/v2/personFields`, `GET /api/v2/organizationFields`, `GET /api/v2/productFields`
- Returns standard + custom fields with: `key`, `name`, `field_type`, `edit_flag`, `mandatory_flag`, `options`

## 5. Record Operations

### Read
- `GET /api/v2/{entity}?cursor={next_cursor}&limit={1-500}`
- **No total_count** in cursor-paginated responses
- Custom fields included in record responses under their hash keys

### Write
- `POST /api/v2/{entity}` — create single record
- `PATCH /api/v2/{entity}/{id}` — update single record
- **No batch create/update** — records must be written one-by-one

## 6. Schema Write

| Operation | Supported |
|-----------|-----------|
| Create custom field | YES (`POST /api/v2/{entity}Fields`) |
| Update custom field | YES (`PATCH /api/v2/{entity}Fields/{id}`) |
| Delete custom field | YES |
| **Create custom object** | **NO — not possible** |

`createObject()` cannot be implemented. Hard limitation.

## 7. SDK

`pipedrive` npm package (official, MIT). TypeScript support. v2 via `pipedrive/v2`. Auto-refresh OAuth tokens. No built-in 429 retry.

## 8. ConnectorAdapter Mapping

| Method | Pipedrive Implementation |
|--------|------------------------|
| `connect(config)` | Validate with `GET /api/v2/users/me`. Config: `companyDomain` + `apiToken`. |
| `getObjects(connId)` | **Hardcoded list** of 10 known entities. `isCustom: false` always. |
| `getFields(connId, obj)` | `GET /api/v2/{obj}Fields`. Hash keys for custom fields. |
| `getRecords(connId, obj, {offset, limit})` | `GET /api/v2/{obj}?cursor={cursor}&limit={limit}`. **Cursor-based, needs offset translation.** |
| `getRecordCount(connId, obj)` | **No endpoint.** Must paginate all records or return null. |
| `refreshSchema(connId)` | Re-fetch all fields endpoints. Objects are fixed. |
| `createField(connId, obj, def)` | `POST /api/v2/{obj}Fields`. API name auto-generated (hash). |
| `createObject(connId, def)` | **IMPOSSIBLE.** Must throw error. |

## 9. Pain Points vs ConnectorAdapter

### Critical
1. **Cursor-based pagination, no total count**: Same gap as Airtable — `PaginatedRecords.offset` is numeric, Pipedrive uses opaque cursors. No `totalCount` available. **SDK gap: pagination model.**
2. **No custom objects**: `createObject()` cannot be implemented. **SDK gap: `WritableConnectorAdapter` assumes all writable connectors can create objects. Need partial schema-write capability.**
3. **Hardcoded object list**: No dynamic discovery. Same gap as Act!.

### Moderate
4. **No batch writes**: One record per request = slow for large migrations. Token-expensive.
5. **Custom field keys are 40-char hashes**: Not human-readable. Makes mapping plans hard to debug. Must always resolve hash → label for display.
6. **Compound field types**: monetary (value+currency), daterange (start+end), address (multi-component) don't map to flat `dataType: string`. **SDK gap: no concept of compound/structured field types.**
7. **Company domain in URL**: Must be stored in config. Unlike SF/HS global endpoints.
8. **v1→v2 transition**: Some endpoints may still be v1-only until July 2026.

### Minor
9. **`isUnique` not exposed**: Always false.
10. **Auto-generated field API names**: Cannot control hash key when creating fields.
