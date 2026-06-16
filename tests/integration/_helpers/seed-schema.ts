// Shared integration-test seed helper. Creates a CURRENT schema snapshot with its
// objects and fields, setting the (required, denormalised) snapshotId on every field
// — which a single nested `schemaSnapshot.create` cannot do (snapshotId is a separate
// relation from objectId).
import { prisma } from '@/lib/prisma'

export interface SeedField {
  apiName: string
  label: string
  dataType: string
  isRequired?: boolean
  isReadOnly?: boolean
  isUnique?: boolean
  isAccessible?: boolean
  referenceTo?: string
  picklistValues?: string | null
}

export interface SeedObject {
  apiName: string
  label: string
  description?: string
  isCustom?: boolean
  fields?: SeedField[]
}

export async function seedSnapshot(
  connectionId: string,
  side: 'SOURCE' | 'DESTINATION',
  objects: SeedObject[],
) {
  const snapshot = await prisma.schemaSnapshot.create({
    data: { connectionId, side, status: 'CURRENT' },
  })
  for (const o of objects) {
    await prisma.schemaObject.create({
      data: {
        snapshotId: snapshot.id,
        apiName: o.apiName,
        label: o.label,
        description: o.description,
        isCustom: o.isCustom ?? false,
        fields: { create: (o.fields ?? []).map((f) => ({ ...f, snapshotId: snapshot.id })) },
      },
    })
  }
  return prisma.schemaSnapshot.findUniqueOrThrow({
    where: { id: snapshot.id },
    include: { objects: { include: { fields: true } } },
  })
}
