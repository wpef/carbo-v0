# API Routes: Mapping Plan

**Feature**: 003-mapping-plan
**Date**: 2026-03-19

## Plans

### GET /api/mapping/plans

List all mapping plans.

**Response** (200):
```json
{
  "plans": [
    {
      "id": "uuid",
      "name": "Salesforce → HubSpot Migration Q1",
      "status": "DRAFT",
      "sourceConnection": { "orgName": "SF Prod", "type": "salesforce" },
      "destinationConnection": { "portalName": "HS Prod", "type": "hubspot" },
      "objectMappingCount": 3,
      "totalFieldMappings": 145,
      "updatedAt": "2026-03-19T10:00:00Z"
    }
  ]
}
```

### POST /api/mapping/plans

Create a new mapping plan.

**Request**:
```json
{
  "name": "Salesforce → HubSpot Migration Q1",
  "description": "Full CRM migration",
  "sourceConnectionId": "uuid",
  "destinationConnectionId": "uuid"
}
```

---

## Object Mappings

### GET /api/mapping/plans/{planId}/objects

List object mappings in a plan, including completion stats and integrity status.

**Response** (200):
```json
{
  "objectMappings": [
    {
      "id": "uuid",
      "sourceObject": { "apiName": "Contact", "label": "Contact" },
      "destinationObject": { "apiName": "contacts", "label": "Contacts" },
      "totalSourceFields": 67,
      "mappedFieldCount": 45,
      "unmappedFieldCount": 22,
      "requiredDestFieldsUnmapped": 0,
      "filterCount": 2,
      "estimatedRecordCount": 12500
    }
  ]
}
```

### POST /api/mapping/plans/{planId}/objects

Add an object mapping.

**Request**:
```json
{
  "sourceObjectApiName": "Contact",
  "destinationObjectApiName": "contacts"
}
```

---

## Field Mappings

### GET /api/mapping/plans/{planId}/objects/{objectMappingId}/fields

List field mappings for an object mapping, including unmapped source fields and unmapped required destination fields.

**Response** (200):
```json
{
  "fieldMappings": [
    {
      "id": "uuid",
      "sourceField": { "apiName": "FirstName", "label": "First Name", "type": "string" },
      "destinationProperty": { "apiName": "firstname", "label": "First Name", "type": "string" },
      "isTypeCompatible": true,
      "status": "VALID",
      "transformationRules": [],
      "validationRules": []
    }
  ],
  "unmappedSourceFields": [
    { "apiName": "MailingCountry", "label": "Mailing Country", "type": "string" }
  ],
  "unmappedRequiredDestFields": []
}
```

### POST /api/mapping/plans/{planId}/objects/{objectMappingId}/fields

Create a field mapping.

**Request**:
```json
{
  "sourceFieldApiName": "FirstName",
  "destinationPropertyApiName": "firstname"
}
```

---

## Rules

### POST /api/mapping/plans/{planId}/objects/{objectMappingId}/fields/{fieldMappingId}/rules

Add a transformation or validation rule.

**Request** (transformation):
```json
{
  "category": "transformation",
  "type": "JS_FUNCTION",
  "value": "value.trim().toUpperCase()"
}
```

**Request** (validation):
```json
{
  "category": "validation",
  "type": "REGEX",
  "value": "^[A-Z]{2}$"
}
```

**Response** (201):
```json
{
  "rule": {
    "id": "uuid",
    "category": "transformation",
    "type": "JS_FUNCTION",
    "value": "value.trim().toUpperCase()",
    "syntaxValid": true
  }
}
```

**Errors**:
- 400: JS syntax error (includes error message and position)

---

## Filters

### GET /api/mapping/plans/{planId}/objects/{objectMappingId}/filters

List migration filters with estimated record count.

**Response** (200):
```json
{
  "filters": [
    {
      "id": "uuid",
      "sourceFieldApiName": "CreatedDate",
      "sourceFieldLabel": "Created Date",
      "operator": "DATE_AFTER",
      "value": "2020-01-01",
      "orderIndex": 0
    }
  ],
  "estimatedRecordCount": 12500,
  "totalRecordCount": 45000
}
```

### POST /api/mapping/plans/{planId}/objects/{objectMappingId}/filters

Add a migration filter.

**Request**:
```json
{
  "sourceFieldApiName": "Email",
  "operator": "ENDS_WITH",
  "value": "@company.com"
}
```
