# Zoho CRM — Connector Research

**Date**: 2026-03-27
**Role**: Source + Destination (both)
**API Version**: v7 (latest)

## 1. API Overview

| Aspect | Details |
|--------|---------|
| **Base URL** | `https://www.zohoapis.com/crm/v7/` — **region-specific** (see below) |
| **Rate Limits** | Per edition: Free 5k/day, Standard 100k/day, Enterprise 1M/day. 100-200 req/min. 25 concurrent. |
| **Data Centers** | US `.com`, EU `.eu`, IN `.in`, AU `.com.au`, JP `.jp`, CA `.ca`, SA `.sa`, CN `.com.cn` |
| **Pagination** | `page` (1-based) + `per_page` (max 200). Cursor via `page_token`. |

## 2. Authentication

- **OAuth 2.0** (authorization code grant or Self-Client server-to-server)
- Auth/Token URLs are region-specific (`accounts.zoho.com` / `accounts.zoho.eu` / etc.)
- Access token: 1h lifetime, refresh token long-lived
- Scopes: `ZohoCRM.modules.ALL`, `ZohoCRM.settings.ALL`, `ZohoCRM.coql.READ`
- **Config needed**: `clientId`, `clientSecret`, `refreshToken`, `dataCenterRegion`

## 3. Data Model

### Core Modules
Leads, Contacts, Accounts, Deals, Tasks, Events, Calls, Products, Quotes, Sales_Orders, Purchase_Orders, Invoices, Campaigns, Vendors, Price_Books, Cases, Solutions, Notes, Attachments, Activities.

### Fields
- System fields (Id, Created_Time, Modified_Time, Owner) + standard + custom
- Custom fields: identified by `custom_field: true`, API name auto-generated from label
- Types: text, textarea, integer, bigint, currency, double, date, datetime, email, phone, website, boolean, picklist, multiselectpicklist, lookup, multiselectlookup, autonumber, formula, fileupload, image, ownerlookup, subform, etc.

### Relationships
- **Lookup fields**: FK references returning `{ id, name }`
- **Subforms**: inline child records (like line items) — nested objects
- **Lead conversion**: Leads -> Contacts + Accounts + Deals

### Custom Modules
Enterprise+ editions, up to 100 custom modules.

## 4. Schema Discovery

### List Modules
`GET /crm/v7/settings/modules` — returns all modules with `api_name`, `singular_label`, `plural_label`, `custom_module`, `api_supported`, `viewable`, `creatable`, `editable`, `deletable`.

### Get Fields
`GET /crm/v7/settings/fields?module={module_api_name}` — returns all fields (including custom) with: `api_name`, `field_label`, `data_type`, `json_type`, `length`, `custom_field`, `read_only`, `system_mandatory`, `required`, `visible`, `pick_list_values`, `lookup`, `formula`, `unique`, `default_value`.

### Layouts
`GET /crm/v7/settings/layouts?module={module_api_name}` — fields organized into layouts. A field's `required` status can vary across layouts.

## 5. Record Operations

### Read
- `GET /crm/v7/{module}` — paginated list, max 200/page
- COQL: `POST /crm/v7/coql` with SQL-like syntax, **OFFSET max 2000** (cannot paginate beyond 2200 records)
- Bulk Read: async job, up to 200k records, returns CSV/ZIP

### Write
- `POST /crm/v7/{module}` — batch create, up to **100 records/request**
- `PUT /crm/v7/{module}` — batch update, up to 100 (partial update semantics)
- `POST /crm/v7/{module}/upsert` — upsert with configurable duplicate-check field
- `DELETE /crm/v7/{module}?ids=...` — batch delete, up to 100

### Bulk Write
Async job: upload CSV, up to 25k records/file.

## 6. Schema Write

### Custom Fields — YES
`POST /crm/v7/settings/fields?module={module}` — supports: text, integer, double, date, datetime, email, phone, website, boolean, picklist, textarea, currency, autonumber, lookup, multiselectpicklist, bigint. **API name auto-generated from label** (cannot specify).

### Custom Modules — YES (Enterprise+)
`POST /crm/v7/settings/modules`

## 7. SDK

| Package | Notes |
|---------|-------|
| `@zohocrm/nodejs-sdk-7.0` | Official, v7 API. Auto-generated, verbose Java-like patterns. |
| Raw HTTP | Community often prefers raw fetch — simpler, more aligned with existing Carbo pattern. |

## 8. ConnectorAdapter Mapping

| Method | Zoho Implementation |
|--------|-------------------|
| `connect(config)` | Refresh token -> access token. Resolve API domain from `dataCenterRegion`. Validate with `GET /crm/v7/org`. |
| `getObjects(connId)` | `GET /crm/v7/settings/modules`, filter `api_supported: true` |
| `getFields(connId, obj)` | `GET /crm/v7/settings/fields?module={obj}` |
| `getRecords(connId, obj, {offset, limit})` | `GET /crm/v7/{obj}?page={offset/200+1}&per_page=200`. For large exports: Bulk Read API (async). |
| `getRecordCount(connId, obj)` | `GET /crm/v7/{obj}?per_page=1` and read `info.count`. Or COQL: `SELECT COUNT(id) FROM {obj}`. |
| `refreshSchema(connId)` | Re-call getObjects + getFields. Changes: new custom fields/modules, property changes, layout changes. |
| `createField(connId, obj, def)` | `POST /crm/v7/settings/fields?module={obj}`. Note: API name auto-generated. |
| `createObject(connId, def)` | `POST /crm/v7/settings/modules`. Enterprise+ only. |

## 9. Pain Points vs ConnectorAdapter

### Critical
1. **Region-specific base URLs**: No global endpoint. `dataCenterRegion` is mandatory config. Auth domain also varies. **SDK gap: `connect(config)` needs a way to express region/environment context.**
2. **COQL offset max 2000**: Cannot paginate beyond 2200 records with COQL. Must use standard REST pagination or async Bulk API for large tables.
3. **Auto-generated API names**: When creating custom fields, the resulting `api_name` is derived from label. Cannot control it. Must read back after creation.

### Moderate
4. **Layout-dependent required fields**: A field's `required` varies by layout. `system_mandatory` is the safe bet. **SDK gap: `ConnectorField.isRequired` doesn't distinguish "always required" vs "required in this layout".**
5. **Subforms (nested objects)**: Subform fields are inline child records — don't map to flat `ConnectorField`. **SDK gap: no concept of nested/sub-fields.**
6. **Edition-dependent capabilities**: Schema write and custom modules require Enterprise+. Bulk API quotas vary. **SDK gap: `ConnectorCapabilities` is static, but capabilities may depend on the connected org's edition.**
7. **Async Bulk API**: Bulk Read/Write are async (submit -> poll -> download). Doesn't fit synchronous `getRecords` pattern. Needs separate optimization layer.

### Minor
8. **Rate limits vary by edition**: Free plan exhausts quickly during migration.
9. **Formula/rollup fields**: Read-only, cannot be created via API. Must mark `isReadOnly: true`.
10. **Access token 1h expiry**: Must handle mid-operation refresh.
