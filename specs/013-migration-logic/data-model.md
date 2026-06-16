# Data Model: Migration Logic

## Prisma Schema

### MigrationLogic (FR-001, FR-002, FR-012, FR-013)

```prisma
enum LogicStatus {
  DRAFT
  DEFINED
  VALIDATED
}

model MigrationLogic {
  id             String      @id @default(uuid())
  fieldMappingId String      @unique
  status         LogicStatus @default(DRAFT)
  config         String      @default("{}")
  description    String?
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt

  fieldMapping         FieldMapping         @relation(fields: [fieldMappingId], references: [id], onDelete: Cascade)
  valueEquivalences    ValueEquivalence[]
  classificationPrompt ClassificationPrompt?
}
```

> **Note**: `sectionType` (D1/D2/D3/D4) is NOT a dedicated column. It is computed at runtime
> via `getSectionType(sourceType, destType)` and cached in the `config` JSON field as
> `{ "sectionType": "VALUE_EQUIVALENCE" | "PROMPT" | "ERROR" | "INFORMATIONAL" }`.
> This is a deliberate v4 design choice to avoid redundant storage.

### ValueEquivalence (FR-004, FR-005, FR-006)

```prisma
model ValueEquivalence {
  id               String @id @default(uuid())
  migrationLogicId String
  sourceValue      String
  destinationValue String

  migrationLogic MigrationLogic @relation(fields: [migrationLogicId], references: [id], onDelete: Cascade)
}
```

### ClassificationPrompt (FR-007, FR-008, FR-009)

```prisma
model ClassificationPrompt {
  id               String @id @default(uuid())
  migrationLogicId String @unique
  promptText       String

  migrationLogic MigrationLogic @relation(fields: [migrationLogicId], references: [id], onDelete: Cascade)
}
```

> **Note**: `/classify` endpoint is currently a deterministic stub (substring-match fallback to
> first destination value). Real LLM call via `@anthropic-ai/sdk` is implemented as a TODO;
> `ANTHROPIC_API_KEY` must be present to activate it.

## Field Descriptions

### MigrationLogic

| Field | Type | Description |
|-------|------|-------------|
| `id` | `String (uuid)` | Unique identifier. |
| `fieldMappingId` | `String` | FK to the parent FieldMapping. `@unique` — one MigrationLogic per field mapping. |
| `status` | `LogicStatus` | Current status: DRAFT (just created), DEFINED (saved, orange), VALIDATED (validated, green). |
| `config` | `String` | JSON blob. Carries `sectionType` (D1/D2/D3/D4) — the only way sectionType is persisted. |
| `description` | `String?` | Optional human-readable note. Not currently set by the UI. |
| `createdAt` | `DateTime` | Record creation timestamp. |
| `updatedAt` | `DateTime` | Last modification timestamp. Auto-managed by Prisma. |

### ValueEquivalence

| Field | Type | Description |
|-------|------|-------------|
| `id` | `String (uuid)` | Unique identifier. |
| `migrationLogicId` | `String` | FK to the parent MigrationLogic. |
| `sourceValue` | `String` | The source picklist value (exact string as returned by the connector). |
| `destinationValue` | `String` | The destination picklist value this source value maps to. |

### ClassificationPrompt

| Field | Type | Description |
|-------|------|-------------|
| `id` | `String (uuid)` | Unique identifier. |
| `migrationLogicId` | `String` | FK to the parent MigrationLogic. `@unique` — one prompt per logic. |
| `promptText` | `String` | The LLM classification prompt text entered by the consultant. |

## Relationships

```
FieldMapping (1) ──► (0..1) MigrationLogic        (cascade delete from FieldMapping)
MigrationLogic (1) ──► (N) ValueEquivalence        (cascade delete; D1 section)
MigrationLogic (1) ──► (0..1) ClassificationPrompt (cascade delete; D2 section)
```

**Note**: D3 (Error) and D4 (Informational) sections do not have dedicated child tables. D3 creates no MigrationLogic record (error state, no logic possible). D4 creates a MigrationLogic record with status DEFINED or VALIDATED and no children — the "logic" is implicit (copy as-is). In both cases `config` JSON stores the sectionType for DTO reconstruction.

## Constraints

- `MigrationLogic.fieldMappingId` is `@unique` — each field mapping has at most one migration logic record.
- `ClassificationPrompt.migrationLogicId` is `@unique` — one prompt per migration logic.
- `ValueEquivalence` has no uniqueness constraint on `(migrationLogicId, sourceValue)` at the DB level — the service enforces that each source value maps to at most one destination value (FR-006) during upsert (delete-all-then-create-many pattern).
- Cascade delete from `FieldMapping` ensures removing a field link also removes migration logic and all children.
- Cascade delete from `MigrationLogic` ensures removing a logic record also removes equivalences and prompts.

## Indexes

- `MigrationLogic.fieldMappingId` is `@unique` (implicitly indexed) — lookup logic by field mapping.
- No explicit `@@index` on `ValueEquivalence` or `ClassificationPrompt` in the implemented schema.

## Computed State: Link Status

The link status displayed on the field mapping view (012 C1) is NOT stored. It is computed from:

```typescript
function computeLinkStatus(
  sourceType: string,
  destType: string,
  migrationLogic: MigrationLogic | null
): LinkStatus {
  const sectionType = getSectionType(sourceType, destType)

  if (sectionType === 'ERROR') return 'RED_DASHED'
  if (!migrationLogic) return 'RED_SOLID'
  if (migrationLogic.status === 'VALIDATED') return 'GREEN'
  if (migrationLogic.status === 'DEFINED') return 'ORANGE'
  return 'RED_SOLID' // DRAFT or unknown
}
```

This function is shared between `src/features/migration-logic/lib/` and the field mapping view.
