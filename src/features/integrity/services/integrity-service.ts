// 017-mapping-integrity-check — Integrity service (v4)
// Aligned to v4 schema: uses sourceObjectName/destinationObjectName, sourceFieldName/destinationFieldName,
// IntegrityIssueType={BROKEN_REFERENCE,UNMAPPED_REQUIRED_FIELD,INCOMPATIBLE_TYPE,INVALID_FILTER,...}
// IntegrityEntityType={OBJECT_MAPPING,FIELD_MAPPING,MIGRATION_LOGIC,MIGRATION_FILTER}

import { prisma } from '@/lib/prisma'
import { logAuditEvent } from '@/lib/audit'
import { checkTypeCompatibility } from '@/features/field-mapping/lib/type-compatibility'
import type {
  IntegrityIssueDTO,
  IntegrityCheckResult,
  RepairResult,
} from '../types'

// ─── checkIntegrity ────────────────────────────────────────────────────────────
/**
 * Run the full integrity check for a plan.
 *
 * Detects:
 * - BROKEN_REFERENCE on OBJECT_MAPPING: source or dest object no longer in CURRENT snapshot
 * - BROKEN_REFERENCE on FIELD_MAPPING:  source or dest field no longer in CURRENT snapshot
 * - INCOMPATIBLE_TYPE on FIELD_MAPPING: current types are INCOMPATIBLE per 012 matrix
 * - UNMAPPED_REQUIRED_FIELD on OBJECT_MAPPING: required dest field has no mapping
 * - INVALID_FILTER on MIGRATION_FILTER:  filter references a source field no longer in snapshot
 *
 * Idempotent: upserts issues (@@unique[planId,entityType,entityId,issueType]),
 * auto-resolves stale issues that no longer apply.
 *
 * FR-001 to FR-011 (spec 017).
 */
