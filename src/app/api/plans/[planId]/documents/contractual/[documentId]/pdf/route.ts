// 021-pdf-export — GET /api/plans/[planId]/documents/contractual/[documentId]/pdf
//
// Retourne le document contractuel HTML enrichi de CSS @media print pour impression A4.
// TODO: Remplacer le retour HTML par un PDF binaire généré via Puppeteer
//       une fois la dépendance installée (npm install puppeteer).
//       Voir src/features/documents/lib/pdf-export.ts pour l'implémentation stub.

import { NextRequest, NextResponse } from 'next/server'
import { getContractualDocument } from '@/features/documents/services/contractual-document-service'
import { enrichHtmlForPrint, sanitizePdfFilename } from '@/features/documents/lib/pdf-export'
import { logAuditEvent } from '@/lib/audit'
import { prisma } from '@/lib/prisma'

type RouteParams = { params: Promise<{ planId: string; documentId: string }> }

/**
 * GET /api/plans/[planId]/documents/contractual/[documentId]/pdf
 *
 * Génère et retourne le document contractuel comme HTML prêt à imprimer (A4).
 * Le navigateur peut l'imprimer en PDF via Fichier > Imprimer > Enregistrer en PDF.
 *
 * TODO: Générer un vrai PDF binaire via Puppeteer :
 *   const pdf = await generatePdf(doc.htmlContent, { title, date, pageSize: 'A4' })
 *   return new NextResponse(pdf.buffer, { headers: { 'Content-Type': 'application/pdf', ... } })
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

  const enrichedHtml = enrichHtmlForPrint(doc.htmlContent, title, dateStr)

  await logAuditEvent({
    planId,
    action: 'PDF_EXPORT_CONTRACTUAL_DOCUMENT',
    entity: 'ContractualDocument',
    entityId: documentId,
    details: { filename, documentId, referenceNumber: doc.referenceNumber },
  })

  // Retourner le HTML prêt à imprimer
  // TODO: remplacer par application/pdf + buffer Puppeteer
  return new NextResponse(enrichedHtml, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Pdf-Filename': filename,
      'X-Pdf-Mode': 'print-html',
    },
  })
}
