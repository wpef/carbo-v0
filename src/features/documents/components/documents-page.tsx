'use client'
// 019-text-document + 020-contractual-document — Page liste des documents

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

interface DocumentMeta {
  id: string
  version?: number
  referenceNumber?: string
  status: string
  objectCount: number
  fieldCount: number
  ruleCount: number
  filterCount?: number
  unmappedCount?: number
  llmCallCount?: number
  generatedAt: string
}

export function DocumentsPage({ planId }: { planId: string }) {
  const [textDocs, setTextDocs] = useState<DocumentMeta[]>([])
  const [contractDocs, setContractDocs] = useState<DocumentMeta[]>([])
  const [generating, setGenerating] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDocuments()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId])

  async function loadDocuments() {
    setLoading(true)
    const [textRes, contractRes] = await Promise.all([
      fetch(`/api/plans/${planId}/documents/text`),
      fetch(`/api/plans/${planId}/documents/contractual`),
    ])
    setTextDocs(await textRes.json())
    setContractDocs(await contractRes.json())
    setLoading(false)
  }

  async function handleGenerateText() {
    setGenerating('text')
    try {
      await fetch(`/api/plans/${planId}/documents/text`, { method: 'POST' })
      await loadDocuments()
    } finally {
      setGenerating(null)
    }
  }

  async function handleGenerateContractual() {
    setGenerating('contractual')
    try {
      await fetch(`/api/plans/${planId}/documents/contractual`, { method: 'POST' })
      await loadDocuments()
    } finally {
      setGenerating(null)
    }
  }

  if (loading) return <div className="text-muted-foreground">Chargement…</div>

  return (
    <div className="space-y-6">
      {/* Document Technique */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Document Technique</h3>
            <p className="text-sm text-muted-foreground">
              Documentation technique détaillée pour revue interne et client.
            </p>
          </div>
          <Button onClick={handleGenerateText} disabled={generating !== null}>
            {generating === 'text' ? 'Génération…' : 'Générer'}
          </Button>
        </div>

        {textDocs.length > 0 && (
          <div className="mt-3 space-y-2">
            {textDocs.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between text-sm border rounded p-2"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={doc.status === 'CURRENT' ? 'default' : 'secondary'}>
                    {doc.status}
                  </Badge>
                  <span>
                    {doc.objectCount} obj. &middot; {doc.fieldCount} champs &middot; {doc.ruleCount} règles
                    {(doc.unmappedCount ?? 0) > 0 && (
                      <span className="text-yellow-700 ml-1">
                        &middot; {doc.unmappedCount} non-mappés
                      </span>
                    )}
                    {(doc.llmCallCount ?? 0) > 0 && (
                      <span className="text-blue-600 ml-1">
                        &middot; {doc.llmCallCount} appels IA
                      </span>
                    )}
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(doc.generatedAt).toLocaleDateString('fr-FR')}
                  </span>
                </div>
                <Link
                  href={`/plans/${planId}/documents/text/${doc.id}`}
                  className="text-sm font-medium text-primary hover:underline shrink-0"
                >
                  Voir
                </Link>
              </div>
            ))}
          </div>
        )}

        {textDocs.length === 0 && (
          <p className="mt-3 text-sm text-muted-foreground italic">
            Aucun document généré — cliquez sur "Générer" pour créer le premier.
          </p>
        )}
      </Card>

      <Separator />

      {/* Document Contractuel */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Document Contractuel</h3>
            <p className="text-sm text-muted-foreground">
              Document formel avec référence unique, 7 articles et bloc de signature pour validation client.
            </p>
          </div>
          <Button onClick={handleGenerateContractual} disabled={generating !== null}>
            {generating === 'contractual' ? 'Génération…' : 'Générer'}
          </Button>
        </div>

        {contractDocs.length > 0 && (
          <div className="mt-3 space-y-2">
            {contractDocs.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between text-sm border rounded p-2"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={doc.status === 'CURRENT' ? 'default' : 'secondary'}>
                    {doc.status}
                  </Badge>
                  <span className="font-mono text-xs">{doc.referenceNumber}</span>
                  <span>
                    {doc.objectCount} obj. &middot; {doc.fieldCount} champs
                    {(doc.unmappedCount ?? 0) > 0 && (
                      <span className="text-yellow-700 ml-1">
                        &middot; {doc.unmappedCount} exclusion{doc.unmappedCount! > 1 ? 's' : ''}
                      </span>
                    )}
                    {(doc.filterCount ?? 0) > 0 && (
                      <span className="ml-1">
                        &middot; {doc.filterCount} filtre{doc.filterCount! > 1 ? 's' : ''}
                      </span>
                    )}
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(doc.generatedAt).toLocaleDateString('fr-FR')}
                  </span>
                </div>
                <Link
                  href={`/plans/${planId}/documents/contractual/${doc.id}`}
                  className="text-sm font-medium text-primary hover:underline shrink-0"
                >
                  Voir
                </Link>
              </div>
            ))}
          </div>
        )}

        {contractDocs.length === 0 && (
          <p className="mt-3 text-sm text-muted-foreground italic">
            Aucun document contractuel généré — cliquez sur "Générer" pour créer le premier.
          </p>
        )}
      </Card>
    </div>
  )
}
