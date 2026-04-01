# Microsoft Dynamics 365 — Connector Research

**Date**: 2026-03-27
**Role**: Source + Destination (both)
**API**: Dataverse Web API (OData v4)

## 1. API Overview

| Aspect | Details |
|--------|---------|
| **Base URL** | `https://{org}.api.crm.dynamics.com/api/data/v9.2/` |
| **Protocol** | OData v4 RESTful |
| **Rate Limits** | Layered: per-user (60k requests/5min), per-org (aggregate), service protection (429 with Retry-After). |
| **Pagination** | Server-driven via `@odata.nextLink`. Max 5000 records/page. |
| **Batch** | `$batch` endpoint, up to 1000 operations per batch. |

## 2. Authentication

**OAuth 2.0 via Azure AD exclusively.**

- App registration in Azure AD required
- Client credentials flow (server-to-server) recommended
- Must also create Application User in Dynamics admin center with security roles
- **Most complex auth setup** of all 6 connectors

**Config needed**: `tenantId`, `clientId`, `clientSecret`, `orgUrl` (e.g., `https://contoso.api.crm.dynamics.com`)

Token endpoint: `https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token`
Scope: `https://{org}.crm.dynamics.com/.default`

## 3. Data Model

### Core Entities
Accounts, Contacts, Leads, Opportunities, Cases, Activities (Tasks, Emails, Phone Calls, Appointments), Products, Price Lists, Quotes, Orders, Invoices, Knowledge Articles.

### Three Naming Systems (major pain point)
| System | Example | Used For |
|--------|---------|----------|
| **Logical Name** | `account` | Metadata API, filtering |
| **Schema Name** | `Account` | Display, PascalCase |
| **Entity Set Name** | `accounts` | OData URLs (plural) |

Must maintain mapping between all three.

### Attributes (Fields)
- Standard + custom attributes (custom prefixed with publisher prefix, e.g., `cr123_fieldname`)
- Types: String, Integer, Money, DateTime, Boolean, Lookup (FK), OptionSet (picklist, integer-backed), MultiSelectOptionSet, Memo, UniqueIdentifier, etc.
- **OptionSets are integer-backed**: stored as numbers, need label resolution via metadata

### Relationships
- 1:N (parent-child, FK as Lookup attribute)
- N:N (via intersection entity)
- Polymorphic lookups (Customer = Account OR Contact)

### Custom Entities
Fully supported via metadata API. Prefixed with publisher prefix.

## 4. Schema Discovery

### List Entities
`GET /api/data/v9.2/EntityDefinitions?$select=LogicalName,DisplayName,SchemaName,EntitySetName,IsCustomEntity`

Very verbose response (megabytes). **Must use `$select`** to limit fields.

### Get Attributes
`GET /api/data/v9.2/EntityDefinitions(LogicalName='{name}')/Attributes?$select=LogicalName,DisplayName,AttributeType,RequiredLevel,IsValidForCreate,IsValidForUpdate`

Typed attributes (Lookups, OptionSets) need OData type casting for full details:
- `Microsoft.Dynamics.CRM.LookupAttributeMetadata` → targets
- `Microsoft.Dynamics.CRM.PicklistAttributeMetadata` → OptionSet values

## 5. Record Operations

### Read
- `GET /api/data/v9.2/{entitySetName}?$select=field1,field2&$top=5000`
- Server-driven pagination: response includes `@odata.nextLink` (full URL for next page)
- `$count=true` in query → adds `@odata.count` to response
- `$filter`, `$orderby`, `$expand` (for related records)
- **FetchXML**: Alternative query language (XML-based, more powerful than OData filter)

### Write
- `POST /api/data/v9.2/{entitySetName}` — create
- `PATCH /api/data/v9.2/{entitySetName}({id})` — update
- `$batch` — up to 1000 operations per request (changesets for transactions)
- Upsert via `PATCH` with `If-Match: *` / `If-None-Match: *` headers