export async function checkIntegrity(planId: string): Promise<IntegrityCheckResult> {
  const checkedAt = new Date().toISOString()
  console.log(`[Integrity] Check started for plan ${planId}`)

  // Load plan connections
  const plan = await prisma.migrationPlan.findUnique({
    where: { id: planId },
    select: { id: true, status: true, currentStep: true, sourceConnectionId: true, destinationConnectionId: true },
  })
  if (!plan) throw new Error(`Plan not found: ${planId}`)

  if (!plan.sourceConnectionId || !plan.destinationConnectionId) {
    console.log(`[Integrity] No connections for plan ${planId} — skipping`)
    return { planId, planStatus: plan.status, checkedAt, totalIssues: 0, unresolvedIssues: 0, issues: [] }
  }

  // Load CURRENT snapshots
  const [sourceSnapshot, destSnapshot] = await Promise.all([
    prisma.schemaSnapshot.findUnique({
      where: { connectionId_side_status: { connectionId: plan.sourceConnectionId, side: 'SOURCE', status: 'CURRENT' } },
      include: { objects: { include: { fields: true } } },
    }),
    prisma.schemaSnapshot.findUnique({
      where: { connectionId_side_status: { connectionId: plan.destinationConnectionId, side: 'DESTINATION', status: 'CURRENT' } },
      include: { objects: { include: { fields: true } } },
    }),
  ])

  if (!sourceSnapshot || !destSnapshot) {
    console.log(`[Integrity] Missing snapshots for plan ${planId} — skipping`)
    return { planId, planStatus: plan.status, checkedAt, totalIssues: 0, unresolvedIssues: 0, issues: [] }
  }

  // Build lookup structures
  const sourceObjectNames = new Set(sourceSnapshot.objects.map((o) => o.apiName))
  const destObjectNames = new Set(destSnapshot.objects.map((o) => o.apiName))

  // field lookup: objectApiName -> Set<fieldApiName>
  const sourceFieldsByObj = new Map<string, Set<string>>()
  const sourceFieldTypesByObj = new Map<string, Map<string, string>>()
  for (const obj of sourceSnapshot.objects) {
    sourceFieldsByObj.set(obj.apiName, new Set(obj.fields.map((f) => f.apiName)))
    sourceFieldTypesByObj.set(obj.apiName, new Map(obj.fields.map((f) => [f.apiName, f.dataType])))
  }
  const destFieldsByObj = new Map<string, Set<string>>()
  const destFieldTypesByObj = new Map<string, Map<string, string>>()
  const destRequiredFieldsByObj = new Map<string, string[]>()
  for (const obj of destSnapshot.objects) {
    destFieldsByObj.set(obj.apiName, new Set(obj.fields.map((f) => f.apiName)))
    destFieldTypesByObj.set(obj.apiName, new Map(obj.fields.map((f) => [f.apiName, f.dataType])))
    destRequiredFieldsByObj.set(obj.apiName, obj.fields.filter((f) => f.isRequired && !f.isReadOnly).map((f) => f.apiName))
  }

  // Load all mappings for the plan
  const objectMappings = await prisma.objectMapping.findMany({
    where: { planId },
    include: {
      fieldMappings: true,
      filters: true,
    },
  })

  console.log(`[Integrity] Checking ${objectMappings.length} object mappings for plan ${planId}`)

  // Collect new issues detected in this run
  const detectedIssueKeys = new Set<string>() // "entityType:entityId:issueType"

  type RawIssue = {
    entityType: 'OBJECT_MAPPING' | 'FIELD_MAPPING' | 'MIGRATION_LOGIC' | 'MIGRATION_FILTER'
    entityId: string
    issueType: 'UNMAPPED_REQUIRED_FIELD' | 'INCOMPATIBLE_TYPE' | 'MISSING_LOGIC' | 'INVALID_FILTER' | 'BROKEN_REFERENCE' | 'MISSING_EQUIVALENCE'
    severity: string
    message: string
  }

  const newIssues: RawIssue[] = []

  for (const om of objectMappings) {
    const srcObjExists = sourceObjectNames.has(om.sourceObjectName)
    const dstObjExists = destObjectNames.has(om.destinationObjectName)

    if (!srcObjExists) {
      newIssues.push({
        entityType: 'OBJECT_MAPPING',
        entityId: om.id,
        issueType: 'BROKEN_REFERENCE',
        severity: 'ERROR',
        message: `Source object "${om.sourceObjectName}" no longer exists in the current schema`,
      })
      detectedIssueKeys.add(`OBJECT_MAPPING:${om.id}:BROKEN_REFERENCE`)
      // Skip field-level checks for this mapping — object is gone
      continue
    }
    if (!dstObjExists) {
      newIssues.push({
        entityType: 'OBJECT_MAPPING',
        entityId: om.id,
        issueType: 'BROKEN_REFERENCE',
        severity: 'ERROR',
        message: `Destination object "${om.destinationObjectName}" no longer exists in the current schema`,
      })
      detectedIssueKeys.add(`OBJECT_MAPPING:${om.id}:BROKEN_REFERENCE`)
      continue
    }

    // UNMAPPED_REQUIRED_FIELD: required dest fields with no mapping
    const requiredDestFields = destRequiredFieldsByObj.get(om.destinationObjectName) ?? []
    const mappedDestFields = new Set(om.fieldMappings.map((fm) => fm.destinationFieldName))
    for (const reqField of requiredDestFields) {
      if (!mappedDestFields.has(reqField)) {
        newIssues.push({
          entityType: 'OBJECT_MAPPING',
          entityId: om.id,
          issueType: 'UNMAPPED_REQUIRED_FIELD',
          severity: 'WARNING',
          message: `Required destination field "${reqField}" on "${om.destinationObjectName}" is not mapped`,
        })
        detectedIssueKeys.add(`OBJECT_MAPPING:${om.id}:UNMAPPED_REQUIRED_FIELD`)
      }
    }

    const srcFields = sourceFieldsByObj.get(om.sourceObjectName) ?? new Set<string>()
    const dstFields = destFieldsByObj.get(om.destinationObjectName) ?? new Set<string>()
    const srcFieldTypes = sourceFieldTypesByObj.get(om.sourceObjectName) ?? new Map<string, string>()
    const dstFieldTypes = destFieldTypesByObj.get(om.destinationObjectName) ?? new Map<string, string>()

    // Field mapping checks
    for (const fm of om.fieldMappings) {
      const srcExists = srcFields.has(fm.sourceFieldName)
      const dstExists = dstFields.has(fm.destinationFieldName)

      if (!srcExists) {
        newIssues.push({
          entityType: 'FIELD_MAPPING',
          entityId: fm.id,
          issueType: 'BROKEN_REFERENCE',
          severity: 'ERROR',
          message: `Source field "${fm.sourceFieldName}" no longer exists on "${om.sourceObjectName}"`,
        })
        detectedIssueKeys.add(`FIELD_MAPPING:${fm.id}:BROKEN_REFERENCE`)
      }
      if (!dstExists) {
        newIssues.push({
          entityType: 'FIELD_MAPPING',
          entityId: fm.id,
          issueType: 'BROKEN_REFERENCE',
          severity: 'ERROR',
          message: `Destination field "${fm.destinationFieldName}" no longer exists on "${om.destinationObjectName}"`,
        })
        detectedIssueKeys.add(`FIELD_MAPPING:${fm.id}:BROKEN_REFERENCE`)
      }

      // Type incompatibility (using live types from current snapshot)
      if (srcExists && dstExists) {
        const currentSrcType = srcFieldTypes.get(fm.sourceFieldName) ?? fm.sourceFieldType
        const currentDstType = dstFieldTypes.get(fm.destinationFieldName) ?? fm.destinationFieldType
        const compat = checkTypeCompatibility(currentSrcType, currentDstType)
        if (compat === 'INCOMPATIBLE') {
          newIssues.push({
            entityType: 'FIELD_MAPPING',
            entityId: fm.id,
            issueType: 'INCOMPATIBLE_TYPE',
            severity: 'ERROR',
            message: `Incompatible types: "${fm.sourceFieldName}" (${currentSrcType}) → "${fm.destinationFieldName}" (${currentDstType})`,
          })
          detectedIssueKeys.add(`FIELD_MAPPING:${fm.id}:INCOMPATIBLE_TYPE`)
        }
      }
    }

    // Filter checks: filter references a source field no longer in snapshot
    for (const filter of om.filters) {
      if (!srcFields.has(filter.fieldApiName)) {
        newIssues.push({
          entityType: 'MIGRATION_FILTER',
          entityId: filter.id,
          issueType: 'INVALID_FILTER',
          severity: 'ERROR',
          message: `Filter on "${om.sourceObjectName}" references missing source field "${filter.fieldApiName}"`,
        })
        detectedIssueKeys.add(`MIGRATION_FILTER:${filter.id}:INVALID_FILTER`)
      }
    }
  }

  console.log(`[Integrity] Found ${newIssues.length} issues for plan ${planId}`)

  // Upsert all detected issues (idempotent)
  for (const issue of newIssues) {
    await prisma.integrityIssue.upsert({
      where: {
        planId_entityType_entityId_issueType: {
          planId,
          entityType: issue.entityType,
          entityId: issue.entityId,
          issueType: issue.issueType,
        },
      },
      create: { planId, ...issue, resolved: false, resolvedAt: null },
      update: { resolved: false, resolvedAt: null, message: issue.message, severity: issue.severity },
    })
  }

  // Auto-resolve stale issues (were detected before but no longer apply)
  const existingUnresolved = await prisma.integrityIssue.findMany({
    where: { planId, resolved: false },
    select: { id: true, entityType: true, entityId: true, issueType: true },
  })

  const staleIds: string[] = []
  for (const existing of existingUnresolved) {
    const key = `${existing.entityType}:${existing.entityId}:${existing.issueType}`
    if (!detectedIssueKeys.has(key)) {
      staleIds.push(existing.id)
    }
  }

  if (staleIds.length > 0) {
    await prisma.integrityIssue.updateMany({
      where: { id: { in: staleIds } },
      data: { resolved: true, resolvedAt: new Date() },
    })
    console.log(`[Integrity] Auto-resolved ${staleIds.length} stale issues for plan ${planId}`)
  }

  // Recount unresolved issues
  const unresolvedCount = await prisma.integrityIssue.count({ where: { planId, resolved: false } })
  const totalCount = await prisma.integrityIssue.count({ where: { planId } })

  // Update plan status
  let newStatus: 'DRAFT' | 'READY' | 'BROKEN'
  if (unresolvedCount > 0) {
    newStatus = 'BROKEN'
  } else if (plan.currentStep === 'DOCUMENTS') {
    // Preserve READY if plan is at documents step and no issues
    newStatus = plan.status === 'READY' ? 'READY' : 'DRAFT'
  } else {
    newStatus = 'DRAFT'
  }

  await prisma.migrationPlan.update({ where: { id: planId }, data: { status: newStatus } })

  console.log(`[Integrity] Plan ${planId} status: ${newStatus} (${unresolvedCount} unresolved issues)`)

  await logAuditEvent({
    planId,
    action: 'RUN_INTEGRITY_CHECK',
    entity: 'IntegrityIssue',
    details: { issuesFound: newIssues.length, issuesAutoResolved: staleIds.length, unresolvedCount, planStatus: newStatus },
  })

  // Return all unresolved issues as DTOs
  const unresolvedIssues = await prisma.integrityIssue.findMany({
    where: { planId, resolved: false },
    orderBy: { createdAt: 'desc' },
  })

  return {
    planId,
    planStatus: newStatus,
    checkedAt,
    totalIssues: totalCount,
    unresolvedIssues: unresolvedCount,
    issues: unresolvedIssues.map(toDTO),
  }
}

