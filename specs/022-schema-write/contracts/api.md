# API Contracts: Schema Write

## POST /api/plans/[planId]/connections/[connectionId]/schema-write/fields

Create a new field on a destination object.

### Request

```json
{
  "objectApiName": "contacts",
  "name": "annual_revenue",
  "type": "number",
  "picklistValues": null,
  "description": "Annual revenue of the company",
  "group": "Financial Info"
}
```

### Response 201

```json
{
  "success": true,
  "field": {
    "apiName": "annual_revenue",
    "label": "Annual Revenue",
    "dataType": "number",
    "isRequired": false,
    "isReadOnly": false
  },
  "operationId": "clxyz123"
}
```

### Response 400

```json
{ "error": "Validation failed", "details": "A field named 'annual_revenue' already exists on this object" }
```

### Response 403

```json
{ "error": "Schema write not supported for this connection" }
```

### Response 500

```json
{ "error": "Field creation failed", "details": "Custom property limit reached" }
```

---

## PATCH /api/plans/[planId]/connections/[connectionId]/schema-write/fields/[fieldApiName]

Modify an existing destination field's properties.

### Request

```json
{
  "objectApiName": "contacts",
  "name": "annual_revenue_usd",
  "description": "Annual revenue in USD",
  "picklistValues": null,
  "group": "Financial Info"
}
```

Only changed fields need to be included.

### Response 200

```json
{
  "success": true,
  "field": {
    "apiName": "annual_revenue_usd",
    "label": "Annual Revenue USD",
    "dataType": "number",
    "isRequired": false,
    "isReadOnly": false
  },
  "operationId": "clxyz456"
}
```

### Response 400

```json
{ "error": "Modification rejected", "details": "Type change from 'number' to 'text' is not allowed by HubSpot" }
```

### Response 403

```json
{ "error": "Schema write not supported for this connection" }
```

---

## POST /api/plans/[planId]/connections/[connectionId]/schema-write/objects

Create a new custom object in the destination system.

### Request

```json
{
  "name": "Projects",
  "primaryPropertyName": "project_name",
  "primaryPropertyType": "text"
}
```

### Response 201

```json
{
  "success": true,
  "object": {
    "apiName": "projects",
    "label": "Projects",
    "isCustom": true
  },
  "operationId": "clxyz789"
}
```

### Response 400

```json
{ "error": "Validation failed", "details": "An object named 'Projects' already exists" }
```

### Response 403

```json
{ "error": "Schema write not supported for this connection" }
```

---

## POST /api/plans/[planId]/connections/[connectionId]/schema-write/describe-field

Generate a field description using LLM.

### Request

```json
{
  "objectApiName": "contacts",
  "fieldName": "annual_revenue",
  "fieldType": "number",
  "sampleValues": ["50000", "1200000", "75000"],
  "companyContext": "B2B SaaS company in the CRM market"
}
```

### Response 200

```json
{
  "description": "Annual revenue of the company in their reporting currency. Used for segmentation and reporting.",
  "source": "llm",
  "latencyMs": 1840
}
```

### Response 200 (no API key)

```json
{
  "description": "",
  "source": "unavailable",
  "message": "LLM generation is unavailable. Please set ANTHROPIC_API_KEY."
}
```

### Response 500

```json
{ "error": "Description generation failed", "details": "..." }
```
