// 016-unmapped-fields-detection — GET unmapped fields for a single object mapping

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { PlanNotFoundError } from '@/lib/services/plan-service'
import { ObjectMappingNotFoundError } from '@/lib/services/object-mapping'
import type { UnmappedFieldInfo } from '@/lib/types/unmapped-fields'

type RouteParams = { params: Promise<{ planId: string; mappingId: string }> }

// GET /api/plans/[planId]/object-mappings/[mappingId]/unmapped
// Returns unmapped source fields and unmapped required dest fields for a single object mapping.
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { planId, mappingId } = await params

  try {
    const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
    if (!plan) throw new PlanNotFoundError(planId)

    const objectMapping = await prisma.objectMapping.findUnique({ where: { id: mappingId } })
    if (!objectMapping || objectMapping.planId !== planId) throw new ObjectMappingNotFoundError(mappingId)

    // Load source and dest fields
    const [sourceFields, destFields, fieldMappings] = await Promise.all([
      prisma.objectField.findMany({ where: { objectId: objectMapping.sourceObjectId } }),
      prisma.objectField.findMany({ where: { objectId: objectMapping.destObjectId } }),
      prisma.fieldMapping.findMany({
        where: { objectMappingId: mappingId },
        select: { sourceFieldApiName: true, destFieldApiName: true },
      }),
    ])

    const mappedSourceApiNames = new Set(fieldMappings.map((fm) => fm.sourceFieldApiName))
    const mappedDestApiNames = new Set(fieldMappings.map((fm) => fm.destFieldApiName))

    const unmappedSourceFields: UnmappedFieldInfo[] = sourceFields
      .filter((f) => !mappedSourceApiNames.has(f.apiName))
      .map((f) => ({
        apiName: f.apiName,
        label: f.label,
        dataType: f.dataType,
        isRequired: f.isRequired,
      }))

    // Only required dest fields that are unmapped (Principle III: data fidelity)
    const unmappedDestFields: UnmappedFieldInfo[] = destFields
      .filter((f) => f.isRequired && !mappedDestApiNames.has(f.apiName))
      .map((f) => ({
        apiName: f.apiName,
        label: f.label,
        dataType: f.dataType,
        isRequired: f.isRequired,
      }))

    const summary = {
      totalUnmappedSource: unmappedSourceFields.length,
      totalUnmappedDest: unmappedDestFields.length,
      totalRequiredUnmapped: unmappedSourceFields.filter((f) => f.isRequired).length,
      totalSourceFields: sourceFields.length,
      totalDestFields: destFields.length,
      mappedCount: fieldMappings.length,
    }

    return NextResponse.json({
      objectMappingId: mappingId,
      sourceObjectApiName: objectMapping.sourceObjectApiName,
      destObjectApiName: objectMapping.destObjectApiName,
      unmappedSourceFields,
      unmappedDestFields,
      summary,
    })
  } catch (err) {
    if (err instanceof PlanNotFoundError) {
      return NextResponse.json({ error: 'PLAN_NOT_FOUND', message: err.message }, { status: 404 })
    }
    if (err instanceof ObjectMappingNotFoundError) {
      return NextResponse.json({ error: 'MAPPING_NOT_FOUND', message: err.message }, { status: 404 })
    }
    console.error('[GET /object-mappings/[mappingId]/unmapped]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error.' }, { status: 500 })
  }
}
