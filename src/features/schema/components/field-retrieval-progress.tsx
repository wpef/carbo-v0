// 005-source-field-retrieval — Progress indicator during field retrieval

'use client'

import type { FieldRetrievalItemResult } from '@/features/schema/hooks/use-fields'

interface FieldRetrievalProgressProps {
  total: number
  completed: number
  results?: FieldRetrievalItemResult[]
}

export function FieldRetrievalProgress({ total, completed, results }: FieldRetrievalProgressProps) {
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0
  const isDone = results !== undefined

  const succeeded = results?.filter((r) => !r.error) ?? []
  const failed = results?.filter((r) => !!r.error) ?? []
  const totalFields = results?.reduce((sum, r) => sum + r.fieldCount, 0) ?? 0

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">
          {isDone
            ? 'Field retrieval complete'
            : `Retrieving fields: ${completed} / ${total} objects`}
        </span>
        <span className="text-muted-foreground">{percent}%</span>
      </div>

      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${isDone ? 'bg-green-500' : 'bg-primary'}`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {isDone && results && (
        <div className="space-y-1 mt-2">
          {succeeded.map((s) => (
            <div key={s.objectApiName} className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="text-green-600">&#10003;</span>
              <span className="font-mono">{s.objectApiName}</span>
              <span className="ml-auto">{s.fieldCount} fields</span>
            </div>
          ))}
          {failed.map((f) => (
            <div key={f.objectApiName} className="flex items-center gap-2 text-xs text-destructive">
              <span>&#10007;</span>
              <span className="font-mono">{f.objectApiName}</span>
              <span className="ml-auto truncate max-w-xs">{f.error}</span>
            </div>
          ))}
        </div>
      )}

      {isDone && results && (
        <p className="text-xs text-muted-foreground pt-1">
          {totalFields} total fields retrieved
          {failed.length > 0 && (
            <span className="text-destructive ml-2">({failed.length} object(s) failed)</span>
          )}
        </p>
      )}
    </div>
  )
}
