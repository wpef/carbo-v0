# Quickstart: HubSpot Destination Connector

**Feature**: 002-hubspot-connector
**Date**: 2026-03-19

## Integration Scenario 1: First Connection and Schema Browse

**Actor**: Consultant opening Carbo-v0 to configure a HubSpot destination.

1. Consultant navigates to the HubSpot connector page
2. Enters their HubSpot private app token
3. App validates the token and retrieves portal info
4. App automatically captures the initial schema snapshot
5. Consultant sees the object list (Contacts, Companies, Deals, custom objects)
6. Selects "Contacts" to view all properties with types and groups
7. Clicks "Preview data" to see existing HubSpot records with property stats

**Result**: The consultant knows exactly what the HubSpot destination looks like before mapping.

## Integration Scenario 2: Create Missing Properties

**Actor**: Consultant who discovered during mapping that the source has fields with no destination equivalent.

1. Consultant is on the Contacts property list
2. Clicks "Create Property"
3. Fills in: label "Migration Source ID", type "string", group "contactinformation"
4. System validates the name is unique and submits to HubSpot
5. Property is created and appears in the list marked "Created by Carbo"
6. Audit log records the creation with full details

**Result**: The consultant created a destination field without leaving Carbo-v0.

## Integration Scenario 3: Create Custom Object

**Actor**: Consultant whose source has an entity type (e.g., Invoices) that doesn't exist in HubSpot.

1. Consultant clicks "Create Object" on the object list page
2. Fills in: name "Invoice", primary display property "invoice_number"
3. System checks the portal supports custom objects (Enterprise tier)
4. Object is created in HubSpot and appears in the object list
5. Consultant can then add properties to the new object

**Result**: The consultant extended the HubSpot schema to accommodate source data.

## Integration with Downstream Features

### → Feature 003: Mapping Plan

The HubSpot connector provides:
- **DestinationSchema** (current snapshot) as the "destination side" of the mapping plan
- **DestinationObject** list for the consultant to select destination objects
- **DestinationProperty** list for field-to-field mapping
- **Schema write capability** to create missing fields during mapping

### → Feature 004: Client Documents

The DestinationSchema metadata (objects, properties, newly created fields) appears in generated
client documents describing the migration plan.

### → Connector SDK (future)

The HubSpot connector's architecture mirrors the Salesforce connector (001). The cross-feature
entity mapping (SourceField ↔ DestinationProperty) will inform the ConnectorField SDK interface.
The schema write capability (unique to destination connectors) will become an optional SDK interface.
