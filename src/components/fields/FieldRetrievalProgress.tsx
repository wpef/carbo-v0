// 005-source-field-retrieval — Progress indicator during field retrieval

import type { FieldRetrievalResult } from '@/lib/types/field'

interface FieldRetrievalProgressProps {
  /** Total number of objects being processed */
  total: number
  /** Number completed so far (succeeded + failed) */
  completed: number
  /** Per-object outcomes (available after completion) */
  result?: FieldRetrievalResult
}

export function FieldRetrievalProgress({ total, completed, result }: FieldRetrievalProgressProps) {
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0
  const isDone = result !== undefined

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">
          {isDone ? 'Field retrieval complete' : `Retrieving fields: ${completed} / ${total} objects`}
        </span>
        <span className="text-muted-foreground">{percent}%</span>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${isDone ? 'bg-green-500' : 'bg-primary'}`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Per-object status (shown after completion) */}
      {result && (
        <div className="space-y-1 mt-2">
          {result.succeeded.map((s) => (
            <div key={s.objectApiName} className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="text-green-600">&#10003;</span>
              <span className="font-mono">{s.objectApiName}</span>
              <span className="ml-auto">{s.fieldCount} fields</span>
            </div>
          ))}
          {result.failed.map((f) => (
            <div key={f.objectApiName} className="flex items-center gap-2 text-xs text-destructive">
              <span>&#10007;</span>
              <span className="font-mono">{f.objectApiName}</span>
              <span className="ml-auto truncate max-w-xs">{f.error}</span>
            </div>
          ))}
        </div>
      )}

      {result && (
        <p className="text-xs text-muted-foreground pt-1">
          {result.totalFields} total fields retrieved in {result.duration}ms
          {result.failed.length > 0 && (
            <span className="text-destructive ml-2">({result.failed.length} object(s) failed)</span>
          )}
        </p>
      )}
    </div>
  )
}
