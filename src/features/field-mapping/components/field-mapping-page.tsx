'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

interface ObjectMapping {
  id: string
  sourceObjectName: string
  destinationObjectName: string
  fieldAutoMatchedAt: string | null
}

interface FieldMapping {
  id: string
  sourceFieldName: string
  destinationFieldName: string
  compatibilityStatus: 'COMPATIBLE' | 'WARNING' | 'INCOMPATIBLE'
  migrationLogic: { id: string; status: string; valueEquivalences: unknown[] } | null
}

interface FieldInfo {
  apiName: string
  label: string
  dataType: string
  isRequired: boolean
}

interface IntegrityIssue {
  id: string
  issueType: string
  message: string
  severity: string
}

export function FieldMappingPage({ planId }: { planId: string }) {
  const [objectMappings, setObjectMappings] = useState<ObjectMapping[]>([])
  const [selectedMapping, setSelectedMapping] = useState<string | null>(null)
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([])
  const [unmappedSource, setUnmappedSource] = useState<FieldInfo[]>([])
  const [unmappedDest, setUnmappedDest] = useState<FieldInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [matching, setMatching] = useState(false)
  const [selectedSrcField, setSelectedSrcField] = useState<string | null>(null)
  const [issues, setIssues] = useState<IntegrityIssue[]>([])
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    loadObjectMappings()
  }, [planId])

  useEffect(() => {
    if (selectedMapping) loadFieldMappings(selectedMapping)
  }, [selectedMapping])

  async function loadObjectMappings() {
    setLoading(true)
    const res = await fetch(`/api/plans/${planId}/object-mappings`)
    const data = await res.json()
    setObjectMappings(data)
    if (data.length > 0 && !selectedMapping) setSelectedMapping(data[0].id)
    setLoading(false)
  }

  async function loadFieldMappings(mappingId: string) {
    const [fmRes, srcFieldsRes, dstFieldsRes] = await Promise.all([
      fetch(`/api/plans/${planId}/object-mappings/${mappingId}/field-mappings`),
      fetch(`/api/plans/${planId}/source/fields`),
      fetch(`/api/plans/${planId}/destination/fields`),
    ])
    const fmData = await fmRes.json()
    setFieldMappings(fmData)

    const mapping = objectMappings.find((m) => m.id === mappingId)
    if (!mapping) return

    const srcFields = await srcFieldsRes.json()
    const dstFields = await dstFieldsRes.json()

    const mappedSrcNames = new Set(fmData.map((fm: FieldMapping) => fm.sourceFieldName))
    const mappedDstNames = new Set(fmData.map((fm: FieldMapping) => fm.destinationFieldName))

    setUnmappedSource(
      (srcFields[mapping.sourceObjectName] ?? []).filter((f: FieldInfo) => !mappedSrcNames.has(f.apiName)),
    )
    setUnmappedDest(
      (dstFields[mapping.destinationObjectName] ?? []).filter((f: FieldInfo) => !mappedDstNames.has(f.apiName)),
    )
  }

  async function handleAutoMatch() {
    if (!selectedMapping) return
    setMatching(true)
    try {
      await fetch(`/api/plans/${planId}/object-mappings/${selectedMapping}/field-mappings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoMatch: true }),
      })
      await loadFieldMappings(selectedMapping)
    } finally {
      setMatching(false)
    }
  }

  async function handleManualLink(destFieldName: string, destType: string) {
    if (!selectedMapping || !selectedSrcField) return
    const srcField = unmappedSource.find((f) => f.apiName === selectedSrcField)
    await fetch(`/api/plans/${planId}/object-mappings/${selectedMapping}/field-mappings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceFieldName: selectedSrcField,
        destinationFieldName: destFieldName,
        sourceType: srcField?.dataType ?? 'string',
        destType,
      }),
    })
    setSelectedSrcField(null)
    await loadFieldMappings(selectedMapping)
  }

  async function handleDeleteFieldMapping(fieldMappingId: string) {
    if (!selectedMapping) return
    await fetch(`/api/plans/${planId}/object-mappings/${selectedMapping}/field-mappings?fieldMappingId=${fieldMappingId}`, {
      method: 'DELETE',
    })
    await loadFieldMappings(selectedMapping)
  }

  async function handleRunIntegrity() {
    setChecking(true)
    try {
      const res = await fetch(`/api/plans/${planId}/integrity`, { method: 'POST' })
      const data = await res.json()
      setIssues(data.issues ?? [])
    } finally {
      setChecking(false)
    }
  }

  async function handleAdvanceStep() {
    await fetch(`/api/plans/${planId}/step`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetStep: 'DOCUMENTS' }),
    })
    window.location.href = `/plans/${planId}/documents`
  }

  if (loading) return <div className="text-muted-foreground">Loading...</div>

  const currentMapping = objectMappings.find((m) => m.id === selectedMapping)

  return (
    <div className="space-y-6">
      <div className="flex gap-2 flex-wrap">
        {objectMappings.map((m) => (
          <Button
            key={m.id}
            variant={m.id === selectedMapping ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedMapping(m.id)}
          >
            {m.sourceObjectName} → {m.destinationObjectName}
          </Button>
        ))}
      </div>

      {currentMapping && (
        <>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">
                {currentMapping.sourceObjectName} → {currentMapping.destinationObjectName}
              </h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleAutoMatch} disabled={matching}>
                  {matching ? 'Matching...' : 'Auto-Match Fields'}
                </Button>
              </div>
            </div>
          </Card>

          {fieldMappings.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Mapped Fields ({fieldMappings.length})</h4>
              <div className="space-y-1">
                {fieldMappings.map((fm) => (
                  <div key={fm.id} className="flex items-center justify-between p-2 border rounded text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-mono">{fm.sourceFieldName}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-mono">{fm.destinationFieldName}</span>
                      <Badge
                        variant={
                          fm.compatibilityStatus === 'COMPATIBLE'
                            ? 'default'
                            : fm.compatibilityStatus === 'WARNING'
                              ? 'secondary'
                              : 'destructive'
                        }
                        className="text-xs"
                      >
                        {fm.compatibilityStatus}
                      </Badge>
                      {fm.migrationLogic && (
                        <Badge variant="outline" className="text-xs">
                          Logic: {fm.migrationLogic.status}
                        </Badge>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteFieldMapping(fm.id)}>
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(unmappedSource.length > 0 || unmappedDest.length > 0) && (
            <>
              <Separator />
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-2">Unmapped Source ({unmappedSource.length})</h4>
                  <div className="space-y-1">
                    {unmappedSource.map((f) => (
                      <button
                        key={f.apiName}
                        className={`w-full text-left p-2 rounded border text-sm ${
                          selectedSrcField === f.apiName
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:bg-muted'
                        }`}
                        onClick={() => setSelectedSrcField(selectedSrcField === f.apiName ? null : f.apiName)}
                      >
                        <span className="font-mono text-xs">{f.apiName}</span>
                        <Badge variant="outline" className="ml-2 text-xs">{f.dataType}</Badge>
                        {f.isRequired && <Badge variant="destructive" className="ml-1 text-xs">req</Badge>}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Unmapped Destination ({unmappedDest.length})</h4>
                  <div className="space-y-1">
                    {unmappedDest.map((f) => (
                      <button
                        key={f.apiName}
                        className={`w-full text-left p-2 rounded border text-sm ${
                          selectedSrcField ? 'hover:bg-primary/10 cursor-pointer' : 'opacity-60'
                        }`}
                        onClick={() => handleManualLink(f.apiName, f.dataType)}
                        disabled={!selectedSrcField}
                      >
                        <span className="font-mono text-xs">{f.apiName}</span>
                        <Badge variant="outline" className="ml-2 text-xs">{f.dataType}</Badge>
                        {f.isRequired && <Badge variant="destructive" className="ml-1 text-xs">req</Badge>}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}

      <Separator />

      <div className="flex gap-4">
        <Button variant="outline" onClick={handleRunIntegrity} disabled={checking}>
          {checking ? 'Checking...' : 'Run Integrity Check'}
        </Button>
        <Button onClick={handleAdvanceStep} className="flex-1">
          Continue to Documents →
        </Button>
      </div>

      {issues.length > 0 && (
        <Card className="p-4 border-destructive">
          <h4 className="font-medium text-destructive mb-2">Integrity Issues ({issues.length})</h4>
          <div className="space-y-1">
            {issues.map((issue, i) => (
              <div key={i} className="text-sm flex items-center gap-2">
                <Badge variant={issue.severity === 'ERROR' ? 'destructive' : 'secondary'} className="text-xs">
                  {issue.severity}
                </Badge>
                <span>{issue.message}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
