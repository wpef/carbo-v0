// 017-mapping-integrity-check — Service for checking and repairing mapping integrity

import { prisma } from '@/lib/db/prisma'
import { logAction } from './audit-service'
import { checkTypeCompatibility } from './type-compatibility'
import type { IntegrityReport, BrokenObjectMapping, BrokenFieldMapping, TypeChange, RepairResult } from '@/lib/types/integrity'

/**
 * Check integrity of all mappings in a plan against current schema snapshots.
 *
 * Detects:
 * - Broken object mappings: source or dest object no longer exists in the current snapshot.
 * - Broken field mappings: source or dest field no longer exists in the current snapshot.
 * - Type changes: field type changed since the mapping was created (now incompatible).
 *
 * Does NOT modify any data — pure read + report.
 */
export async function checkMappingIntegrity(planId: string): Promise<IntegrityReport> {
  const checkedAt = new Date().toISOString()

  // Load connections to find current snapshots
  const [sourceConn, destConn] = await Promise.all([
    prisma.sourceConnection.findUnique({ where: { planId } }),
    prisma.destinationConnection.findUnique({ where: { planId } }),
  ])

  // Without connections / snapshots, nothing to check — report healthy
  if (!sourceConn || !destConn) {
    return { brokenObjectMappings: [], brokenFieldMappings: [], typeChanges: [], isHealthy: true, checkedAt }
  }

  // Fetch current snapshots
  const [sourceSnapshot, destSnapshot] = await Promise.all([
    prisma.schemaSnapshot.findFirst({
      where: { connectionId: sourceConn.id, role: 'source', status: 'CURRENT' },
      include: { objects: { include: { fields: true } } },
    }),
    prisma.schemaSnapshot.findFirst({
      where: { connectionId: destConn.id, role: 'destination', status: 'CURRENT' },
      include: { objects: { include: { fields: true } } },
    }),
  ])

  if (!sourceSnapshot || !destSnapshot) {
    return { brokenObjectMappings: [], brokenFieldMappings: [], typeChanges: [], isHealthy: true, checkedAt }
  }

  // Build fast lookup maps: apiName → object, then objectApiName+fieldApiName → field
  const sourceObjectsByApiName = new Map(sourceSnapshot.objects.map((o) => [o.apiName, o]))
  const destObjectsByApiName = new Map(destSnapshot.objects.map((o) => [o.apiName, o]))

  // Field lookup: `${objectApiName}.${fieldApiName}` → field
  const sourceFieldMap = new Map<string, { dataType: string }>()
  for (const obj of sourceSnapshot.objects) {
    for (const f of obj.fields) {
      sourceFieldMap.set(`${obj.apiName}.${f.apiName}`, { dataType: f.dataType })
    }
  }
  const destFieldMap = new Map<string, { dataType: string }>()
  for (const obj of destSnapshot.objects) {
    for (const f of obj.fields) {
      destFieldMap.set(`${obj.apiName}.${f.apiName}`, { dataType: f.dataType })
    }
  }

  // Load all object mappings + their field mappings
  const objectMappings = await prisma.objectMapping.findMany({
    where: { planId },
    include: { fieldMappings: true },
  })

  const brokenObjectMappings: BrokenObjectMapping[] = []
  const brokenFieldMappings: BrokenFieldMapping[] = []
  const typeChanges: TypeChange[] = []

  for (const om of objectMappings) {
    // Check if source/dest objects exist in current snapshot
    const sourceObjExists = sourceObjectsByApiName.has(om.sourceObjectApiName)
    const destObjExists = destObjectsByApiName.has(om.destObjectApiName)

    if (!sourceObjExists) {
      brokenObjectMappings.push({
        mappingId: om.id,
        sourceObjectApiName: om.sourceObjectApiName,
        destObjectApiName: om.destObjectApiName,
        reason: `Source object "${om.sourceObjectApiName}" no longer exists in the current schema.`,
      })
      // If the object mapping is broken, field mappings under it are implicitly broken too
      // We still report them individually for completeness
    }

    if (!destObjExists) {
      // Avoid duplicate if already reported as source broken
      const alreadyReported = brokenObjectMappings.some((b) => b.mappingId === om.id)
      if (!alreadyReported) {
        brokenObjectMappings.push({
          mappingId: om.id,
          sourceObjectApiName: om.sourceObjectApiName,
          destObjectApiName: om.destObjectApiName,
          reason: `Destination object "${om.destObjectApiName}" no longer exists in the current schema.`,
        })
      }
    }

    // Check field mappings
    for (const fm of om.fieldMappings) {
      const sourceKey = `${om.sourceObjectApiName}.${fm.sourceFieldApiName}`
      const destKey = `${om.destObjectApiName}.${fm.destFieldApiName}`

      const sourceField = sourceFieldMap.get(sourceKey)
      const destField = destFieldMap.get(destKey)

      let fieldBroken = false

      if (!sourceField) {
        brokenFieldMappings.push({
          mappingId: om.id,
          fieldMappingId: fm.id,
          reason: `Source field "${fm.sourceFieldApiName}" no longer exists on "${om.sourceObjectApiName}".`,
        })
        fieldBroken = true
      }

      if (!destField) {
        brokenFieldMappings.push({
          mappingId: om.id,
          fieldMappingId: fm.id,
          reason: `Destination field "${fm.destFieldApiName}" no longer exists on "${om.destObjectApiName}".`,
        })
        fieldBroken = true
      }

      // Type change detection: compare current compatibility with stored
      if (!fieldBroken && sourceField && destField) {
        const currentCompatibility = checkTypeCompatibility(sourceField.dataType, destField.dataType)
        if (currentCompatibility !== fm.typeCompatibility) {
          // Only report as type change if it became incompatible (degradation)
          if (currentCompatibility === 'INCOMPATIBLE' && fm.typeCompatibility !== 'INCOMPATIBLE') {
            typeChanges.push({
              fieldMappingId: fm.id,
              field: `${om.sourceObjectApiName}.${fm.sourceFieldApiName} → ${om.destObjectApiName}.${fm.destFieldApiName}`,
              oldType: `${fm.typeCompatibility} (stored)`,
              newType: `${currentCompatibility} (current: ${sourceField.dataType} → ${destField.dataType})`,
            })
          }
        }
      }
    }
  }

  const isHealthy =
    brokenObjectMappings.length === 0 && brokenFieldMappings.length === 0 && typeChanges.length === 0

  return { brokenObjectMappings, brokenFieldMappings, typeChanges, isHealthy, checkedAt }
}

