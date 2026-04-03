// 021-pdf-export — Reusable PDF download button for document preview pages

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface PdfDownloadButtonProps {
  planId: string
  documentId: string
  documentType: 'text' | 'contractual'
  /** Optional label override. Defaults to "Download PDF". */
  label?: string
}

/**
 * Fetches a PDF from the server and triggers a browser download.
 * Displays a loading spinner while generating and an error message on failure.
 */
export function PdfDownloadButton({ planId, documentId, documentType, label = 'Download PDF' }: PdfDownloadButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDownload() {
    setLoading(true)
    setError(null)

    const url = `/api/plans/${planId}/documents/${documentType}/${documentId}/pdf`

    try {
      const response = await fetch(url)

      if (!response.ok) {
        let message = `PDF generation failed (HTTP ${response.status})`
        try {
          const body = await response.json()
          if (body?.error) message = body.error
        } catch {
          // ignore JSON parse errors
        }
        throw new Error(message)
      }

      const blob = await response.blob()
      const contentDisposition = response.headers.get('Content-Disposition') ?? ''
      const filenameMatch = contentDisposition.match(/filename="([^"]+)"/)
      const filename = filenameMatch?.[1] ?? 'document.pdf'

      // Trigger browser download
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(objectUrl)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred while generating the PDF.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={handleDownload} disabled={loading} variant="outline" size="sm">
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
            Generating PDF…
          </span>
        ) : (
          label
        )}
      </Button>

      {error && (
        <p className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
