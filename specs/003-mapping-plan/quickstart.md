# Quickstart: Mapping Plan

**Feature**: 003-mapping-plan
**Date**: 2026-03-19

## Integration Scenario 1: Create a Basic Mapping

**Actor**: Consultant with connected Salesforce source and HubSpot destination.

1. Consultant creates a new mapping plan "SF → HS Q1 Migration"
2. Links it to the Salesforce connection (source) and HubSpot connection (destination)
3. Adds an object mapping: Contact (SF) → Contacts (HS)
4. Sees source fields and destination properties side by side
5. Maps FirstName → firstname, LastName → lastname, Email → email
6. Views the mapping summary: 3 mapped, 64 unmapped source fields listed explicitly
7. Saves the plan

**Result**: A structured mapping plan exists, clearly showing what's mapped and what's not.

## Integration Scenario 2: Add Transformation and Validation Rules

**Actor**: Consultant refining a mapping with data transformation needs.

1. Consultant opens the Contact→Contacts mapping
2. On the FirstName→firstname mapping, adds a JS transformation: `value.trim()`
3. On a MailingCountryCode→country mapping, adds a fixed value transformation: "FR"
4. On the Email→email mapping, adds a regex validation: `^[^@]+@[^@]+\.[^@]+$`
5. Each rule is immediately validated and displayed on the mapping
6. Consultant views the full mapping with all rules listed in order

**Result**: The mapping now includes data transformation logic that will be applied during migration.

## Integration Scenario 3: Define Migration Filters

**Actor**: Consultant who only wants to migrate recent, active contacts.

1. Consultant opens the Contact→Contacts object mapping
2. Adds filter: CreatedDate > 2020-01-01
3. Adds filter: Email ends with @company.com
4. System shows estimated record count: 12,500 out of 45,000 total
5. Consultant adjusts filters and sees count update

**Result**: The migration scope is explicitly defined and quantified.

## Integration with Downstream Features

### ← Features 001 + 002: Connectors

The mapping plan consumes:
- **SourceSchema** from 001 for source fields
- **DestinationSchema** from 002 for destination properties
- **Record counts** from both connectors for filter estimation

### → Feature 004: Client Documents

The mapping plan provides:
- Complete field mapping list with transformation/validation rules
- Migration filters with scope estimation
- Unmapped field warnings
- All data needed to generate client-facing documentation

### → Feature 006: Migration Execution (Phase 2)

The mapping plan is the execution specification:
- Field mappings define data flow
- Transformation rules define data processing
- Validation rules define acceptance criteria
- Migration filters define record scope