### Record Count
- `GET /api/data/v9.2/{entitySetName}?$count=true&$top=0` → `@odata.count`
- Or `GET /api/data/v9.2/{entitySetName}/$count` → plain integer
- Capped at 5000 unless `Prefer: odata.maxpagesize=0` or RetrieveTotalRecordCount function

## 6. Schema Write

### Custom Entities — YES
`POST /api/data/v9.2/EntityDefinitions` with full entity metadata. **Requires `PublishXml` call afterward.**

### Custom Attributes — YES
`POST /api/data/v9.2/EntityDefinitions(LogicalName='{entity}')/Attributes` with attribute metadata. Also requires publish.

### Mandatory Publish Step
After creating entities/attributes: `POST /api/data/v9.2/PublishXml` with XML payload listing what to publish. Without this, changes are invisible.

## 7. SDK

| Package | Notes |
|---------|-------|
| `@azure/msal-node` | Official, auth only (token acquisition) |
| `dynamics-web-api` (community) | OData wrapper, decent quality, maintained |
| Raw fetch | Recommended approach with typed response interfaces |

No official Dynamics Web API npm package from Microsoft.

## 8. ConnectorAdapter Mapping

| Method | Dynamics 365 Implementation |
|--------|---------------------------|
| `connect(config)` | Acquire token via MSAL (`tenantId`, `clientId`, `clientSecret`, `orgUrl`). Validate with `GET /api/data/v9.2/WhoAmI`. |
| `getObjects(connId)` | `GET EntityDefinitions?$select=LogicalName,DisplayName,SchemaName,EntitySetName,IsCustomEntity`. **Must cache, very large response.** |
| `getFields(connId, obj)` | `GET EntityDefinitions(LogicalName='{obj}')/Attributes`. Type-cast queries for Lookups and OptionSets. |
| `getRecords(connId, obj, {offset, limit})` | `GET /{entitySetName}?$top={limit}`. **Server-driven pagination via `@odata.nextLink`** — another cursor-based system, not numeric offset. |
| `getRecordCount(connId, obj)` | `GET /{entitySetName}/$count` or `?$count=true&$top=0`. |
| `refreshSchema(connId)` | Re-fetch EntityDefinitions + Attributes, diff. |
| `createField(connId, obj, def)` | `POST EntityDefinitions(.../Attributes)` + `PublishXml`. |
| `createObject(connId, def)` | `POST EntityDefinitions` + `PublishXml`. |

## 9. Pain Points vs ConnectorAdapter

### Critical
1. **Server-driven pagination** (`@odata.nextLink`): Cannot request arbitrary offset. Next page URL is returned by server. **Same SDK gap as Pipedrive/Airtable: cursor-based, not numeric offset.**
2. **Three naming systems**: LogicalName vs SchemaName vs EntitySetName. Must maintain mapping. **SDK gap: `ConnectorObject.apiName` is one string, but Dynamics needs 2-3 names depending on the operation.**
3. **OptionSets are integer-backed**: A picklist field stores `3`, not `"Active"`. Label resolution requires metadata lookup. **SDK gap: `ConnectorField` doesn't express "this value is an internal code that needs label resolution".**

### Moderate
4. **Azure AD setup complexity**: Most onerous auth setup of all connectors. App registration + Application User + security roles. **SDK gap: `connect(config)` is simple flat config, but Dynamics needs multi-step provisioning guidance.**
5. **Mandatory publish step**: After schema write, must call `PublishXml`. **SDK gap: `createField`/`createObject` don't have a "publish" concept. Could be implicit in the adapter, but adds latency.**
6. **Metadata API verbosity**: EntityDefinitions response can be megabytes. Must use aggressive `$select` discipline.
7. **Typed attribute casting**: Getting full metadata for Lookups/OptionSets requires OData type cast queries — multiple API calls per entity.

### Minor
8. **Layered throttling**: Per-user + per-org + service protection limits. Must handle 429 with exponential backoff.
9. **Custom entity prefix**: All custom entities/attributes have publisher prefix (e.g., `cr123_`). Must handle this in display.
10. **Polymorphic lookups**: A lookup that can reference Account OR Contact. Not expressible with single `referenceTo: string`.
