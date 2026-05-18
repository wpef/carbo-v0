import { prisma } from '@/lib/prisma'
import { logAuditEvent } from '@/lib/audit'
import { getAdapter } from '@/lib/adapters/registry'

export async function retrieveFieldsForObjects(
  planId: string,
  connectionId: string,
  adapterType: string,
  snapshotId: string,
  objectApiNames: string[],
) {
  const adapter = getAdapter(adapterType)
  console.log(`[Fields] Retrieving fields for ${objectApiNames.length} objects`)

  const results: { objectApiName: string; fieldCount: number; error?: string }[] = []

  const CONCURRENCY = 5
  for (let i = 0; i < objectApiNames.length; i += CONCURRENCY) {
    const batch = objectApiNames.slice(i, i + CONCURRENCY)
    const batchResults = await Promise.allSettled(
      batch.map(async (objectApiName) => {
        const fields = await adapter.getFields(connectionId, objectApiName)

        const schemaObject = await prisma.schemaObject.findUnique({
          where: { snapshotId_apiName: { snapshotId, apiName: objectApiName } },
        })
        if (!schemaObject) throw new Error(`Object ${objectApiName} not found in snapshot`)

        await prisma.objectField.deleteMany({
          where: { objectId: schemaObject.id },
        })

        await prisma.objectField.createMany({
          data: fields.map((f) => ({
            objectId: schemaObject.id,
            snapshotId,
            apiName: f.apiName,
            label: f.label,
            dataType: f.dataType,
            isRequired: f.isRequired,
            isReadOnly: f.isReadOnly,
            isUnique: f.isUnique,
            referenceTo: f.referenceTo,
            relationshipType: f.relationshipType,
          })),
        })

        return { objectApiName, fieldCount: fields.length }
      }),
    )

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value)
      } else {
        const msg = result.reason instanceof Error ? result.reason.message : 'Unknown error'
        results.push({ objectApiName: batch[batchResults.indexOf(result)], fieldCount: 0, error: msg })
      }
    }
  }

  const totalFields = results.reduce((sum, r) => sum + r.fieldCount, 0)
  await logAuditEvent({
    planId,
    action: 'RETRIEVE_FIELDS',
    entity: 'ObjectField',
    details: {
      objectCount: objectApiNames.length,
      totalFields,
      errors: results.filter((r) => r.error).length,
    },
  })

  console.log(`[Fields] Retrieved ${totalFields} fields across ${objectApiNames.length} objects`)
  return results
}

export async function getFieldsByObject(snapshotId: string, objectApiName?: string) {
  const where: { snapshotId: string; object?: { apiName: string } } = { snapshotId }
  if (objectApiName) {
    where.object = { apiName: objectApiName }
  }

  const fields = await prisma.objectField.findMany({
    where,
    include: { object: { select: { apiName: true, label: true } } },
    orderBy: [{ object: { apiName: 'asc' } }, { apiName: 'asc' }],
  })

  const grouped = new Map<string, typeof fields>()
  for (const field of fields) {
    const key = field.object.apiName
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(field)
  }

  return Object.fromEntries(grouped)
}
