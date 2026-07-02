# Quickstart: Schema Write

## What this feature provides

Ability to create new fields, modify existing fields, and create new custom objects on the destination system directly from the mapping workspace. Includes LLM-generated field descriptions. All operations are audited and gated by connector capability.

## How to use

### 1. Check if schema writes are available

```typescript
import { getAdapter } from '@/lib/adapters/registry'

const adapter = getAdapter(connection.type)
if (!adapter.capabilities.canWriteSchema) {
  // Schema write features are hidden in the UI
  // FR-001: never offer schema writes for this connection
}
```

### 2. Create a new field

```typescript
// POST /api/connections/[connectionId]/schema/fields
const res = await fetch(`/api/connections/${connectionId}/schema/fields`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    objectApiName: 'contacts',
    name: 'annual_revenue',
    label: 'Annual Revenue',
    type: 'number',
    description: 'Annual revenue of the company.',
    group: 'financial_info',
  }),
})
const { field, operation } = await res.json()
// field: ConnectorField (the created field)
// operation: SchemaWriteOperationDTO (audit record)
```

### 3. Modify an existing field

```typescript
// PATCH /api/connections/[connectionId]/schema/fields/[fieldApiName]?objectApiName=contacts
const res = await fetch(
  `/api/connections/${connectionId}/schema/fields/industry?objectApiName=contacts`,
  {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      updates: {
        description: 'Updated industry classification.',
        picklistValues: ['Technology', 'Finance', 'Healthcare', 'SaaS'],
      },
    }),
  }
)
const { field, operation } = await res.json()
```

### 4. Create a new custom object

```typescript
// POST /api/connections/[connectionId]/schema/objects
const res = await fetch(`/api/connections/${connectionId}/schema/objects`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'projects',
    label: 'Projects',
    description: 'Custom object for tracking projects.',
    primaryProperty: {
      name: 'project_name',
      label: 'Project Name',
      type: 'string',
    },
  }),
})
const { object, operation } = await res.json()
```

### 5. Generate an LLM description

```typescript
// POST /api/connections/[connectionId]/schema/describe
const res = await fetch(`/api/connections/${connectionId}/schema/describe`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    objectApiName: 'contacts',
    objectLabel: 'Contacts',
    fieldName: 'annual_revenue',
    fieldType: 'number',
    companyContext: 'B2B SaaS company selling to enterprise clients.',
  }),
})
const { description } = await res.json()
// description: "Annual revenue of the company in their reporting currency. Used for segmentation and account scoring."
```

### 6. Copy from source field (UI pattern)

```typescript
// In CreateFieldForm component:
// When "Copy from source field" is selected, pre-fill from source field data:
const prefillFromSource = (sourceField: ConnectorField) => ({
  name: sourceField.apiName,
  label: sourceField.label,
  type: mapSourceTypeToDestType(sourceField.dataType),  // uses type normalization
  description: sourceField.description ?? '',
  // picklistValues: fetched separately if source is picklist
})
```

## Key behavior

- **Capability gating**: All schema write UI and API endpoints check `canWriteSchema` before proceeding. If false, the feature is invisible (FR-001).
- **Destination only**: Schema writes are only available on destination connections. Source connections are read-only (FR-012).
- **Pre-validation**: Name uniqueness, type support, and required fields are validated locally before the remote API call (FR-008).
- **Audit trail**: Every operation (success or failure) is logged to `SchemaWriteOperation` and `AuditLog` (FR-010).
- **Auto-refresh**: After a successful write, the local schema snapshot is automatically refreshed (FR-011).
- **LLM optional**: Description generation requires an Anthropic API key. If not configured, the button is hidden (FR-006).

## Dependencies

- **Depends on**: 000 (ConnectorAdapter interface -- `createObject`, `createField`, `modifyField`), 003/007 (schema snapshot refresh), 008 (destination field retrieval)
- **Extended by**: None currently
- **Consumed by**: 012 (field mapping view -- "Add field" button, destination field click)
- **Triggers**: 003/007 (snapshot refresh after write), 017 (integrity check via refresh)