// ─── checkAndUpdatePlanStatus ──────────────────────────────────────────────────
/**
 * Lightweight status update: re-runs checkIntegrity and updates plan.status.
 * Called after every CRUD on ObjectMapping or FieldMapping (cluster 2 trigger).
 *
 * FR-009, FR-010.
 */
export async function checkAndUpdatePlanStatus(planId: string): Promise<void> {
  try {
    await checkIntegrity(planId)
  } catch (err) {
    // Non-fatal: log and continue — mapping CRUD should not fail because of integrity
    console.error(`[Integrity] checkAndUpdatePlanStatus failed for plan ${planId}:`, err)
  }
}

// ─── repairBrokenMappings ──────────────────────────────────────────────────────
/**
 * Delete all mappings flagged BROKEN_REFERENCE on explicit user request.
 * Principle IX: NEVER called automatically.
 *
 * - Deletes ObjectMappings with BROKEN_REFERENCE (cascades their FieldMappings)
 * - Deletes FieldMappings with BROKEN_REFERENCE not already deleted by the above
 * - Then re-runs integrity check to update plan status
 */
export async function repairBrokenMappings(planId: string): Promise<RepairResult> {
  // Find all current BROKEN_REFERENCE issues
  const brokenObjectIssues = await prisma.integrityIssue.findMany({
    where: { planId, resolved: false, entityType: 'OBJECT_MAPPING', issueType: 'BROKEN_REFERENCE' },
    select: { entityId: true },
  })
  const brokenFieldIssues = await prisma.integrityIssue.findMany({
    where: { planId, resolved: false, entityType: 'FIELD_MAPPING', issueType: 'BROKEN_REFERENCE' },
    select: { entityId: true },
  })

  const brokenObjectIds = brokenObjectIssues.map((i) => i.entityId)
  const brokenFieldIds = brokenFieldIssues.map((i) => i.entityId)

  let deletedObjectMappings = 0
  let deletedFieldMappings = 0

  // Delete broken object mappings (cascade deletes their field mappings)
  if (brokenObjectIds.length > 0) {
    const result = await prisma.objectMapping.deleteMany({
      where: { id: { in: brokenObjectIds }, planId },
    })
    deletedObjectMappings = result.count
  }

  // Delete remaining broken field mappings (not already deleted by cascade)
  if (brokenFieldIds.length > 0) {
    const stillExisting = await prisma.fieldMapping.findMany({
      where: { id: { in: brokenFieldIds } },
      select: { id: true },
    })
    if (stillExisting.length > 0) {
      const result = await prisma.fieldMapping.deleteMany({
        where: { id: { in: stillExisting.map((f) => f.id) } },
      })
      deletedFieldMappings = result.count
    }
  }

  await logAuditEvent({
    planId,
    action: 'REPAIR_BROKEN_MAPPINGS',
    entity: 'ObjectMapping',
    details: { deletedObjectMappings, deletedFieldMappings },
  })

  // Re-run integrity check to update plan status
  const result = await checkIntegrity(planId)

  return {
    deletedObjectMappings,
    deletedFieldMappings,
    planStatus: result.planStatus,
  }
}

