// 021-pdf-export — GET /api/plans/[planId]/documents/contractual/[documentId]/pdf
//
// Génère un PDF A4 binaire (application/pdf) via puppeteer-core + @sparticuz/chromium
// (compatible Netlify/Lambda). Si Chromium ne peut pas démarrer, retombe gracieusement
// sur le HTML d'impression (X-Pdf-Mode: print-html) pour ne pas casser le parcours.

import { NextRequest, NextResponse } from 'next/server'
import { getContractualDocument } from '@/features/documents/services/contractual-document-service'
import {
  enrichHtmlForPrint,
  sanitizePdfFilename,
  generatePdfBinary,
} from '@/features/documents/lib/pdf-export'
import { logAuditEvent } from '@/lib/audit'
import { prisma } from '@/lib/prisma'

type RouteParams = { params: Promise<{ planId: string; documentId: string }> }

/**
 * GET /api/plans/[planId]/documents/contractual/[documentId]/pdf
 *
 * Génère et retourne le document contractuel en PDF A4 binaire (téléchargement direct).
 * Fallback HTML d'impression si Chromium échoue.
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { planId, documentId } = await params

  // Vérifier que le plan existe
  const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
  if (!plan) {
    return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
  }

  let doc: Awaited<ReturnType<typeof getContractualDocument>>
  try {
    doc = await getContractualDocument(documentId)
  } catch {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  const dateStr = new Date(doc.generatedAt).toISOString().slice(0, 10)
  const title = `${plan.name} — Document Contractuel (${doc.referenceNumber})`
  const filename = sanitizePdfFilename(plan.name, 'contractual-document', dateStr)

  // 1. Tenter le PDF binaire (Netlify/Lambda + dev avec Chromium disponible)
  try {
    const { buffer, fileSize } = await generatePdfBinary(doc.htmlContent, { title, date: dateStr })

    await logAuditEvent({
      planId,
      action: 'PDF_EXPORT_CONTRACTUAL_DOCUMENT',
      entity: 'ContractualDocument',
      entityId: documentId,
      details: { filename, documentId, referenceNumber: doc.referenceNumber, mode: 'pdf', fileSize },
    })

    // Buffer Node → ArrayBuffer pour BodyInit
    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ) as ArrayBuffer

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(fileSize),
        'X-Pdf-Filename': filename,
        'X-Pdf-Mode': 'pdf',
      },
    })
  } catch (err) {
    // 2. Fallback gracieux : HTML d'impression (le parcours ne casse pas)
    const message = err instanceof Error ? err.message : String(err)
    console.error('[PDF] Fallback HTML pour le document contractuel :', message)

    const enrichedHtml = enrichHtmlForPrint(doc.htmlContent, title, dateStr)

    await logAuditEvent({
      planId,
      action: 'PDF_EXPORT_CONTRACTUAL_DOCUMENT',
      entity: 'ContractualDocument',
      entityId: documentId,
      details: { filename, documentId, referenceNumber: doc.referenceNumber, mode: 'print-html', error: message },
    })

    return new NextResponse(enrichedHtml, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Pdf-Filename': filename,
        'X-Pdf-Mode': 'print-html',
      },
    })
  }
}
