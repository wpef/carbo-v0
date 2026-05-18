import { NextResponse } from 'next/server'
import { getTextDocument } from '@/features/documents/services/text-document-service'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ planId: string; documentId: string }> },
) {
  const { documentId } = await params
  try {
    const doc = await getTextDocument(documentId)
    return NextResponse.json(doc)
  } catch {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }
}
