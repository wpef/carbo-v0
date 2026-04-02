# Data Model: Text Document Generation

## Prisma Entity

```prisma
model TextDocument {
  id              String   @id @default(cuid())
  mappingPlanId   String
  htmlContent     String   // Full rendered HTML document
  generatedAt     DateTime @default(now())

  // Generation statistics
  fieldCount      Int
  ruleCount       Int
  unmappedCount   Int
  llmCallCount    Int

  // Relationships
  mappingPlan     MappingPlan @relation(fields: [mappingPlanId], references: [id])

  @@index([mappingPlanId])
}
```

## Notes

- `htmlContent` stores the complete self-contained HTML (including inline CSS).
- The document is **immutable**: no update operations. Each generation creates a new row.
- `generatedAt` is the timestamp of generation, not creation of the plan.
- Stats (`fieldCount`, `ruleCount`, `unmappedCount`, `llmCallCount`) are snapshot values at generation time.
- Relationship to `MappingPlan` is many-to-one: a plan can have multiple document versions.
