// 005-source-field-retrieval — GET /source/fields/[objectId]
// Returns all persisted fields for a single object (lazy per-object load, Cluster 15).

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ planId: string; objectId: string }> },
) {
  const { objectId } = await params

  const obj = await prisma.schemaObject.findUnique({
    where: { id: objectId },
    include: {
      fields: {
        orderBy: { apiName: 'asc' },
      },
    },
  })

  if (!obj) {
    return NextResponse.json(
      { error: 'OBJECT_NOT_FOUND', message: `Object not found: ${objectId}` },
      { status: 404 },
    )
  }

  return NextResponse.json({
    objectId: obj.id,
    objectApiName: obj.apiName,
    objectLabel: obj.label,
    fields: obj.fields,
    fieldCount: obj.fields.length,
  })
}
