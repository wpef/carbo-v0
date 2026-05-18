import { prisma } from '@/lib/prisma'
import { logAuditEvent } from '@/lib/audit'

export async function runIntegrityCheck(planId: string) {
  const plan = await prisma.migrationPlan.findUniqueOrThrow({
    where: { id: planId },
    include: {
      sourceConnection: true,
      destinationConnection: true,
      objectMappings: {
        include: {
          fieldMappings: { include: { migrationLogic: { include: { valueEquivalences: true } } } },
          filters: true,
          exclusions: true,
        },
      },
    },
  })

  if (!plan.sourceConnectionId || !plan.destinationConnectionId) {
    return { issues: [], message: 'Connections required' }
  }

  const sourceSnapshot = await prisma.schemaSnapshot.findUnique({
    where: { connectionId_side_status: { connectionId: plan.sourceConnectionId, side: 'SOURCE', status: 'CURRENT' } },
    include: { objects: { include: { fields: true } } },
  })
  const destSnapshot = await prisma.schemaSnapshot.findUnique({
    where: { connectionId_side_status: { connectionId: plan.destinationConnectionId, side: 'DESTINATION', status: 'CURRENT' } },
    include: { objects: { include: { fields: true } } },
  })

  if (!sourceSnapshot || !destSnapshot) {
    return { issues: [], message: 'Schema snapshots required' }
  }

  const sourceObjectNames = new Set(sourceSnapshot.objects.map((o) => o.apiName))
  const destObjectNames = new Set(destSnapshot.objects.map((o) => o.apiName))
  const sourceFieldsByObj = new Map(
    sourceSnapshot.objects.map((o) => [o.apiName, new Set(o.fields.map((f) => f.apiName))]),
  )
  const destFieldsByObj = new Map(
    destSnapshot.objects.map((o) => [o.apiName, new Set(o.fields.map((f) => f.apiName))]),
  )
  const destRequiredFields = new Map(
    destSnapshot.objects.map((o) => [
      o.apiName,
      o.fields.filter((f) => f.isRequired && !f.isReadOnly).map((f) => f.apiName),
    ]),
  )

  const newIssues: {
    entityType: 'OBJECT_MAPPING' | 'FIELD_MAPPING' | 'MIGRATION_LOGIC' | 'MIGRATION_FILTER'
    entityId: string
    issueType: 'UNMAPPED_REQUIRED_FIELD' | 'INCOMPATIBLE_TYPE' | 'MISSING_LOGIC' | 'INVALID_FILTER' | 'BROKEN_REFERENCE' | 'MISSING_EQUIVALENCE'
    severity: string
    message: string
  }[] = []

  for (const mapping of plan.objectMappings) {
    if (!sourceObjectNames.has(mapping.sourceObjectName)) {
      newIssues.push({
        entityType: 'OBJECT_MAPPING',
        entityId: mapping.id,
        issueType: 'BROKEN_REFERENCE',
        severity: 'ERROR',
        message: `Source object "${mapping.sourceObjectName}" no longer exists`,
      })
      continue
    }
    if (!destObjectNames.has(mapping.destinationObjectName)) {
      newIssues.push({
        entityType: 'OBJECT_MAPPING',
        entityId: mapping.id,
        issueType: 'BROKEN_REFERENCE',
        severity: 'ERROR',
        message: `Destination object "${mapping.destinationObjectName}" no longer exists`,
      })
      continue
    }

    const srcFields = sourceFieldsByObj.get(mapping.sourceObjectName) ?? new Set()
    const dstFields = destFieldsByObj.get(mapping.destinationObjectName) ?? new Set()
    const requiredDst = destRequiredFields.get(mapping.destinationObjectName) ?? []
    const mappedDstFields = new Set(mapping.fieldMappings.map((fm) => fm.destinationFieldName))

    for (const reqField of requiredDst) {
      if (!mappedDstFields.has(reqField)) {
        newIssues.push({
          entityType: 'OBJECT_MAPPING',
          entityId: mapping.id,
          issueType: 'UNMAPPED_REQUIRED_FIELD',
          severity: 'WARNING',
          message: `Required destination field "${reqField}" on "${mapping.destinationObjectName}" is not mapped`,
        })
      }
    }

    for (const fm of mapping.fieldMappings) {
      if (!srcFields.has(fm.sourceFieldName)) {
        newIssues.push({
          entityType: 'FIELD_MAPPING',
          entityId: fm.id,
          issueType: 'BROKEN_REFERENCE',
          severity: 'ERROR',
          message: `Source field "${fm.sourceFieldName}" no longer exists`,
        })
      }
      if (!dstFields.has(fm.destinationFieldName)) {
        newIssues.push({
          entityType: 'FIELD_MAPPING',
          entityId: fm.id,
          issueType: 'BROKEN_REFERENCE',
          severity: 'ERROR',
          message: `Destination field "${fm.destinationFieldName}" no longer exists`,
        })
      }
      if (fm.compatibilityStatus === 'INCOMPATIBLE') {
        newIssues.push({
          entityType: 'FIELD_MAPPING',
          entityId: fm.id,
          issueType: 'INCOMPATIBLE_TYPE',
          severity: 'ERROR',
          message: `Incompatible types: "${fm.sourceFieldName}" → "${fm.destinationFieldName}"`,
        })
      }
    }

    for (const filter of mapping.filters) {
      if (!srcFields.has(filter.fieldApiName)) {
        newIssues.push({
          entityType: 'MIGRATION_FILTER',
          entityId: filter.id,
          issueType: 'INVALID_FILTER',
          severity: 'ERROR',
          message: `Filter references missing field "${filter.fieldApiName}"`,
        })
      }
    }
  }

  await prisma.integrityIssue.updateMany({
    where: { planId, resolved: false },
    data: { resolved: true, resolvedAt: new Date() },
  })

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
      create: { planId, ...issue, resolved: false },
      update: { resolved: false, resolvedAt: null, message: issue.message, severity: issue.severity },
    })
  }

  await logAuditEvent({
    planId,
    action: 'RUN_INTEGRITY_CHECK',
    entity: 'IntegrityIssue',
    details: { issuesFound: newIssues.length },
  })

  console.log(`[Integrity] Found ${newIssues.length} issues for plan ${planId}`)

  return {
    issues: newIssues,
    unresolvedCount: newIssues.length,
  }
}

export async function getUnresolvedIssues(planId: string) {
  return prisma.integrityIssue.findMany({
    where: { planId, resolved: false },
    orderBy: { createdAt: 'desc' },
  })
}

export async function resolveIssue(planId: string, issueId: string) {
  await prisma.integrityIssue.update({
    where: { id: issueId },
    data: { resolved: true, resolvedAt: new Date() },
  })

  await logAuditEvent({
    planId,
    action: 'RESOLVE_INTEGRITY_ISSUE',
    entity: 'IntegrityIssue',
    entityId: issueId,
  })
}
