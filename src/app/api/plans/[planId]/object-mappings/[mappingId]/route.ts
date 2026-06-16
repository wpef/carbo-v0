// 011-object-mapping — DELETE /api/plans/[planId]/object-mappings/[mappingId]
// Cascade-deletes the mapping and all child data (FieldMappings, Filters, Exclusions).
// Returns deletion summary per contracts/api.md.

import { NextResponse } from 'next/server'
import { deleteObjectMapping } from '@/features/object-mapping/services/object-mapping-service'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ planId: string; mappingId: string }> },
) {
  const { planId, mappingId } = await params

  // Verify the mapping belongs to this plan before deleting
  const mapping = await prisma.objectMapping.findFirst({
    where: { id: mappingId, planId },
    select: { id: true, sourceObjectName: true, destinationObjectName: true },
  })
  if (!mapping) {
    return NextResponse.json({ error: 'Mapping introuvable' }, { status: 404 })
  }

  try {
    const { fieldMappingsCount, filtersCount } = await deleteObjectMapping(planId, mappingId)
    return NextResponse.json({
      deleted: {
        objectMapping: {
          id: mappingId,
          sourceObjectName: mapping.sourceObjectName,
          destinationObjectName: mapping.destinationObjectName,
        },
        fieldMappingsCount,
        migrationFiltersCount: filtersCount,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Suppression échouée'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
