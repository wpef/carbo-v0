# Research: Salesforce Adapter

## Decision: PKCE implementation strategy

**Chosen**: Manual PKCE implementation using Node.js `crypto` module. Generate code_verifier (random 64-byte base64url string), derive code_challenge via SHA-256. Store verifier on `globalThis.__pkceStore` keyed by a state parameter.

**Rationale**: jsforce does not support PKCE (FR-003, FR-004). Node.js `crypto` provides all needed primitives. globalThis persists across Next.js hot-reloads in dev mode.

**Rejected**: Using a third-party PKCE library. Unnecessary dependency for ~20 lines of crypto code.

## Decision: Token exchange mechanism

**Chosen**: Direct `fetch()` POST to `{loginUrl}/services/oauth2/token` with form-encoded body: `grant_type=authorization_code`, `code`, `client_id`, `client_secret`, `redirect_uri`, `code_verifier`.

**Rationale**: jsforce's `OAuth2.authorize()` does not accept `code_verifier` (spec gotcha). Direct HTTP POST is the only way to complete PKCE flow.

**Rejected**: jsforce `OAuth2.authorize()`. Does not support PKCE, would break authentication.

## Decision: jsforce Connection initialization

**Chosen**: After manual token exchange, create `new jsforce.Connection({ accessToken, instanceUrl })` using values from the token response.

**Rationale**: jsforce is used for all API operations after auth (describeGlobal, describe, SOQL queries). The Connection object just needs valid tokens, regardless of how they were obtained.

## Decision: System object filtering

**Chosen**: Static array of ~130 filter patterns in `salesforce-constants.ts`. Patterns include:
- Suffix patterns: `__Share`, `__History`, `__Feed`, `__Tag`, `__ChangeEvent`
- Prefix patterns: `AI`, `Auth`, `Flow`, `Setup`
- Exact matches: `ApexClass`, `ApexTrigger`, `AsyncApexJob`, etc.

**Rationale**: FR-007 mandates filtering system objects. The list is maintained as a constant within the adapter. A function `isSystemObject(apiName: string): boolean` tests against all patterns.

**Rejected**: Database-stored filter list. Over-engineering for a static configuration.

## Decision: Default object pre-selection

**Chosen**: Two rules in `salesforce-constants.ts`:
1. Custom objects: API name ends with `__c` -> isSelected = true
2. Common CRM objects: explicit list (Account, Contact, Lead, Opportunity, Case, Campaign, Task, Event, Note, Attachment, ContentDocument) -> isSelected = true

**Rationale**: FR-008. These are the objects consultants almost always need for CRM migrations.

## Decision: Rate limit handling

**Chosen**: Parse `Sforce-Limit-Info` header from jsforce responses. Format: `api-usage=X/Y`. When X/Y > 0.8, apply exponential backoff (1s, 2s, 4s, 8s, max 30s). Log rate limit status.

**Rationale**: FR-012. Salesforce uses a daily API request limit (not per-second). The header is present on every response. Proactive backoff prevents hitting the hard limit.

**Implementation note**: jsforce does not expose response headers directly. Use jsforce's `httpApi` event listener or wrap API calls to capture headers.

## Decision: Token refresh

**Chosen**: On 401 response, POST to `{loginUrl}/services/oauth2/token` with `grant_type=refresh_token` and the stored refresh token. If refresh fails, set connection status to EXPIRED.

**Rationale**: FR-013. Transparent refresh prevents consultant interruption. Using direct POST (not jsforce) for consistency with initial token exchange.

## Decision: Record pagination via SOQL

**Chosen**: SOQL with `LIMIT` and `OFFSET` clauses. Example: `SELECT field1, field2 FROM Contact LIMIT 25 OFFSET 0`.

**Rationale**: Simple pagination matching spec's PaginatedRecords type. OFFSET works for preview purposes (up to 2000 offset). For larger datasets, queryMore would be needed, but record preview is capped at a few pages.

**Limitation**: SOQL OFFSET is limited to 2000 rows. Sufficient for record preview.

## Decision: Field stats calculation

**Chosen**: Calculate stats from the fetched record set (not additional API calls). For each field: count nulls, count distinct values, sample up to 5 unique non-null values.

**Rationale**: FR-011. Computing stats from already-fetched records avoids extra API calls. The record preview page already has the data.

**Limitation**: Stats are based on the visible page of records, not the full dataset. Acceptable for preview purposes.

## API Reference

### Salesforce OAuth2 endpoints
- Authorization: `{loginUrl}/services/oauth2/authorize`
- Token exchange: `{loginUrl}/services/oauth2/token`

### jsforce methods used
- `connection.describeGlobal()` -> object list
- `connection.describe(objectName)` -> fields for an object
- `connection.query(soql)` -> record query
- `connection.identity()` -> org info (for display)

### Environment variables
- `SALESFORCE_CLIENT_ID`: Consumer Key from Connected App
- `SALESFORCE_CLIENT_SECRET`: Consumer Secret
- `SALESFORCE_CALLBACK_URL`: Must match Connected App callback (e.g., `http://localhost:3000/api/connectors/salesforce/callback`)
- `SALESFORCE_LOGIN_URL`: Optional, defaults to `https://login.salesforce.com`