// ─── getUnresolvedIssues ───────────────────────────────────────────────────────
/**
 * Returns all unresolved integrity issues for a plan without re-running the check.
 * FR-007 read-path.
 */
export async function getUnresolvedIssues(planId: string): Promise<IntegrityIssueDTO[]> {
  const issues = await prisma.integrityIssue.findMany({
    where: { planId, resolved: false },
    orderBy: { createdAt: 'desc' },
  })
  return issues.map(toDTO)
}

// ─── getIssuesForEntity ────────────────────────────────────────────────────────
/**
 * Returns unresolved issues for a specific entity (field mapping, object mapping, etc.)
 * Used by per-mapping broken badges in UI.
 */
export async function getIssuesForEntity(entityId: string): Promise<IntegrityIssueDTO[]> {
  const issues = await prisma.integrityIssue.findMany({
    where: { entityId, resolved: false },
    orderBy: { createdAt: 'desc' },
  })
  return issues.map(toDTO)
}

// ─── resolveIssue ─────────────────────────────────────────────────────────────
/**
 * Manually resolve a single issue (consultant action).
 * Returns 409-class error if already resolved.
 */
export async function resolveIssue(
  planId: string,
  issueId: string,
): Promise<{ issue: IntegrityIssueDTO; planStatus: 'DRAFT' | 'READY' | 'BROKEN' }> {
  const issue = await prisma.integrityIssue.findUnique({ where: { id: issueId } })
  if (!issue) throw new IssueNotFoundError(issueId)
  if (issue.resolved) throw new IssueAlreadyResolvedError(issueId)

  const updated = await prisma.integrityIssue.update({
    where: { id: issueId },
    data: { resolved: true, resolvedAt: new Date() },
  })

  // Recount and update plan status
  const remaining = await prisma.integrityIssue.count({ where: { planId, resolved: false } })
  const plan = await prisma.migrationPlan.findUnique({
    where: { id: planId },
    select: { status: true, currentStep: true },
  })

  let newStatus: 'DRAFT' | 'READY' | 'BROKEN'
  if (remaining > 0) {
    newStatus = 'BROKEN'
  } else if (plan?.currentStep === 'DOCUMENTS' && plan.status === 'READY') {
    newStatus = 'READY'
  } else {
    newStatus = 'DRAFT'
  }

  await prisma.migrationPlan.update({ where: { id: planId }, data: { status: newStatus } })

  await logAuditEvent({
    planId,
    action: 'RESOLVE_INTEGRITY_ISSUE',
    entity: 'IntegrityIssue',
    entityId: issueId,
    details: { remainingUnresolved: remaining, planStatus: newStatus },
  })

  return { issue: toDTO(updated), planStatus: newStatus }
}