/**
 * Run the integrity check AND update the plan status accordingly (T004 + T006).
 *
 * Called automatically after every schema refresh (003 FR-011, 007 FR-005) and
 * after every mapping CRUD operation so that plan.status reflects reality.
 *
 * NO automatic remediation (Constitution Principle IX): the check only inspects
 * and marks the plan as BROKEN if any mapping is broken. The consultant resolves
 * by deleting/recreating mappings via the UI.
 *
 * Returns the same IntegrityReport as checkMappingIntegrity.
 */
export async function checkAndUpdatePlanStatus(planId: string): Promise<IntegrityReport> {
  const report = await checkMappingIntegrity(planId)

  // Plan status update: BROKEN if any issue, DRAFT otherwise.
  // We don't transition to READY here — that's a higher-level decision (all
  // mappings complete + documents generated + etc.), not the integrity check's
  // responsibility.
  const newStatus = report.isHealthy ? 'DRAFT' : 'BROKEN'

  await prisma.migrationPlan.update({
    where: { id: planId },
    data: { status: newStatus },
  })

  await logAction(planId, 'MAPPING_INTEGRITY_CHECKED', {
    isHealthy: report.isHealthy,
    brokenObjectMappings: report.brokenObjectMappings.length,
    brokenFieldMappings: report.brokenFieldMappings.length,
    typeChanges: report.typeChanges.length,
    planStatus: newStatus,
  })

  return report
}

/**
 * Repair broken mappings: delete broken object/field mappings.
 * - Sets plan status to BROKEN if issues are found but not all repaired.
 * - Sets plan status to DRAFT after a successful repair.
 * - Logs all operations to audit trail.
 */
export async function repairBrokenMappings(planId: string): Promise<RepairResult> {
  // Run integrity check first to identify what to delete
  const report = await checkMappingIntegrity(planId)

  let deletedObjectMappings = 0
  let deletedFieldMappings = 0

  if (!report.isHealthy) {
    // Collect IDs to delete
    const brokenObjectMappingIds = new Set(report.brokenObjectMappings.map((b) => b.mappingId))
    const brokenFieldMappingIds = new Set(report.brokenFieldMappings.map((b) => b.fieldMappingId))

    // Delete broken field mappings first (no cascade issue since we delete their parents next)
    if (brokenFieldMappingIds.size > 0) {
      const result = await prisma.fieldMapping.deleteMany({
        where: { id: { in: [...brokenFieldMappingIds] } },
      })
      deletedFieldMappings = result.count
    }

    // Delete broken object mappings (cascades to their field mappings)
    if (brokenObjectMappingIds.size > 0) {
      const result = await prisma.objectMapping.deleteMany({
        where: { id: { in: [...brokenObjectMappingIds] }, planId },
      })
      deletedObjectMappings = result.count
    }

    // After repair, re-check if any issues remain
    const postRepairReport = await checkMappingIntegrity(planId)
    const planStatus = postRepairReport.isHealthy ? 'DRAFT' : 'BROKEN'

    await prisma.migrationPlan.update({
      where: { id: planId },
      data: { status: planStatus },
    })

    await logAction(planId, 'MAPPING_INTEGRITY_REPAIRED', {
      deletedObjectMappings,
      deletedFieldMappings,
      planStatus,
      brokenObjectMappings: report.brokenObjectMappings.length,
      brokenFieldMappings: report.brokenFieldMappings.length,
    })

    return { deletedObjectMappings, deletedFieldMappings, planStatus }
  }

  // Nothing broken — ensure plan status is not stuck as BROKEN
  await prisma.migrationPlan.update({
    where: { id: planId },
    data: { status: 'DRAFT' },
  })

  return { deletedObjectMappings: 0, deletedFieldMappings: 0, planStatus: 'DRAFT' }
}
