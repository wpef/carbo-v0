import { prisma } from '@/lib/prisma'
import { logAuditEvent } from '@/lib/audit'
import type { FilterOperator } from '@prisma/client'

export async function listFilters(objectMappingId: string) {
  return prisma.migrationFilter.findMany({
    where: { objectMappingId },
    orderBy: { fieldApiName: 'asc' },
  })
}

export async function createFilter(
  planId: string,
  objectMappingId: string,
  fieldApiName: string,
  operator: FilterOperator,
  value?: string,
) {
  const filter = await prisma.migrationFilter.create({
    data: { objectMappingId, fieldApiName, operator, value },
  })

  await logAuditEvent({
    planId,
    action: 'CREATE_FILTER',
    entity: 'MigrationFilter',
    entityId: filter.id,
    details: { fieldApiName, operator, value },
  })

  return filter
}

export async function deleteFilter(planId: string, filterId: string) {
  await prisma.migrationFilter.delete({ where: { id: filterId } })

  await logAuditEvent({
    planId,
    action: 'DELETE_FILTER',
    entity: 'MigrationFilter',
    entityId: filterId,
  })
}
