# Airtable — Connector Research

**Date**: 2026-03-27
**Role**: Source + Destination (both)
**API Version**: v0 (stable despite version number)

## 1. API Overview

| Aspect | Details |
|--------|---------|
| **Records API** | `https://api.airtable.com/v0/{baseId}/{tableIdOrName}` |
| **Metadata API** | `https://api.airtable.com/v0/meta/bases/{baseId}/tables` |
| **Rate Limits** | **5 req/sec per base** — very low. 429 with `Retry-After` header. |
| **Batch Size** | **10 records/request** (create, update, delete). 100 records/page (read). |

## 2. Authentication

### Personal Access Token (PAT)
- `Authorization: Bearer {token}`
- Scoped to specific bases or all bases
- Best for server-to-server

### OAuth 2.0
- Authorization code + PKCE (S256)
- Token URL: `https://airtable.com/oauth2/v1/token`
- ~2h token expiry, refresh tokens supported

### Scopes
`schema.bases:read`, `schema.bases:write`, `data.records:read`, `data.records:write`

**Config needed**: `authMethod` (pat|oauth2), `accessToken`, `baseId`, + OAuth fields if applicable.

## 3. Data Model

### Hierarchy
Workspace -> **Base** (= database) -> **Table** (= object) -> **Records** (= rows)

### Field Types
| Category | Types |
|----------|-------|
| **Text** | singleLineText, multilineText, email, url, phoneNumber, richText |
| **Numeric** | number, currency, percent, rating, duration |
| **Choice** | singleSelect, multipleSelects |
| **Date** | date, dateTime |
| **Boolean** | checkbox |
| **Relational** | multipleRecordLinks (array of record IDs — bidirectional) |
| **Files** | multipleAttachments (array of `{url, filename, size, type}`, URLs are **temporary**) |
| **Computed (read-only)** | formula, rollup, lookup, count, autoNumber, createdTime, lastModifiedTime, createdBy, lastModifiedBy, button, externalSyncSource |

### Relationships
- `multipleRecordLinks` = array of record IDs from another table
- Airtable auto-creates symmetric link field in linked table (bidirectional)
- **No JOIN or expand** — must fetch linked records separately

## 4. Schema Discovery

### List Bases
`GET /v0/meta/bases` — returns `{ bases: [{ id, name, permissionLevel }] }`

### List Tables + Fields
`GET /v0/meta/bases/{baseId}/tables` — returns all tables with full field definitions. Each field includes: `id`, `name`, `type`, `description`, type-specific `options` object.

Options examples:
- `singleSelect`: `{ choices: [{ id, name, color }] }`
- `multipleRecordLinks`: `{ linkedTableId, prefersSingleRecordLink, inverseLinkFieldId }`
- `formula`: `{ expression, result: { type } }`

## 5. Record Operations

### Read
- `GET /v0/{baseId}/{table}?pageSize={1-100}&offset={opaque_token}`
- **Opaque string pagination tokens** (NOT numeric offset)
- `filterByFormula`: server-side filtering with Airtable formula syntax
- `fields[]`: select specific fields
- `returnFieldsByFieldId=true`: use stable field IDs instead of names

### Write
- `POST /v0/{baseId}/{table}` — create, **max 10 records/request**
- `PATCH /v0/{baseId}/{table}` — partial update, max 10
- `PUT /v0/{baseId}/{table}` — full replace, max 10
- `DELETE /v0/{baseId}/{table}?records[]=recXXX` — max 10
- `typecast: true` option: auto-converts strings and creates select options on the fly

### Throughput
At 5 req/sec x 10 records = **max 50 writes/sec**. 10k records = ~200s minimum.

## 6. Schema Write

### Create Table
`POST /v0/meta/bases/{baseId}/tables` — must include at least one field. First field = primary field (always singleLineText).

### Create Field
`POST /v0/meta/bases/{baseId}/tables/{tableId}/fields`

### Update Field
`PATCH .../fields/{fieldId}` — rename, update options. **Cannot change field type** (immutable).

## 7. SDK

| Package | Notes |
|---------|-------|
| `airtable` (npm, official) | Record CRUD only. **Does NOT wrap Metadata API**. |
| Raw REST | Recommended for full coverage (schema + records). |

## 8. ConnectorAdapter Mapping

| Method | Airtable Implementation |
|--------|------------------------|
| `connect(config)` | Validate token with `GET /v0/meta/bases`, verify baseId in list. Return base name. |
| `getObjects(connId)` | `GET /v0/meta/bases/{baseId}/tables`. `isCustom: true` always (all tables are user-created). |
| `getFields(connId, obj)` | Extract from cached tables response. Use field ID as `apiName`. |
| `getRecords(connId, obj, {offset, limit})` | `GET /v0/{baseId}/{table}?pageSize={limit}`. **Opaque offset tokens require internal mapping.** |
| `getRecordCount(connId, obj)` | **No count endpoint.** Must iterate all pages to count. Cache aggressively. |
| `refreshSchema(connId)` | Re-call tables endpoint, diff. Field types cannot change. |
| `createField(connId, obj, def)` | `POST .../fields`. `groupName` not applicable. `isRequired` not settable. |
| `createObject(connId, def)` | `POST .../tables`. First field = primary, always singleLineText. |

## 9. Pain Points vs ConnectorAdapter

### Critical
1. **Opaque pagination tokens**: `PaginatedRecords.offset` is numeric, Airtable uses string tokens. Cannot jump to arbitrary page. **SDK gap: pagination model assumes numeric offset. Need cursor-based alternative.**
2. **No record count endpoint**: Must paginate all records to count. Expensive + rate-limited. **SDK gap: `getRecordCount()` assumes it's cheap/fast.**
3. **5 req/sec rate limit**: Severely constrains throughput. Schema discovery + record reading for a base with 20 tables and 100k records = minutes of API calls.

### Moderate
4. **10-record batch limit**: Write throughput capped at 50 records/sec. Migration execution bottleneck.
5. **No `isRequired` metadata**: API doesn't expose whether a field is required. Always returns false. **SDK gap: `ConnectorField.isRequired` unreliable for Airtable.**
6. **Linked records = raw ID arrays**: No expand/join. Resolving relationships requires extra API calls. **SDK gap: `ConnectorField` doesn't express "this field contains foreign keys that need resolution".**
7. **Temporary attachment URLs**: Expire after some time. Must download during extraction. **SDK gap: no attachment/binary handling concept.**
8. **Field type immutability**: Can't change field type after creation. Must create new field + migrate data + delete old.

### Minor
9. **`isCustom` meaningless**: All Airtable tables/fields are user-created. No "standard" vs "custom" distinction.
10. **Field names vs field IDs**: Default uses names (mutable). Must use `returnFieldsByFieldId=true` for stability.
11. **Base scoping**: User must know which baseId to connect to. No workspace-level discovery.

## 10. Summary

Airtable is a strong both-directions connector with excellent schema discovery and schema write. The critical friction is the pagination model (opaque tokens vs numeric offset) and the very low rate limits. The `PaginatedRecords` interface needs a cursor-based alternative to properly support Airtable and similar APIs. The absence of a record count endpoint also challenges the current SDK design.
