# Act! CRM — Connector Research

**Date**: 2026-03-27
**Role**: Source-only (legacy CRM, companies migrate FROM)
**API**: REST Web API (Act! Premium Cloud / on-premise v21+)

## 1. API Overview

| Aspect | Details |
|--------|---------|
| **Base URL** | `https://{host}/act.web.api/api` (cloud or on-prem via Connect Link) |
| **Versioning** | None (flat `/api` namespace) |
| **Rate Limits** | Not formally documented. Not designed for high-throughput bulk extraction. |
| **Coverage** | Act! Premium Cloud: always available. On-premise v21+: requires Connect Link. Act! Pro / pre-v21: NO API. |

## 2. Authentication

**Custom token-based** (NOT OAuth2, NOT API key):
1. `POST /api/auth` with `{ host, database, username, password }`
2. Returns session token (20min inactivity timeout)
3. Refresh via `POST /api/auth/refresh`
4. Raw password storage required — no delegated auth

**Config needed**: `host`, `database`, `username`, `password`

**Security concern**: must encrypt credentials at rest.

## 3. Data Model

### Core Entities (fixed, no discovery endpoint)
| Entity | Endpoint | Notes |
|--------|----------|-------|
| Contacts | `/api/contacts` | Primary entity, centerpiece of Act! |
| Companies | `/api/companies` | Orgs, contacts belong to company |
| Groups | `/api/groups` | Static contact groupings |
| Opportunities | `/api/opportunities` | Sales pipeline / deals |
| Activities | `/api/activities` | Tasks, calls, meetings |
| Notes | `/api/notes` | Free-text notes on contacts |
| History | `/api/histories` | Completed activity log |
| Products | `/api/products` | Product catalog |

### Relationships
- Contacts -> Companies (many-to-one via `companyId`)
- Contacts <-> Groups (many-to-many)
- Opportunities <-> Contacts (many-to-many)
- Activities/Notes/History -> Contacts (one-to-many)
- Products <-> Opportunities (via line items)

### Custom Fields
- Supported on Contacts, Companies, Groups, Opportunities
- Types: text, numeric, date, currency, URL, email, phone, checkbox, picklist, memo
- Returned alongside standard fields in responses

### Custom Tables
- Act! Premium supports user-defined tables linked to contacts
- API support is **limited and inconsistent** across versions

## 4. Schema Discovery

**No "describe all objects" endpoint.** Entity list is hardcoded.

### Field Discovery
- `GET /api/contacts/fields` — returns field definitions including custom fields
- `GET /api/companies/fields`, `GET /api/opportunities/fields` — same pattern
- Activities/Notes/History: less consistent field discovery

### Field Metadata
- `fieldName` (API name), `displayName` (label), `fieldType`
- `isRequired`: sometimes available
- `isReadOnly`: not consistently returned
- `allowedValues`: for picklists

## 5. Record Operations

### Read
- `GET /api/{entity}?$top={limit}&$skip={offset}` — OData-style pagination
- Default page size: 25-50, max ~200
- `$filter`, `$orderby`, `$select` supported (basic filtering only)
- **No bulk export endpoint** — page-by-page only

### Record Count
- No dedicated endpoint
- Some responses include `totalCount` in envelope (not guaranteed)
- May need to iterate all pages

## 6. SDK

**No npm package** (official or community). Raw REST only. ~60% more implementation effort vs SF/HS.

## 7. ConnectorAdapter Mapping

| Method | Act! Implementation |
|--------|-------------------|
| `connect(config)` | `POST /api/auth` with host/database/username/password. Store session token. |
| `getObjects(connId)` | **Hardcoded list** of 8 known entities. Probe `/api/customtables` for custom tables (handle 404). |
| `getFields(connId, obj)` | `GET /api/{obj}/fields`. Default missing metadata (`isReadOnly: false`, `isUnique: false`). |
| `getRecords(connId, obj, {offset, limit})` | `GET /api/{obj}?$top={limit}&$skip={offset}` |
| `getRecordCount(connId, obj)` | `GET /api/{obj}?$top=1&$skip=0`, read `totalCount` if available. |
| `refreshSchema(connId)` | Re-call getObjects + getFields. |

## 8. Pain Points vs ConnectorAdapter

### Critical
1. **No schema discovery endpoint**: Object list must be hardcoded. **SDK gap: `getObjects()` assumes all adapters can dynamically discover objects.**
2. **Custom auth (not OAuth2)**: Username/password storage required. **SDK gap: `connect(config)` needs to support varied auth patterns, not just token-based flows.**
3. **Inconsistent API across versions**: Error responses vary (JSON, plain text, HTML). Field metadata incomplete.

### Moderate
4. **No bulk export**: Page-by-page only. Large databases (100k+ contacts) = slow, unreliable extraction.
5. **On-premise accessibility**: Requires network access to Act! Connect Link server. **SDK gap: no concept of network reachability testing in `connect()`.**
6. **Legacy data quality**: Duplicates, encoding issues (Windows-1252), orphaned records, massive sparsity. Not an SDK gap per se, but affects migration quality.

### Minor
7. **Session token expiry (20min)**: Must refresh proactively during long operations.
8. **Custom tables inconsistently exposed via API**.

## 9. Data Extraction Alternatives (when API is insufficient)

| Method | Pros | Cons |
|--------|------|------|
| **CSV Export from Act! UI** | Works for all versions, handles custom tables | Manual, no automation |
| **Direct SQL Server access** (on-prem) | Complete data access, best performance | Requires DBA, undocumented schema, version-specific |
| **ODBC Driver** | SQL-like query access | Windows-only, version-specific |

### Recommended Tiered Strategy
1. **Primary**: REST API adapter for Act! Premium Cloud/on-prem v21+
2. **Fallback**: Generic CSV import adapter (covers old versions, Act! Pro, inaccessible APIs)
3. **Advanced** (future): Direct SQL Server adapter for on-prem

## 10. Summary

Act! is viable but challenging. The API is immature compared to modern CRMs. The biggest architectural insight is that some connectors simply cannot do dynamic schema discovery — they need a hardcoded object list. This challenges the assumption that `getObjects()` always returns a dynamically discovered list. The CSV fallback strategy is important and suggests a generic "file import" source adapter pattern.
