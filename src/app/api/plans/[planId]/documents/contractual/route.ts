import { NextResponse } from 'next/server'
import { generateContractualDocument, listContractualDocuments } from '@/features/documents/services/contractual-document-service'

export async function GET(_request: Request, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params
  const documents = await listContractualDocuments(planId)
  return NextResponse.json(documents)
}

export async function POST(_request: Request, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params
  try {
    const doc = await generateContractualDocument(planId)
    return NextResponse.json(
      { id: doc.id, referenceNumber: doc.referenceNumber, objectCount: doc.objectCount, fieldCount: doc.fieldCount, ruleCount: doc.ruleCount, generatedAt: doc.generatedAt },
      { status: 201 },
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Generation failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
