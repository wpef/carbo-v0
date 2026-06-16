// 019-text-document — Page de prévisualisation d'un document technique

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getTextDocument } from '@/features/documents/services/text-document-service'
import { PdfDownloadButton } from '@/features/documents/components/pdf-download-button'
import { Badge } from '@/components/ui/badge'

interface Props {
  params: Promise<{ planId: string; documentId: string }>
}

export default async function TextDocumentDetailPage({ params }: Props) {
  const { planId, documentId } = await params

  let doc: Awaited<ReturnType<typeof getTextDocument>>
  try {
    doc = await getTextDocument(documentId)
  } catch {
    notFound()
  }

  const generatedAt = new Date(doc.generatedAt).toLocaleDateString('fr-FR', { dateStyle: 'long' })
  const isOutdated = doc.status === 'OUTDATED'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link
          href={`/plans/${planId}/documents`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Retour aux documents
        </Link>
        <div className="flex items-center gap-3">
          <PdfDownloadButton planId={planId} documentId={documentId} documentType="text" />
        </div>
      </div>

      {isOutdated && (
        <div className="rounded-lg border border-yellow-400 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          <strong>Document obsolete</strong> — Ce document ne reflète plus l'état actuel du plan de migration.
          Regénérez un nouveau document pour avoir la version à jour.
        </div>
      )}

      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Badge variant={isOutdated ? 'secondary' : 'default'}>{doc.status}</Badge>
        <span>Généré le {generatedAt}</span>
        <span className="hidden sm:inline">
          {doc.objectCount} objet{doc.objectCount > 1 ? 's' : ''} &middot;&nbsp;
          {doc.fieldCount} champ{doc.fieldCount > 1 ? 's' : ''} &middot;&nbsp;
          {doc.ruleCount} règle{doc.ruleCount > 1 ? 's' : ''}
          {(doc.unmappedCount ?? 0) > 0 && (
            <span className="text-yellow-700">
              &middot;&nbsp;{doc.unmappedCount} non-mappé{doc.unmappedCount! > 1 ? 's' : ''}
            </span>
          )}
        </span>
      </div>

      {/* Prévisualisation HTML dans un iframe sandboxé */}
      <div className="rounded-lg border bg-white overflow-hidden" style={{ height: '80vh' }}>
        <iframe
          srcDoc={doc.htmlContent}
          className="w-full h-full"
          title="Prévisualisation document technique"
          sandbox="allow-same-origin"
        />
      </div>
    </div>
  )
}
