# Data Model: Migration Logic

## Prisma Schema

### MigrationLogic (FR-001, FR-002, FR-012, FR-013)

```prisma
enum MigrationLogicStatus {
  DRAFT
  DEFINED
  VALIDATED
}

model MigrationLogic {
  id              String                @id @default(cuid())
  fieldMappingId  String                @unique
  fieldMapping    FieldMapping          @relation(fields: [fieldMappingId], references: [id], onDelete: Cascade)

  status          MigrationLogicStatus  @default(DRAFT)

  createdAt       DateTime              @default(now())
  updatedAt       DateTime              @updatedAt

  // Polymorphic children (only one set is populated depending on the section type)
  valueEquivalences   ValueEquivalence[]
  classificationPrompt ClassificationPrompt?

  @@map("migration_logic")
}
```

### ValueEquivalence (FR-004, FR-005, FR-006)

```prisma
model ValueEquivalence {
  id                String          @id @default(cuid())
  migrationLogicId  String
  migrationLogic    MigrationLogic  @relation(fields: [migrationLogicId], references: [id], onDelete: Cascade)

  sourceValue       String
  destinationValue  String

  createdAt         DateTime        @default(now())

  @@index([migrationLogicId])
  @@map("value_equivalences")
}
```

### ClassificationPrompt (FR-007, FR-008, FR-009)

```prisma
model ClassificationPrompt {
  id                String          @id @default(cuid())
  migrationLogicId  String          @unique
  migrationLogic    MigrationLogic  @relation(fields: [migrationLogicId], references: [id], onDelete: Cascade)

  promptText        String

  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt

  @@map("classification_prompts")
}
```

## Field Descriptions

### MigrationLogic

| Field | Type | Description |
|-------|------|-------------|
| `id` | `String (cuid)` | Unique identifier. |
| `fieldMappingId` | `String` | FK to the parent FieldMapping. `@unique` -- one MigrationLogic per field mapping. |
| `status` | `MigrationLogicStatus` | Current status: DRAFT (just created), DEFINED (saved, orange), VALIDATED (validated, green). |
| `createdAt` | `DateTime` | Record creation timestamp. |
| `updatedAt` | `DateTime` | Last modification timestamp. Auto-managed by Prisma. |

### ValueEquivalence

| Field | Type | Description |
|-------|------|-------------|
| `id` | `String (cuid)` | Unique identifier. |
| `migrationLogicId` | `String` | FK to the parent MigrationLogic. |
| `sourceValue` | `String` | The source picklist value (exact string as returned by the connector). |
| `destinationValue` | `String` | The destination picklist value this source value maps to. |
| `createdAt` | `DateTime` | Record creation timestamp. |

### ClassificationPrompt

| Field | Type | Description |
|-------|------|-------------|
| `id` | `String (cuid)` | Unique identifier. |
| `migrationLogicId` | `String` | FK to the parent MigrationLogic. `@unique` -- one prompt per logic. |
| `promptText` | `String` | The LLM classification prompt text entered by the consultant. |
| `createdAt` | `DateTime` | Record creation timestamp. |
| `updatedAt` | `DateTime` | Last modification timestamp. |

## Relationships

```
FieldMapping (1) ──► (0..1) MigrationLogic        (cascade delete from FieldMapping)
MigrationLogic (1) ──► (N) ValueEquivalence        (cascade delete; D1 section)
MigrationLogic (1) ──► (0..1) ClassificationPrompt (cascade delete; D2 section)
```

**Note**: D3 (Error) and D4 (Informational) sections do not have dedicated child tables. D3 creates no MigrationLogic record (error state, no logic possible). D4 creates a MigrationLogic record with status DEFINED or VALIDATED and no children -- the "logic" is implicit (copy as-is).

## Constraints

- `MigrationLogic.fieldMappingId` is `@unique` -- each field mapping has at most one migration logic record.
- `ClassificationPrompt.migrationLogicId` is `@unique` -- one prompt per migration logic.
- `ValueEquivalence` has no uniqueness constraint on `(migrationLogicId, sourceValue)` at the DB level -- the service enforces that each source value maps to at most one destination value (FR-006) during upsert.
- Cascade delete from `FieldMapping` ensures removing a field link also removes migration logic and all children.
- Cascade delete from `MigrationLogic` ensures removing a logic record also removes equivalences and prompts.

## Indexes

- `ValueEquivalence.migrationLogicId` -- query all equivalences for a logic record.
- `MigrationLogic.fieldMappingId` is `@unique` (implicitly indexed) -- lookup logic by field mapping.

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
