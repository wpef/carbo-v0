# Quickstart: Source Object Selection

## What this feature provides

A step in the migration workflow where the consultant reviews all source objects, selects which ones are relevant for migration, and drills into individual objects to preview record counts, fields, and sample data. The selection is persisted and restored on return.

## Prerequisite

- Feature 002 (Source Connection): a source must be connected.
- Feature 003 (Source Schema Retrieval): a CURRENT schema snapshot must exist.

## How to use

### 1. Navigate to object selection

From a plan with a connected source and retrieved schema:
```
/plans/[planId]/source/objects
```

### 2. Review the default selection

On first load, the system pre-selects:
- All custom objects (`isCustom = true`)
- Common business objects for the connector type (e.g., Account, Contact, Lead for Salesforce)
- System/internal objects are hidden by default (toggle "Show system objects" to reveal)

### 3. Search and filter

Type in the search box to filter by label or API name (case-insensitive, substring match). The list updates in real time.

### 4. Expand an object

Click the expand arrow on any object to see:
- Record count
- Full field list with types and constraints
- 3-5 sample records

This data is fetched live from the connector (not cached).

### 5. Modify selection

- Click the checkbox to toggle individual objects.
- Use "Select all visible" / "Deselect all visible" for bulk operations on the filtered list.
- The selection count updates in real time: "42 / 1,234 objects selected".

### 6. Proceed

Click "Retrieve Fields" at the bottom. Disabled if zero objects are selected.

## API usage (programmatic)

```typescript
// Get objects with selection state
const res = await fetch(`/api/plans/${planId}/source/objects`)
const { objects, summary } = await res.json()

// Toggle selection
await fetch(`/api/plans/${planId}/source/objects`, {
  method: 'PUT',
  body: JSON.stringify({
    selections: [
      { objectApiName: 'Account', isSelected: true },
      { objectApiName: 'ApexClass', isSelected: false },
    ]
  })
})

// Expand a single object (on-demand)
const expand = await fetch(`/api/plans/${planId}/source/objects/Account/expand`)
const { recordCount, fields, sampleRecords } = await expand.json()
```

## Dependencies

- **Depends on**: 000 (Connector Interface types), 002 (Source Connection), 003 (Source Schema Retrieval)
- **Used by**: 005 (Field Retrieval -- only retrieves fields for selected objects), 011 (Object Mapping), downstream migration features
