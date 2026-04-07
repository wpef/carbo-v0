# Research: Destination Field Retrieval

## Key Decisions

### 1. Retrieve Fields for All Objects vs. On-Demand

**Decision**: Retrieve fields for ALL destination objects in a single operation.

Unlike source (where only selected objects get field retrieval), destination objects all need fields available for mapping. The service iterates over all `SchemaObject` records for the destination snapshot and calls `adapter.getFields(objectApiName)` for each.

For a typical HubSpot instance with ~15-30 objects, this is manageable. For larger schemas, retrieval is parallelized with concurrency control (max 5 concurrent calls to avoid rate limits).

### 2. Shared vs. Separate Field Service

**Decision**: Reuse field retrieval service from 005.

The `field-retrieval.service.ts` from 005 should accept a `connectionId` + list of object API names. For source, the list is filtered by selection. For destination, the list is all objects in the snapshot. Same service, different input.

If 005's service only accepts selected objects, it needs a small refactoring: accept an explicit object list parameter rather than querying selection state internally.

### 3. HubSpot Field/Property Retrieval

**Decision**: Use `@hubspot/api-client` properties API.

```typescript
// HubSpot properties for a standard object
const hubspot = new Client({ accessToken });
const properties = await hubspot.crm.properties.coreApi.getAll("contacts");
// Returns: { results: [{ name, label, type, fieldType, options, ... }] }
```

HubSpot property metadata maps to `ConnectorField`:
- `name` -> `apiName`
- `label` -> `label`
- `type` + `fieldType` -> `dataType` (e.g., "string/text", "number/number", "enumeration/select")
- `modificationMetadata.readOnlyValue` -> `isReadOnly`
- `hasUniqueValue` -> `isUnique`
- Required is not directly exposed in HubSpot's API; inferred from `required` field in create schemas

### 4. Field Accessibility for Destination

**Decision**: All HubSpot properties are accessible (no field-level security like Salesforce). The `isAccessible` flag defaults to `true` for HubSpot. The adapter still includes it for interface compatibility.

## Trade-offs

| Choice | Pro | Con |
|--------|-----|-----|
| Retrieve all at once | Simple UX, all fields ready for mapping | Slower initial load for large schemas |
| Parallel retrieval (max 5) | Faster than sequential | Must handle partial failures |
| Shared service with 005 | DRY | Must ensure 005's service is flexible enough |
