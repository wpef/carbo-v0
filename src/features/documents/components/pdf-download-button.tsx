'use client'
// 021-pdf-export — Bouton de téléchargement PDF réutilisable
//
// Actuellement : ouvre le HTML d'impression dans un nouvel onglet (mode print-html).
// TODO: Quand Puppeteer sera installé et que la route retournera application/pdf,
//       supprimer la gestion du mode 'print-html' et activer le téléchargement direct :
//       const blob = await response.blob()
//       const url = URL.createObjectURL(blob)
//       anchor.download = filename
//       anchor.click()

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface PdfDownloadButtonProps {
  planId: string
  documentId: string
  documentType: 'text' | 'contractual'
  label?: string
}

/**
 * Déclenche le téléchargement (ou l'impression) du document en PDF.
 *
 * Mode actuel (print-html) : ouvre la page d'impression dans un nouvel onglet.
 *   L'utilisateur peut utiliser Fichier > Imprimer > Enregistrer en PDF.
 * Mode futur (application/pdf) : déclenche le téléchargement direct du fichier PDF.
 */
export function PdfDownloadButton({
  planId,
  documentId,
  documentType,
  label = 'Télécharger PDF',
}: PdfDownloadButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDownload() {
    setLoading(true)
    setError(null)

    const url = `/api/plans/${planId}/documents/${documentType}/${documentId}/pdf`

    try {
      const response = await fetch(url)

      if (!response.ok) {
        let message = `Erreur lors de la génération PDF (HTTP ${response.status})`
        try {
          const body = await response.json()
          if (body?.error) message = body.error
        } catch { /* ignore */ }
        throw new Error(message)
      }

      const pdfMode = response.headers.get('X-Pdf-Mode')

      if (pdfMode === 'print-html') {
        // Mode HTML print : ouvrir dans un nouvel onglet pour impression navigateur
        const html = await response.text()
        const blob = new Blob([html], { type: 'text/html; charset=utf-8' })
        const objectUrl = URL.createObjectURL(blob)
        const win = window.open(objectUrl, '_blank')
        // Libérer l'URL après ouverture
        setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000)
        if (!win) {
          throw new Error(
            'Le navigateur a bloqué l\'ouverture du document. Autorisez les pop-ups pour ce site.'
          )
        }
      } else {
        // Mode PDF binaire (futur Puppeteer)
        const blob = await response.blob()
        const contentDisposition = response.headers.get('Content-Disposition') ?? ''
        const filenameMatch = contentDisposition.match(/filename="([^"]+)"/)
        const filename = filenameMatch?.[1] ?? 'document.pdf'

        const objectUrl = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = objectUrl
        anchor.download = filename
        document.body.appendChild(anchor)
        anchor.click()
        document.body.removeChild(anchor)
        URL.revokeObjectURL(objectUrl)
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Une erreur inattendue s\'est produite.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button onClick={handleDownload} disabled={loading} variant="outline" size="sm">
        {loading ? (
          <span className="flex items-center gap-2">
            <span
              className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
              aria-hidden="true"
            />
            Génération en cours…
          </span>
        ) : (
          label
        )}
      </Button>
      {error && (
        <p className="text-xs text-destructive max-w-xs">{error}</p>
      )}
    </div>
  )
}
