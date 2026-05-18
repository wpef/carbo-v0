# Data Model: Schema Write

## Prisma Schema

### SchemaWriteOperation (FR-010)

```prisma
enum SchemaWriteOperationType {
  CREATE_OBJECT
  CREATE_FIELD
  MODIFY_FIELD
}

enum SchemaWriteResult {
  SUCCESS
  ERROR
}

model SchemaWriteOperation {
  id                  String                    @id @default(cuid())
  connectionId        String
  operationType       SchemaWriteOperationType
  targetObjectApiName String                    // Object on which the operation is performed
  details             Json                      // { name, type, picklistValues?, description?, group?, fieldApiName? (for modify) }

  result              SchemaWriteResult
  errorMessage        String?                   // Null on success; populated on error
  createdAt           DateTime                  @default(now())

  @@index([connectionId])
  @@index([createdAt])
  @@map("schema_write_operations")
}
```

### ConnectorAdapter Extension (000 interface)

The following additions are made to the existing `ConnectorAdapter` interface in `src/lib/types/connector.ts`:

```typescript
// Existing optional methods:
// createObject?(connectionId, object): Promise<ConnectorObject>
// createField?(connectionId, objectApiName, field): Promise<ConnectorField>

// New optional method:
modifyField?(
  connectionId: string,
  objectApiName: string,
  fieldApiName: string,
  updates: FieldModification
): Promise<ConnectorField>
```

### ConnectorCapabilities Extension (000 interface)

```typescript
// Existing:
// canRead: boolean
// canWrite: boolean
// canWriteSchema: boolean

// New:
supportedFieldTypes?: string[]    // e.g., ['string', 'number', 'date', 'enumeration', 'bool']
```

## Field Descriptions

### SchemaWriteOperation

| Field | Type | Description |
|-------|------|-------------|
| `id` | `String (cuid)` | Unique identifier. |
| `connectionId` | `String` | ID of the destination connection on which the write was performed. Not a FK (connection may be deleted independently). |
| `operationType` | `SchemaWriteOperationType` | Type of operation: create object, create field, or modify field. |
| `targetObjectApiName` | `String` | API name of the object being modified or containing the field being created/modified. |
| `details` | `Json` | Structured payload with the full request details. Shape varies by operationType (see DTOs below). |
| `result` | `SchemaWriteResult` | Whether the operation succeeded or failed. |
| `errorMessage` | `String?` | Error message from the destination API or local validation. Null on success. |
| `createdAt` | `DateTime` | When the operation was attempted. |

### Details JSON Shape by Operation Type

**CREATE_OBJECT**:
```json
{
  "name": "Projects",
  "label": "Projects",
  "primaryProperty": { "name": "project_name", "type": "string", "label": "Project Name" }
}
```

**CREATE_FIELD**:
```json
{
  "name": "annual_revenue",
  "type": "number",
  "label": "Annual Revenue",
  "description": "Annual revenue of the company in their reporting currency.",
  "picklistValues": null,
  "group": "financial_info"
}
```

**MODIFY_FIELD**:
```json
{
  "fieldApiName": "industry",
  "changes": {
    "description": "Updated description",
    "picklistValues": ["Technology", "Finance", "Healthcare", "SaaS"]
  }
}
```

## Relationships

```
SchemaWriteOperation   -- standalone audit record (no FK to MigrationPlan)
                       -- references connectionId (logical, not FK)
                       -- logged to AuditLog separately
```

Note: `SchemaWriteOperation` does not have a FK to `MigrationPlan` because schema writes operate at the connection level, not the plan level. A single connection may be referenced by multiple plans. The `AuditLog` entry links to the plan if the write was initiated from a plan context.

## Constraints

- `connectionId` is NOT a FK -- the operation record survives connection deletion (audit persistence).
- `details` is a JSON column for flexibility across operation types. Schema validation is done in the service layer, not at the DB level.
- No uniqueness constraint on operations -- the same field can be created and modified multiple times (each attempt is a separate audit record).

## Indexes

- `connectionId` -- query all write operations for a connection (audit history).
- `createdAt` -- chronological ordering of operations (audit trail display).

## DTOs

### CreateFieldRequest

```typescript
interface CreateFieldRequest {
  objectApiName: string           // Target object
  name: string                    // Field API name (required)
  label: string                   // Field display label (required)
  type: string                    // Field type from supportedFieldTypes (required)
  description?: string            // Optional description (may be LLM-generated)
  picklistValues?: string[]       // Required if type is picklist/enumeration
  group?: string                  // Optional property group
}
```

### ModifyFieldRequest

```typescript
interface ModifyFieldRequest {
  objectApiName: string           // Target object
  fieldApiName: string            // Field to modify
  updates: {
    name?: string                 // Rename (if supported)
    label?: string                // Change display label
    type?: string                 // Change type (if supported)
    description?: string          // Update description
    picklistValues?: string[]     // Update values (if picklist)
    group?: string                // Change group
  }
}
```

### CreateObjectRequest

```typescript
interface CreateObjectRequest {
  name: string                    // Object API name (required)
  label: string                   // Object display label (required)
  description?: string            // Optional description
  primaryProperty: {
    name: string                  // Primary field API name
    label: string                 // Primary field display label
    type: string                  // Primary field type (usually "string")
  }
}
```

### GenerateDescriptionRequest

```typescript
interface GenerateDescriptionRequest {
  objectApiName: string           // Object context
  objectLabel: string             // Object display name
  fieldName: string               // Field name
  fieldType: string               // Field type
  sampleValues?: unknown[]        // Up to 5 sample values (GDPR-gated)
  companyContext?: string          // Company/market metaprompt
}
```

### GenerateDescriptionResponse

```typescript
interface GenerateDescriptionResponse {
  description: string             // LLM-generated description
  model: string                   // Model used (e.g., "claude-sonnet-4-20250514")
  tokensUsed: number              // For cost tracking
}
```

### SchemaWriteOperationDTO

```typescript
interface SchemaWriteOperationDTO {
  id: string
  connectionId: string
  operationType: 'CREATE_OBJECT' | 'CREATE_FIELD' | 'MODIFY_FIELD'
  targetObjectApiName: string
  details: Record<string, unknown>
  result: 'SUCCESS' | 'ERROR'
  errorMessage: string | null
  createdAt: string               // ISO 8601
}
```
