# Contracts: Schema Write

## API Routes

All routes are Next.js Route Handlers under `src/app/api/`. All schema write routes operate on **destination connections only** (FR-012). The route handler MUST verify that the connection is a destination and that `capabilities.canWriteSchema === true` before proceeding (FR-001).

---

### POST /api/connections/[connectionId]/schema/fields

Create a new field on a destination object.

**Path Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| `connectionId` | `string` | Destination connection ID |

**Request Body**:
```typescript
{
  objectApiName: string           // Target object API name
  name: string                    // Field API name (required)
  label: string                   // Display label (required)
  type: string                    // Field type (required, must be in supportedFieldTypes)
  description?: string            // Optional
  picklistValues?: string[]       // Required if type is picklist/enumeration
  group?: string                  // Optional property group
}
```

**Response 201**:
```typescript
{
  field: ConnectorField           // Created field as returned by the adapter
  operation: SchemaWriteOperationDTO  // Audit record
}
```

**Response 400**: Validation error (missing required fields, unsupported type, name conflict).
```typescript
{
  error: string                   // e.g., "Field name 'email' already exists on object 'contacts'"
  code: 'VALIDATION_ERROR'
}
```

**Response 403**: Connection does not support schema writes.
```typescript
{
  error: string                   // "This connection does not support schema writes"
  code: 'SCHEMA_WRITE_NOT_SUPPORTED'
}
```

**Response 422**: Remote API rejected the request (tier limit, reserved word, etc.).
```typescript
{
  error: string                   // Error from the destination system
  code: 'REMOTE_API_ERROR'
  details?: Record<string, unknown>
}
```

**Response 500**: Internal error.

**Behavior**:
1. Verify connection exists and is a destination. Verify `canWriteSchema === true`.
2. Run local validation: name uniqueness against current snapshot, type in `supportedFieldTypes`, required fields present.
3. Call `adapter.createField(connectionId, objectApiName, fieldData)`.
4. Log to `SchemaWriteOperation` (SUCCESS or ERROR).
5. Log to `AuditLog` (action: 'SCHEMA_WRITE_CREATE_FIELD').
6. Trigger snapshot refresh for the connection (FR-011).
7. Return created field + operation record.

---

### PATCH /api/connections/[connectionId]/schema/fields/[fieldApiName]

Modify an existing destination field.

**Path Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| `connectionId` | `string` | Destination connection ID |
| `fieldApiName` | `string` | Field API name to modify |

**Query Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| `objectApiName` | `string` | Object containing the field (required) |

**Request Body**:
```typescript
{
  updates: {
    name?: string
    label?: string
    type?: string
    description?: string
    picklistValues?: string[]
    group?: string
  }
}
```

**Response 200**:
```typescript
{
  field: ConnectorField           // Updated field
  operation: SchemaWriteOperationDTO
}
```

**Response 400**: Validation error.
**Response 403**: Schema writes not supported.
**Response 404**: Field not found in current snapshot.
**Response 422**: Remote API rejected the modification.
**Response 500**: Internal error.

**Behavior**:
1. Verify connection, destination, canWriteSchema.
2. Verify field exists in current snapshot.
3. Run local validation on updates (name uniqueness if renaming, type compatibility if changing type).
4. Call `adapter.modifyField(connectionId, objectApiName, fieldApiName, updates)`.
5. Log to SchemaWriteOperation + AuditLog.
6. Trigger snapshot refresh.
7. Return updated field + operation record.

---

### POST /api/connections/[connectionId]/schema/objects

Create a new custom object on the destination.

**Path Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| `connectionId` | `string` | Destination connection ID |

**Request Body**:
```typescript
{
  name: string                    // Object API name (required)
  label: string                   // Display label (required)
  description?: string
  primaryProperty: {
    name: string                  // Primary field API name
    label: string                 // Primary field display label
    type: string                  // Primary field type (usually "string")
  }
}
```

**Response 201**:
```typescript
{
  object: ConnectorObject         // Created object
  operation: SchemaWriteOperationDTO
}
```

