import { prisma } from './prisma'

export async function logAuditEvent(params: {
  planId?: string
  action: string
  entity: string
  entityId?: string
  details?: Record<string, unknown>
}) {
  const { planId, action, entity, entityId, details = {} } = params
  console.log(`[AUDIT] ${action} ${entity}${entityId ? ` (${entityId})` : ''}`, details)
  return prisma.auditLog.create({
    data: {
      planId,
      action,
      entity,
      entityId,
      details: JSON.stringify(details),
    },
  })
}
