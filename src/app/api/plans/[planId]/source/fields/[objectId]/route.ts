// 005-source-field-retrieval — GET fields for a single object

import { NextRequest, NextResponse } from 'next/server'
import {
  getFieldsForObject,
  FieldRetrievalObjectNotFoundError,
} from '@/lib/services/field-retrieval'

// GET /api/plans/[planId]/source/fields/[objectId]
// Return all fields for a single object.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ planId: string; objectId: string }> },
) {
  const { objectId } = await params

  try {
    const fields = await getFieldsForObject(objectId)
    return NextResponse.json({ objectId, fields, fieldCount: fields.length })
  } catch (err) {
    if (err instanceof FieldRetrievalObjectNotFoundError) {
      return NextResponse.json({ error: 'OBJECT_NOT_FOUND', message: err.message }, { status: 404 })
    }
    console.error('[GET /source/fields/[objectId]]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error.' }, { status: 500 })
  }
}