**Response 400**: Validation error (missing fields, name conflict).
**Response 403**: Schema writes not supported.
**Response 422**: Remote API rejected (tier limit, reserved name).
**Response 500**: Internal error.

**Behavior**:
1. Verify connection, destination, canWriteSchema.
2. Run local validation: name uniqueness against current snapshot objects.
3. Call `adapter.createObject(connectionId, { apiName: name, label, description })`.
4. Log to SchemaWriteOperation + AuditLog.
5. Trigger snapshot refresh.
6. Return created object + operation record.

---

### POST /api/connections/[connectionId]/schema/describe

Generate an LLM-powered field description.

**Path Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| `connectionId` | `string` | Connection ID (for context) |

**Request Body**:
```typescript
{
  objectApiName: string
  objectLabel: string
  fieldName: string
  fieldType: string
  sampleValues?: unknown[]        // Up to 5 values (GDPR-gated)
  companyContext?: string          // Company/market metaprompt
}
```

**Response 200**:
```typescript
{
  description: string
  model: string
  tokensUsed: number
}
```

**Response 400**: Missing required fields.
**Response 503**: LLM unavailable (no API key configured, or API error).
```typescript
{
  error: string                   // "LLM description generation is unavailable. Please write the description manually."
  code: 'LLM_UNAVAILABLE'
}
```

**Behavior**:
1. Check that the Anthropic API key is configured. If not, return 503.
2. Assemble the prompt with provided context.
3. Call Claude API with the assembled prompt.
4. Return the generated description + metadata.
5. Log to AuditLog (action: 'LLM_DESCRIPTION_GENERATED').

---

## Internal Service API

### writeService.createField(connectionId, objectApiName, fieldData): Promise<{ field: ConnectorField; operation: SchemaWriteOperation }>

Orchestrates: validate -> adapter call -> audit log -> snapshot refresh.

### writeService.modifyField(connectionId, objectApiName, fieldApiName, updates): Promise<{ field: ConnectorField; operation: SchemaWriteOperation }>

Orchestrates: validate -> adapter call -> audit log -> snapshot refresh.

### writeService.createObject(connectionId, objectData): Promise<{ object: ConnectorObject; operation: SchemaWriteOperation }>

Orchestrates: validate -> adapter call -> audit log -> snapshot refresh.

### fieldValidator.validateCreateField(connectionId, objectApiName, fieldData): Promise<ValidationResult>

Returns `{ valid: true }` or `{ valid: false, errors: string[] }`. Checks:
- `name` is not empty
- `type` is in `supportedFieldTypes` for this connector
- `name` does not already exist on the object in the current snapshot
- If `type` is picklist/enumeration, `picklistValues` is non-empty

### fieldValidator.validateModifyField(connectionId, objectApiName, fieldApiName, updates): Promise<ValidationResult>

Checks:
- Field exists in current snapshot
- If renaming, new name doesn't conflict
- If changing type, new type is in `supportedFieldTypes`

### descriptionGenerator.generateDescription(context: GenerateDescriptionRequest): Promise<GenerateDescriptionResponse>

Assembles the Claude API prompt and returns the generated description. Throws if the API key is not configured or the call fails.

---

## Integration Points

### Connector Adapter (000)

The schema write service calls adapter methods directly. If `capabilities.canWriteSchema === false`, the service throws before attempting the call. The adapter methods are:
- `createObject(connectionId, object)` -- existing in 000
- `createField(connectionId, objectApiName, field)` -- existing in 000
- `modifyField(connectionId, objectApiName, fieldApiName, updates)` -- new addition to 000

### Schema Snapshot Refresh (003/007)

After every successful write, the service calls the existing schema refresh function to update the local snapshot. This ensures the destination field/object list is immediately up-to-date.

### Integrity Check (017)

The snapshot refresh after a write triggers the integrity check (017). Since a write adds or modifies fields/objects (never deletes), the check should not find new issues. However, if the write changes a field type in a way that breaks an existing mapping, the integrity check will flag it.

### Field Mapping View (012)

The "Add field" button and destination field click (modify) are UI entry points defined in 012's field mapping view. The schema write components are rendered within 012's layout but encapsulated as standalone components.
