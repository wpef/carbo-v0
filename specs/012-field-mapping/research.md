# Research: Field Mapping

## Decision 1: Type Compatibility Matrix Implementation

**Options**:
- **Hardcoded switch/case**: Fast, but hard to maintain and extend.
- **2D lookup table**: A `Record<string, Record<string, CompatibilityResult>>` map. Simple, declarative, easy to extend.
- **Database-driven**: Store matrix in DB. Overkill for a fixed set of 5 base types.

**Decision**: 2D lookup table as a TypeScript constant in `src/lib/services/type-compatibility.ts`. The matrix from spec.md (5 types x 5 types = 25 combinations) is small and static. Exposes `getCompatibility(sourceType, destType): { status: 'COMPATIBLE' | 'NEEDS_LOGIC' | 'INCOMPATIBLE', section: 'D1' | 'D2' | 'D3' | 'D4', message?: string }`. This service is reused by 013 (migration logic) and 017 (integrity check).

## Decision 2: Auto-Match Registry Architecture

Mirrors the auto-link registry pattern from 011. A static TypeScript map in `field-auto-match-registry.ts`, keyed by `${sourceAdapterType}:${destinationAdapterType}:${sourceObjectName}:${destinationObjectName}`, returning arrays of `{ sourceField, destinationField }` pairs.

For SF-to-HS Contact-to-Contact: FirstName-firstname, LastName-lastname, Email-email, Phone-phone, etc.

The registry also supports a fallback: if no object-specific entry exists, try matching by `${sourceAdapterType}:${destinationAdapterType}:*:*` for cross-object common fields (e.g., Email-email appears on multiple objects).

## Decision 3: One-to-One Mapping Enforcement

Enforced at two levels:
1. **Database**: Unique indexes on `(objectMappingId, sourceFieldName)` and `(objectMappingId, destinationFieldName)` in the Prisma schema.
2. **Service**: FieldMappingService checks before creating. Returns a clear error message ("Source field X is already mapped to Y").

The same source field CAN appear in different ObjectMappings (e.g., if Contact is mapped to both Contacts and Leads). The constraint is per-ObjectMapping, not global.

## Decision 4: Link Color Status Computation

The spec defines four states: green (validated), orange (defined not validated), red solid (no logic), red dashed (incompatible).

This is a **computed state**, not stored in the database. Derived at render time from:
1. `typeCompatibility.status` (from the matrix)
2. Whether MigrationLogic exists for this FieldMapping
3. If exists, whether MigrationLogic.status is VALIDATED

```typescript
function getLinkStatus(fieldMapping: FieldMapping, migrationLogic?: MigrationLogic): LinkStatus {
  if (fieldMapping.compatibilityStatus === 'INCOMPATIBLE') return 'RED_DASHED';
  if (!migrationLogic) return 'RED_SOLID';
  if (migrationLogic.status === 'VALIDATED') return 'GREEN';
  return 'ORANGE';
}
```

## Decision 5: Fill Rate Data Source

Fill rate (percentage of records with a value) comes from FieldStats provided by the connector interface (feature 010). If field stats are not yet computed, the fill rate shows "N/A". Fill rate is displayed on source field cards only (destination fields don't have source data).

If feature 010 is not implemented yet, the field card gracefully handles missing stats by showing "--" instead of a percentage.

## Decision 6: Field List Performance

With 200+ fields per side (400+ DOM nodes + SVG links), we use the same strategy as 011: simple scrollable divs with client-side search/filter. The search input filters by field name or type. No virtualization needed at this scale.
