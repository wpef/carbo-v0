// 021-pdf-export — GET /api/plans/[planId]/documents/text/[documentId]/pdf

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getDocument } from '@/lib/services/text-document/document-store'
import { generatePdf, sanitizeFilename } from '@/lib/services/pdf-export'
import { logAction } from '@/lib/services/audit-service'

type RouteParams = { params: Promise<{ planId: string; documentId: string }> }

/**
 * GET /api/plans/[planId]/documents/text/[documentId]/pdf
 *
 * Generate and return the text document as a downloadable PDF.
 * Returns 404 if the plan or document is not found.
 * Returns 503 if Puppeteer fails to launch or generate the PDF.
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { planId, documentId } = await params

  const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
  if (!plan) {
    return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
  }

  const doc = getDocument(planId, documentId)
  if (!doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  try {
    const result = await generatePdf(doc.html, {
      title: `${doc.planName} — Migration Document`,
      date: new Date(doc.generatedAt).toLocaleDateString('fr-FR'),
      pageSize: 'A4',
    })

    const dateStr = new Date(doc.generatedAt).toISOString().slice(0, 10)
    const filename = sanitizeFilename(doc.planName, 'text-document', dateStr)

    await logAction(planId, 'pdf_export_text_document', {
      documentId,
      filename,
      fileSize: result.fileSize,
    })

    // Convert Node Buffer → plain ArrayBuffer for NextResponse BodyInit compatibility
    const arrayBuffer = result.buffer.buffer.slice(
      result.buffer.byteOffset,
      result.buffer.byteOffset + result.buffer.byteLength,
    ) as ArrayBuffer
    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(result.fileSize),
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'PDF generation failed'
    console.error('[PDF] Text document PDF generation failed:', message)
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
