import { prisma } from '@/lib/prisma'
import { logAuditEvent } from '@/lib/audit'
import type { LogicStatus } from '@prisma/client'

export async function getMigrationLogic(fieldMappingId: string) {
  return prisma.migrationLogic.findUnique({
    where: { fieldMappingId },
    include: { valueEquivalences: true },
  })
}

export async function saveMigrationLogic(
  planId: string,
  fieldMappingId: string,
  data: {
    status: LogicStatus
    config?: string
    description?: string
    equivalences?: { sourceValue: string; destinationValue: string }[]
  },
) {
  const existing = await prisma.migrationLogic.findUnique({
    where: { fieldMappingId },
  })

  if (existing) {
    await prisma.valueEquivalence.deleteMany({
      where: { migrationLogicId: existing.id },
    })

    const logic = await prisma.migrationLogic.update({
      where: { id: existing.id },
      data: {
        status: data.status,
        config: data.config ?? existing.config,
        description: data.description ?? existing.description,
        valueEquivalences: data.equivalences
          ? { create: data.equivalences }
          : undefined,
      },
      include: { valueEquivalences: true },
    })

    await logAuditEvent({
      planId,
      action: 'UPDATE_MIGRATION_LOGIC',
      entity: 'MigrationLogic',
      entityId: logic.id,
      details: { status: data.status, equivalenceCount: data.equivalences?.length ?? 0 },
    })

    return logic
  }

  const logic = await prisma.migrationLogic.create({
    data: {
      fieldMappingId,
      status: data.status,
      config: data.config ?? '{}',
      description: data.description,
      valueEquivalences: data.equivalences
        ? { create: data.equivalences }
        : undefined,
    },
    include: { valueEquivalences: true },
  })

  await logAuditEvent({
    planId,
    action: 'CREATE_MIGRATION_LOGIC',
    entity: 'MigrationLogic',
    entityId: logic.id,
    details: { status: data.status, equivalenceCount: data.equivalences?.length ?? 0 },
  })

  return logic
}

export async function deleteMigrationLogic(planId: string, fieldMappingId: string) {
  const logic = await prisma.migrationLogic.findUnique({
    where: { fieldMappingId },
  })
  if (!logic) return

  await prisma.migrationLogic.delete({ where: { id: logic.id } })

  await logAuditEvent({
    planId,
    action: 'DELETE_MIGRATION_LOGIC',
    entity: 'MigrationLogic',
    entityId: logic.id,
  })
}
