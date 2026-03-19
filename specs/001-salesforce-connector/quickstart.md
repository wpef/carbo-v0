# Quickstart: Salesforce Source Connector

**Feature**: 001-salesforce-connector
**Date**: 2026-03-19

## Integration Scenario 1: First Connection

**Actor**: Consultant opening Carbo-v0 for the first time with a Salesforce org.

1. Consultant clicks "Connect Salesforce" on the source connector page
2. App redirects to Salesforce OAuth2 login page
3. Consultant logs in and grants access
4. Salesforce redirects back to the app with an authorization code
5. App exchanges the code for tokens, stores the refresh token (encrypted)
6. App automatically captures the initial schema snapshot
7. Consultant sees the object list with labels, API names, and custom/standard indicators
8. Consultant selects "Contact" to view all fields
9. Consultant clicks "Preview data" to see paginated records with field stats

**Result**: The consultant has a complete view of their Salesforce schema and data, ready for mapping.

## Integration Scenario 2: Schema Refresh After Changes

**Actor**: Consultant returning after adding a custom field in Salesforce.

1. Consultant opens the existing connection (auto-reconnects using refresh token)
2. Consultant clicks "Refresh Schema"
3. App captures a new schema snapshot and computes the diff
4. UI highlights: 1 field added (PreferredLanguage__c on Contact)
5. Consultant reviews the change and proceeds with mapping

**Result**: The consultant is confident they're working with the current state of the Salesforce org.

## Integration Scenario 3: Data Quality Check

**Actor**: Consultant assessing data quality before creating a mapping plan.

1. Consultant selects the "Contact" object
2. Clicks "Preview data" with stats enabled
3. Sees 45,230 total records with paginated view
4. Reviews field stats: Email has 12% null rate, Phone has 340 distinct values, Status__c has 5 sample values
5. Identifies that many contacts lack email — will need a transformation rule or filter in the mapping plan

**Result**: The consultant has a clear picture of data quality issues to address during mapping.

## Integration with Downstream Features

### → Feature 003: Mapping Plan

The Salesforce connector provides:
- **SourceSchema** (current snapshot) as the "source side" of the mapping plan
- **SourceObject** list for the consultant to select which objects to map
- **SourceField** list for field-to-field mapping, including types and constraints
- **Record preview** to inform transformation rule decisions

The mapping plan feature consumes these via the internal API routes.

### → Feature 004: Client Documents

The SourceSchema and its objects/fields provide the source-side metadata that appears in generated client documents (field names, types, and any "no access" warnings).

### → Connector SDK (future)

The Salesforce connector's service layer (`lib/connectors/salesforce/`) and shared types (`types/connector.ts`) will inform the Connector SDK interface. The API routes and UI components provide the pattern for future connectors.
