import { NextResponse } from 'next/server'
import { getContractualDocument } from '@/features/documents/services/contractual-document-service'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ planId: string; documentId: string }> },
) {
  const { documentId } = await params
  try {
    const doc = await getContractualDocument(documentId)
    return NextResponse.json(doc)
  } catch {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }
}
