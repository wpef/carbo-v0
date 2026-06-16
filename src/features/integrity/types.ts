// 017-mapping-integrity-check — TypeScript types for the integrity feature (v4)
// Aligned to v4 Prisma enums:
//   IntegrityEntityType = OBJECT_MAPPING | FIELD_MAPPING | MIGRATION_LOGIC | MIGRATION_FILTER
//   IntegrityIssueType  = UNMAPPED_REQUIRED_FIELD | INCOMPATIBLE_TYPE | MISSING_LOGIC |
//                         INVALID_FILTER | BROKEN_REFERENCE | MISSING_EQUIVALENCE

// ─── IntegrityIssueDTO ─────────────────────────────────────────────────────────
/**
 * Data-transfer object for a single integrity issue (FR-001 to FR-008).
 * Returned by checkIntegrity, getUnresolvedIssues, getIssuesForEntity.
 */
export interface IntegrityIssueDTO {
  id: string
  /** Kind of entity affected by this issue. */
  entityType: 'OBJECT_MAPPING' | 'FIELD_MAPPING' | 'MIGRATION_LOGIC' | 'MIGRATION_FILTER'
  /** ID of the affected ObjectMapping, FieldMapping, MigrationLogic, or MigrationFilter. */
  entityId: string
  /** Classification of the integrity issue. */
  issueType:
    | 'UNMAPPED_REQUIRED_FIELD'
    | 'INCOMPATIBLE_TYPE'
    | 'MISSING_LOGIC'
    | 'INVALID_FILTER'
    | 'BROKEN_REFERENCE'
    | 'MISSING_EQUIVALENCE'
  /** ERROR or WARNING */
  severity: string
  /** Human-readable description of the issue. */
  message: string
  /** Whether the issue has been resolved (manually or auto-resolved). */
  resolved: boolean
  /** ISO 8601 timestamp when the issue was resolved. Null = still active. */
  resolvedAt: string | null
  /** ISO 8601 timestamp when the issue was first detected. */
  detectedAt: string
}

// ─── IntegrityCheckResult ──────────────────────────────────────────────────────
/**
 * Result returned by checkIntegrity(planId) — FR-009 to FR-011.
 */
export interface IntegrityCheckResult {
  planId: string
  /** Updated plan status after the check. */
  planStatus: 'DRAFT' | 'READY' | 'BROKEN'
  /** ISO 8601 timestamp when the check ran. */
  checkedAt: string
  /** Total issues ever recorded (resolved + unresolved). */
  totalIssues: number
  /** Count of unresolved issues after this check. */
  unresolvedIssues: number
  /** All currently unresolved issues. */
  issues: IntegrityIssueDTO[]
}

// ─── RepairResult ──────────────────────────────────────────────────────────────
/**
 * Result returned by repairBrokenMappings(planId).
 * Principle IX: repair is explicit user action only — never automatic.
 */
export interface RepairResult {
  deletedObjectMappings: number
  deletedFieldMappings: number
  planStatus: 'DRAFT' | 'READY' | 'BROKEN'
}
