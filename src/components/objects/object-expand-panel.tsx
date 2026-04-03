// 004-source-object-selection — Expanded panel showing fields + sample records

'use client'

import { useEffect, useState } from 'react'

interface Field {
  apiName: string
  label: string
  dataType: string
  isRequired: boolean
  isReadOnly: boolean
  isUnique: boolean
  referenceTo?: string
}

interface ExpandedObjectData {
  objectApiName: string
  recordCount: number
  fields: Field[]
  sampleRecords: Array<Record<string, unknown>>
}

interface ObjectExpandPanelProps {
  planId: string
  objectId: string
  objectApiName: string
}

export function ObjectExpandPanel({ planId, objectId, objectApiName }: ObjectExpandPanelProps) {
  const [data, setData] = useState<ExpandedObjectData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    fetch(`/api/plans/${planId}/source/objects/${objectId}/expand`)
      .then(async (res) => {
        if (!res.ok) {
          const json = await res.json()
          throw new Error(json.message ?? 'Failed to load object details.')
        }
        return res.json() as Promise<ExpandedObjectData>
      })
      .then((d) => setData(d))
      .catch((err) => setError(err instanceof Error ? err.message : 'Unknown error'))
      .finally(() => setLoading(false))
  }, [planId, objectId])

  if (loading) {
    return <div className="px-6 py-4 text-sm text-muted-foreground">Loading {objectApiName}...</div>
  }

  if (error) {
    return <div className="px-6 py-4 text-sm text-destructive">{error}</div>
  }

  if (!data) return null

  const fieldCols = data.fields.slice(0, 5).map((f) => f.apiName)

  return (
    <div className="bg-muted/20 px-6 py-4 space-y-6 border-b">
      {/* Summary */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-muted-foreground">
          <span className="font-medium text-foreground">{data.recordCount}</span> records
        </span>
        <span className="text-muted-foreground">
          <span className="font-medium text-foreground">{data.fields.length}</span> fields
        </span>
      </div>

      {/* Fields table */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Fields</h3>
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">API Name</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Label</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Type</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Flags</th>
              </tr>
            </thead>
            <tbody>
              {data.fields.map((field, idx) => (
                <tr key={field.apiName} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                  <td className="px-3 py-1.5 font-mono">{field.apiName}</td>
                  <td className="px-3 py-1.5">{field.label}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{field.dataType}</td>
                  <td className="px-3 py-1.5">
                    <span className="flex gap-1 flex-wrap">
                      {field.isRequired && (
                        <span className="text-[10px] bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 rounded px-1">req</span>
                      )}
                      {field.isUnique && (
                        <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded px-1">unique</span>
                      )}
                      {field.isReadOnly && (
                        <span className="text-[10px] bg-muted text-muted-foreground rounded px-1">ro</span>
                      )}
                      {field.referenceTo && (
                        <span className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded px-1">
                          &rarr; {field.referenceTo}
                        </span>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sample records */}
      {data.sampleRecords.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Sample records (up to 5)
          </h3>
          <div className="border rounded-md overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted">
                <tr>
                  {fieldCols.map((col) => (
                    <th key={col} className="text-left px-3 py-2 font-medium text-muted-foreground font-mono whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.sampleRecords.map((record, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                    {fieldCols.map((col) => (
                      <td key={col} className="px-3 py-1.5 max-w-[160px] truncate">
                        {record[col] === null || record[col] === undefined
                          ? <span className="text-muted-foreground italic">null</span>
                          : String(record[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
