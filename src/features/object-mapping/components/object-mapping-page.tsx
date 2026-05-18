'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

interface SchemaObject {
  id: string
  apiName: string
  label: string
  isCustom: boolean
}

interface ObjectMapping {
  id: string
  sourceObjectName: string
  destinationObjectName: string
  fieldMappings: unknown[]
}

export function ObjectMappingPage({ planId }: { planId: string }) {
  const [sourceObjects, setSourceObjects] = useState<SchemaObject[]>([])
  const [destObjects, setDestObjects] = useState<SchemaObject[]>([])
  const [mappings, setMappings] = useState<ObjectMapping[]>([])
  const [loading, setLoading] = useState(true)
  const [linking, setLinking] = useState(false)
  const [selectedSource, setSelectedSource] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [planId])

  async function loadData() {
    setLoading(true)
    const [srcRes, dstRes, mapRes] = await Promise.all([
      fetch(`/api/plans/${planId}/source/objects`),
      fetch(`/api/plans/${planId}/destination/schema`),
      fetch(`/api/plans/${planId}/object-mappings`),
    ])
    const srcData = await srcRes.json()
    const dstData = await dstRes.json()
    const mapData = await mapRes.json()

    setSourceObjects(srcData.filter((o: SchemaObject & { isSelected: boolean }) => o.isSelected))
    setDestObjects(dstData?.objects ?? [])
    setMappings(mapData)
    setLoading(false)
  }

  async function handleAutoLink() {
    setLinking(true)
    try {
      await fetch(`/api/plans/${planId}/object-mappings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoLink: true }),
      })
      await loadData()
    } finally {
      setLinking(false)
    }
  }

  async function handleManualLink(destObjectName: string) {
    if (!selectedSource) return
    await fetch(`/api/plans/${planId}/object-mappings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceObjectName: selectedSource, destinationObjectName: destObjectName }),
    })
    setSelectedSource(null)
    await loadData()
  }

  async function handleDeleteMapping(mappingId: string) {
    await fetch(`/api/plans/${planId}/object-mappings/${mappingId}`, { method: 'DELETE' })
    await loadData()
  }

  async function handleAdvanceStep() {
    await fetch(`/api/plans/${planId}/step`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetStep: 'FIELD_MAPPING' }),
    })
    window.location.href = `/plans/${planId}/field-mapping`
  }

  if (loading) return <div className="text-muted-foreground">Loading...</div>

  const mappedSources = new Set(mappings.map((m) => m.sourceObjectName))
  const mappedDests = new Set(mappings.map((m) => m.destinationObjectName))
  const unmappedSources = sourceObjects.filter((o) => !mappedSources.has(o.apiName))
  const unmappedDests = destObjects.filter((o) => !mappedDests.has(o.apiName))

  return (
    <div className="space-y-6">
      {mappings.length === 0 && unmappedSources.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Auto-link objects with matching names between source and destination.
              </p>
            </div>
            <Button onClick={handleAutoLink} disabled={linking}>
              {linking ? 'Linking...' : 'Auto-Link Objects'}
            </Button>
          </div>
        </Card>
      )}

      {mappings.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3">Mapped Objects ({mappings.length})</h3>
          <div className="space-y-2">
            {mappings.map((m) => (
              <Card key={m.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{m.sourceObjectName}</Badge>
                    <span className="text-muted-foreground">→</span>
                    <Badge variant="outline">{m.destinationObjectName}</Badge>
                    <Badge variant="secondary" className="text-xs">
                      {m.fieldMappings.length} fields
                    </Badge>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteMapping(m.id)}>
                    Remove
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {(unmappedSources.length > 0 || unmappedDests.length > 0) && (
        <>
          <Separator />
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-2">
                Unmapped Source Objects ({unmappedSources.length})
              </h4>
              <div className="space-y-1">
                {unmappedSources.map((obj) => (
                  <button
                    key={obj.apiName}
                    className={`w-full text-left p-2 rounded border text-sm ${
                      selectedSource === obj.apiName
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:bg-muted'
                    }`}
                    onClick={() => setSelectedSource(selectedSource === obj.apiName ? null : obj.apiName)}
                  >
                    {obj.label} <span className="text-muted-foreground">({obj.apiName})</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-2">
                Unmapped Destination Objects ({unmappedDests.length})
              </h4>
              <div className="space-y-1">
                {unmappedDests.map((obj) => (
                  <button
                    key={obj.apiName}
                    className={`w-full text-left p-2 rounded border text-sm ${
                      selectedSource ? 'border-border hover:bg-primary/10 cursor-pointer' : 'border-border opacity-60'
                    }`}
                    onClick={() => handleManualLink(obj.apiName)}
                    disabled={!selectedSource}
                  >
                    {obj.label} <span className="text-muted-foreground">({obj.apiName})</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          {selectedSource && (
            <p className="text-sm text-muted-foreground">
              Click a destination object to link it with <strong>{selectedSource}</strong>
            </p>
          )}
        </>
      )}

      {mappings.length > 0 && (
        <Button onClick={handleAdvanceStep} className="w-full">
          Continue to Field Mapping →
        </Button>
      )}
    </div>
  )
}
