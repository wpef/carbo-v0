'use client'

import { useEffect, useState } from 'react'
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
  generatedAt: string
}

export function DocumentsPage({ planId }: { planId: string }) {
  const [textDocs, setTextDocs] = useState<DocumentMeta[]>([])
  const [contractDocs, setContractDocs] = useState<DocumentMeta[]>([])
  const [generating, setGenerating] = useState<string | null>(null)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDocuments()
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

  async function handlePreview(type: 'text' | 'contractual', docId: string) {
    const res = await fetch(`/api/plans/${planId}/documents/${type}/${docId}`)
    const doc = await res.json()
    setPreviewHtml(doc.htmlContent)
  }

  if (loading) return <div className="text-muted-foreground">Loading...</div>

  if (previewHtml) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => setPreviewHtml(null)}>
          ← Back to Documents
        </Button>
        <div
          className="border rounded-lg p-4 bg-white"
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Document Technique</h3>
            <p className="text-sm text-muted-foreground">
              Documentation technique détaillée du plan de migration.
            </p>
          </div>
          <Button onClick={handleGenerateText} disabled={generating !== null}>
            {generating === 'text' ? 'Génération...' : 'Générer'}
          </Button>
        </div>
        {textDocs.length > 0 && (
          <div className="mt-3 space-y-2">
            {textDocs.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between text-sm border rounded p-2">
                <div className="flex items-center gap-2">
                  <Badge variant={doc.status === 'CURRENT' ? 'default' : 'secondary'}>
                    {doc.status}
                  </Badge>
                  <span>{doc.objectCount} objets, {doc.fieldCount} champs, {doc.ruleCount} règles</span>
                  <span className="text-muted-foreground">
                    {new Date(doc.generatedAt).toLocaleDateString('fr-FR')}
                  </span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handlePreview('text', doc.id)}>
                  Voir
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Separator />

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Document Contractuel</h3>
            <p className="text-sm text-muted-foreground">
              Document formel avec référence unique pour validation client.
            </p>
          </div>
          <Button onClick={handleGenerateContractual} disabled={generating !== null}>
            {generating === 'contractual' ? 'Génération...' : 'Générer'}
          </Button>
        </div>
        {contractDocs.length > 0 && (
          <div className="mt-3 space-y-2">
            {contractDocs.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between text-sm border rounded p-2">
                <div className="flex items-center gap-2">
                  <Badge variant={doc.status === 'CURRENT' ? 'default' : 'secondary'}>
                    {doc.status}
                  </Badge>
                  <span className="font-mono text-xs">{doc.referenceNumber}</span>
                  <span>{doc.objectCount} objets, {doc.fieldCount} champs</span>
                  <span className="text-muted-foreground">
                    {new Date(doc.generatedAt).toLocaleDateString('fr-FR')}
                  </span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handlePreview('contractual', doc.id)}>
                  Voir
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
