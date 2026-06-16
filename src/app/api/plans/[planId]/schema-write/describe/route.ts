// 022-schema-write — POST /api/plans/[planId]/schema-write/describe
// Generate an LLM field description (FR-005). Returns 503 when LLM is unavailable.

import { NextResponse } from 'next/server'
import { logAuditEvent } from '@/lib/audit'
import { generateDescription, LlmUnavailableError } from '@/features/schema-write/services'

export async function POST(request: Request, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'INVALID_BODY', message: 'Request body must be valid JSON' }, { status: 400 })
  }

  const { objectApiName, objectLabel, fieldName, fieldType, sampleValues, companyContext } = body

  if (!objectApiName || typeof objectApiName !== 'string') {
    return NextResponse.json({ error: 'objectApiName is required', code: 'VALIDATION_ERROR' }, { status: 400 })
  }
  if (!objectLabel || typeof objectLabel !== 'string') {
    return NextResponse.json({ error: 'objectLabel is required', code: 'VALIDATION_ERROR' }, { status: 400 })
  }
  if (!fieldName || typeof fieldName !== 'string') {
    return NextResponse.json({ error: 'fieldName is required', code: 'VALIDATION_ERROR' }, { status: 400 })
  }
  if (!fieldType || typeof fieldType !== 'string') {
    return NextResponse.json({ error: 'fieldType is required', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  try {
    const result = await generateDescription({
      objectApiName,
      objectLabel,
      fieldName,
      fieldType,
      sampleValues: Array.isArray(sampleValues) ? sampleValues : undefined,
      companyContext: typeof companyContext === 'string' ? companyContext : undefined,
    })

    await logAuditEvent({
      planId,
      action: 'LLM_DESCRIPTION_GENERATED',
      entity: 'SchemaWrite',
      details: { objectApiName, fieldName, fieldType, tokensUsed: result.tokensUsed, model: result.model },
    }).catch(() => {})

    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof LlmUnavailableError) {
      return NextResponse.json(
        { error: err.message, code: 'LLM_UNAVAILABLE' },
        { status: 503 },
      )
    }
    console.error('[POST /schema-write/describe]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error' }, { status: 500 })
  }
}
