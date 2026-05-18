# Data Model: Migration Logic

## Prisma Schema Additions

```prisma
model MigrationLogic {
  id              String   @id @default(uuid())
  fieldMappingId  String   @unique
  sectionType     String   // VALUE_EQUIVALENCE | PROMPT | ERROR | INFORMATIONAL
  status          String   @default("DRAFT")  // DRAFT | DEFINED | VALIDATED | INCOMPATIBLE
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  fieldMapping          FieldMapping       @relation(fields: [fieldMappingId], references: [id], onDelete: Cascade)
  valueEquivalences     ValueEquivalence[]
  classificationPrompt  ClassificationPrompt?

  @@index([fieldMappingId])
}

model ValueEquivalence {
  id                String   @id @default(uuid())
  migrationLogicId  String
  sourceValue       String
  destinationValue  String
  createdAt         DateTime @default(now())

  migrationLogic    MigrationLogic @relation(fields: [migrationLogicId], references: [id], onDelete: Cascade)

  @@unique([migrationLogicId, sourceValue])
  @@index([migrationLogicId])
}

model ClassificationPrompt {
  id                String   @id @default(uuid())
  migrationLogicId  String   @unique
  promptText        String

  migrationLogic    MigrationLogic @relation(fields: [migrationLogicId], references: [id], onDelete: Cascade)
}
```

## Entity Relationships

```
FieldMapping   (1) ──► (0..1) MigrationLogic
MigrationLogic (1) ──► (N)    ValueEquivalence      [when sectionType = VALUE_EQUIVALENCE]
MigrationLogic (1) ──► (0..1) ClassificationPrompt   [when sectionType = PROMPT]
```

## Key Constraints

- **One-to-one with FieldMapping**: Enforced by `@unique` on fieldMappingId. Each FieldMapping has at most one MigrationLogic.
- **One source value per equivalence**: `@@unique([migrationLogicId, sourceValue])` ensures each source picklist value maps to exactly one destination value within a MigrationLogic. Multiple source values CAN map to the same destination value (many-to-one).
- **Section-type polymorphism**: `sectionType` determines which child records are relevant. VALUE_EQUIVALENCE uses ValueEquivalence rows. PROMPT uses ClassificationPrompt. ERROR and INFORMATIONAL have no child data.

## Status Lifecycle

```
(no record)  →  DRAFT       (modal opened, auto-created)
DRAFT        →  DEFINED     (Save clicked)
DRAFT        →  VALIDATED   (Validate clicked)
DEFINED      →  VALIDATED   (Validate clicked)
VALIDATED    →  DEFINED     (logic modified and saved again)
(ERROR type) →  INCOMPATIBLE (auto-set, cannot be changed)
```

## Notes

- D3 (Error) creates a MigrationLogic with status `INCOMPATIBLE`. No child data. This record exists so the system can distinguish "no migration logic defined" from "types are incompatible."
- D4 (Informational) creates a MigrationLogic with sectionType `INFORMATIONAL`. The consultant can only Validate (no Save). Status goes directly from DRAFT to VALIDATED.
- Cascade: deleting a FieldMapping cascades to MigrationLogic, which cascades to ValueEquivalence and ClassificationPrompt.
