# Data Model: Contractual Document Generation

## Prisma Entity

```prisma
model ContractualDocument {
  id              String   @id @default(cuid())
  mappingPlanId   String
  referenceNumber String   @unique   // Format: CARBO-YYYYMMDD-XXXX
  htmlContent     String              // Full rendered formal HTML document
  generatedAt     DateTime @default(now())

  // Generation statistics
  fieldCount      Int
  ruleCount       Int
  unmappedCount   Int
  filterCount     Int
  llmCallCount    Int

  // Relationships
  mappingPlan     MappingPlan @relation(fields: [mappingPlanId], references: [id])

  @@index([mappingPlanId])
}
```

## Notes

- `referenceNumber` is globally unique across all contractual documents (not just within a plan). Format: `CARBO-YYYYMMDD-XXXX`.
- `htmlContent` stores the complete self-contained formal HTML (including inline CSS with serif fonts, signature block).
- The document is **immutable**: no update operations. Each generation creates a new row with a new reference number.
- `filterCount` is tracked separately (unlike TextDocument) because the contractual document has a dedicated filter table section.
- Relationship to `MappingPlan` is many-to-one: a plan can have multiple contractual document versions.
