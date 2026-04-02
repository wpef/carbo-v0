# Quickstart: Field Stats

## Prerequisites

- Feature 009 (Record Preview) implemented — `useRecordPreview` hook and record-preview component working
- `FieldStats` type from 000-connector-interface

## Setup

No additional setup. This is a pure client-side feature.

```bash
npm run dev
```

## Dev Workflow

```bash
# Run unit tests for computation logic
npx vitest run tests/unit/utils/compute-field-stats.test.ts
```

## Manual Testing

1. Open a plan with a connected system and records available
2. Navigate to record preview for an object
3. Click "Show field stats" toggle
4. Verify per-field stats: null count, distinct count, sample values
5. Verify scope label: "Based on N records"
6. Navigate to next page — stats recompute for new page
7. Test edge cases:
   - Object with zero records: "No data to analyze"
   - Field with all nulls: null count = N, distinct = 0, no samples
   - Field with all same value: distinct = 1, sample shows that value
   - Field with binary placeholder: shows "N/A"

## Example Usage

```typescript
import { computeFieldStats } from "@/utils/compute-field-stats";
import type { ConnectorRecord, FieldStats } from "@/lib/connectors/types";

const records: ConnectorRecord[] = [
  { Id: "001", Name: "John", Email: null, Status: "Active" },
  { Id: "002", Name: "Jane", Email: "jane@co.com", Status: "Active" },
  { Id: "003", Name: "Bob", Email: "bob@co.com", Status: "Inactive" },
];

const stats: FieldStats[] = computeFieldStats(records);
// [
//   { fieldApiName: "Id", nullCount: 0, distinctCount: 3, sampleValues: ["001", "002", "003"] },
//   { fieldApiName: "Name", nullCount: 0, distinctCount: 3, sampleValues: ["John", "Jane", "Bob"] },
//   { fieldApiName: "Email", nullCount: 1, distinctCount: 2, sampleValues: ["jane@co.com", "bob@co.com"] },
//   { fieldApiName: "Status", nullCount: 0, distinctCount: 2, sampleValues: ["Active", "Inactive"] },
// ]
```
