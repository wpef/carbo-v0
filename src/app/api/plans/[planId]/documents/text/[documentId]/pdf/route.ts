// 021-pdf-export — GET /api/plans/[planId]/documents/text/[documentId]/pdf
//
// Retourne le document HTML enrichi de CSS @media print pour impression A4.
// TODO: Remplacer le retour HTML par un PDF binaire généré via Puppeteer
//       une fois la dépendance installée (npm install puppeteer).
//       Voir src/features/documents/lib/pdf-export.ts pour l'implémentation stub.

import { NextRequest, NextResponse } from 'next/server'
import { getTextDocument } from '@/features/documents/services/text-document-service'
import { enrichHtmlForPrint, sanitizePdfFilename } from '@/features/documents/lib/pdf-export'
import { logAuditEvent } from '@/lib/audit'
import { prisma } from '@/lib/prisma'

type RouteParams = { params: Promise<{ planId: string; documentId: string }> }

/**
 * GET /api/plans/[planId]/documents/text/[documentId]/pdf
 *
 * Génère et retourne le document texte comme HTML prêt à imprimer (A4).
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

  let doc: Awaited<ReturnType<typeof getTextDocument>>
  try {
    doc = await getTextDocument(documentId)
  } catch {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  const dateStr = new Date(doc.generatedAt).toISOString().slice(0, 10)
  const title = `${plan.name} — Document Technique`
  const filename = sanitizePdfFilename(plan.name, 'text-document', dateStr)

  const enrichedHtml = enrichHtmlForPrint(doc.htmlContent, title, dateStr)

  await logAuditEvent({
    planId,
    action: 'PDF_EXPORT_TEXT_DOCUMENT',
    entity: 'TextDocument',
    entityId: documentId,
    details: { filename, documentId },
  })

  // Retourner le HTML prêt à imprimer
  // TODO: remplacer par application/pdf + buffer Puppeteer
  return new NextResponse(enrichedHtml, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Ce header prépare le nom de fichier pour quand le PDF binaire sera implémenté
      'X-Pdf-Filename': filename,
      // Indique au client que le PDF binaire n'est pas encore disponible
      'X-Pdf-Mode': 'print-html',
    },
  })
}