// ─── resolveAllForPlan ─────────────────────────────────────────────────────────
/**
 * Bulk-resolve all unresolved issues for a plan (consultant "mark all resolved").
 * Transitions plan status to DRAFT.
 */
export async function resolveAllForPlan(
  planId: string,
): Promise<{ resolvedCount: number; planStatus: 'DRAFT' | 'READY' | 'BROKEN' }> {
  const { count } = await prisma.integrityIssue.updateMany({
    where: { planId, resolved: false },
    data: { resolved: true, resolvedAt: new Date() },
  })

  const plan = await prisma.migrationPlan.findUnique({
    where: { id: planId },
    select: { status: true, currentStep: true },
  })

  const newStatus: 'DRAFT' | 'READY' | 'BROKEN' =
    plan?.currentStep === 'DOCUMENTS' && plan.status === 'READY' ? 'READY' : 'DRAFT'

  await prisma.migrationPlan.update({ where: { id: planId }, data: { status: newStatus } })

  await logAuditEvent({
    planId,
    action: 'RESOLVE_ALL_INTEGRITY_ISSUES',
    entity: 'IntegrityIssue',
    details: { resolvedCount: count, planStatus: newStatus },
  })

  return { resolvedCount: count, planStatus: newStatus }
}

// ─── Errors ────────────────────────────────────────────────────────────────────

export class IssueNotFoundError extends Error {
  constructor(issueId: string) {
    super(`IntegrityIssue not found: ${issueId}`)
    this.name = 'IssueNotFoundError'
  }
}

export class IssueAlreadyResolvedError extends Error {
  constructor(issueId: string) {
    super(`IntegrityIssue already resolved: ${issueId}`)
    this.name = 'IssueAlreadyResolvedError'
  }
}

// ─── toDTO helper ─────────────────────────────────────────────────────────────

function toDTO(issue: {
  id: string
  planId: string
  entityType: string
  entityId: string
  issueType: string
  severity: string
  message: string
  resolved: boolean
  resolvedAt: Date | null
  createdAt: Date
}): IntegrityIssueDTO {
  return {
    id: issue.id,
    entityType: issue.entityType as IntegrityIssueDTO['entityType'],
    entityId: issue.entityId,
    issueType: issue.issueType as IntegrityIssueDTO['issueType'],
    severity: issue.severity,
    message: issue.message,
    resolved: issue.resolved,
    resolvedAt: issue.resolvedAt?.toISOString() ?? null,
    detectedAt: issue.createdAt.toISOString(),
  }
}
