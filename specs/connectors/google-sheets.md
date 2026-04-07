# Google Sheets — Connector Research

**Date**: 2026-03-27
**Role**: Source-only
**API**: Google Sheets API v4

## 1. API Overview

| Aspect | Details |
|--------|---------|
| **Base URL** | `https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}` |
| **Rate Limits** | 300 reads/min per project, 60 reads/min per user. |
| **Pagination** | Range-based (A1 notation). No built-in cursor or offset. |
| **Cell limits** | 10M cells/spreadsheet, 18,278 columns, 50k chars/cell. |

## 2. Authentication

| Method | Details |
|--------|---------|
| **OAuth 2.0** | Standard Google consent flow. Scope: `spreadsheets.readonly`. |
| **Service Account** | JSON key file. Spreadsheet must be shared with service account email. |

**Config needed**: `accessToken`, `refreshToken`, `spreadsheetId`, `headerRow` (default: 1).

**Scoping**: One connection = one spreadsheet. Multiple spreadsheets = multiple connections.

## 3. Data Model

### Structure
Spreadsheet → Sheets (tabs) → Grid (rows x columns)

### Interpretation as Tables
- Row 1 (configurable) = headers = field names
- Rows 2+ = records
- Each tab = one "object"

### Value Types (internal)
- `stringValue` — text
- `numberValue` — numbers, dates (serial numbers), currency, percentages
- `boolValue` — TRUE/FALSE
- `formulaValue` — formula text (result in `effectiveValue`)

**Key nuance**: Dates and numbers are both `numberValue`. Distinction exists only in cell formatting (`effectiveFormat.numberFormat.type`: TEXT, NUMBER, PERCENT, CURRENCY, DATE, TIME, DATE_TIME).

## 4. Schema Discovery

### List Sheets
`GET /v4/spreadsheets/{id}?fields=sheets.properties` — returns sheet `title`, `sheetId`, `sheetType` (filter to GRID), `gridProperties`.

### Infer Fields from Header Row
`GET /v4/spreadsheets/{id}/values/{sheetTitle}!1:1` — returns first row as string array. Each non-empty cell = one field.

### Type Inference (heuristic)
- Read 50-row sample with `valueRenderOption=UNFORMATTED_VALUE`
- If >80% numeric → `number`
- If matches date patterns → `date`
- If boolean → `boolean`
- Default → `string`

**Or pragmatic approach**: default everything to `string`, let mapping engine handle conversion.

## 5. Record Operations

### Read
- `GET /v4/spreadsheets/{id}/values/{sheet}!A{offset+2}:{lastCol}{offset+limit+1}`
- Range-based pagination using A1 notation
- `valueRenderOption`: FORMATTED_VALUE (display strings) or UNFORMATTED_VALUE (raw)
- `batchGet` for multiple ranges in one call

### Record Count
- **No count endpoint**
- Read column A: `GET /values/{sheet}!A:A`, count non-empty cells minus 1
- `gridProperties.rowCount` is unreliable (allocated grid size, not data)
- Cache result

### Throughput
At 60 reads/min/user, 5000 rows/chunk: ~300k rows/min. Adequate for most migrations.

## 6. SDK

| Package | Notes |
|---------|-------|
| `googleapis` (npm, official) | Monolith covering all Google APIs. Verbose DX. |
| `@googleapis/sheets` | Lighter, Sheets-only extraction. Same API. |
| `google-spreadsheet` (npm, community) | Higher-level wrapper. Nice DX but abstraction risk. |

Recommend: `googleapis` or `@googleapis/sheets` for consistency.

## 7. ConnectorAdapter Mapping

| Method | Google Sheets Implementation |
|--------|----------------------------|
| `connect(config)` | Validate with `spreadsheets.get?fields=spreadsheetId,properties.title`. Config: OAuth tokens + `spreadsheetId` + `headerRow`. |
| `getObjects(connId)` | List GRID sheets. Each tab = one ConnectorObject. `isCustom: true` always. |
| `getFields(connId, obj)` | Read header row + 50-row sample for type inference. |
| `getRecords(connId, obj, {offset, limit})` | Range-based read: `{sheet}!A{offset+2}:{lastCol}{offset+limit+1}`. **Numeric offset works here** (A1 notation supports it). |
| `getRecordCount(connId, obj)` | Read column A, count non-empty cells - 1. Cache. |
| `refreshSchema(connId)` | Re-read sheet list + headers. Diff against snapshot. |

## 8. Pain Points vs ConnectorAdapter

### Fundamental Mismatches
1. **No real schema**: "Schema" is inferred from data, not declared. Can change any time someone edits a header. **SDK gap: `ConnectorField` assumes schema is authoritative, but for Sheets it's heuristic.**
2. **No unique record IDs**: Row number is the only handle, and it shifts on insert/delete. **SDK gap: breaks idempotence (Principle V). Need synthetic IDs like `{sheet}:row:{n}` with instability warning.**
3. **All types are strings internally**: Type inference is heuristic, unreliable. A "number" column can contain text in any row.
4. **`isRequired`, `isReadOnly`, `isUnique` meaningless**: Always false. No constraint system.
5. **`relationshipName` / `referenceTo` meaningless**: No relational model. Always null.
6. **`isCustom` meaningless**: All sheets are user-created. Always true.

### Practical Challenges
7. **Empty rows in middle of data**: Breaks sequential reading. Must decide: skip or stop.
8. **Merged cells**: Break tabular assumption. Must detect and warn.
9. **Header row not always row 1**: Need configurable `headerRow` in connect config.
10. **Column ordering fragile**: Inserting a column breaks all subsequent field mappings.
11. **One connection = one spreadsheet**: User with data in 3 spreadsheets needs 3 connections.
12. **No change tracking**: Every sync = full read.

### Recommended Mitigations
- `headerRow` config parameter
- Default all types to `string`
- Synthetic row IDs with instability warning
- Detect merged cells, surface warning in UI
- Skip empty rows, log positions
- Aggressive schema caching

## 9. Summary

Google Sheets is the most "un-CRM-like" connector. The fundamental mismatch is that Sheets has no schema, no types, no IDs, and no constraints — all of which `ConnectorAdapter` assumes exist. The adapter must paper over these gaps with heuristics and conventions. Despite this, it's a high-value connector because so many small businesses use Sheets as their "CRM". The key SDK insight is that **the interface needs to express confidence/reliability levels** — a Salesforce schema is authoritative, a Sheets schema is a best-effort guess.
