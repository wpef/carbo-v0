// 010-field-stats — Field stats row displayed above the record table

'use client'

import type { FieldStats } from '@/lib/connectors/types'

const MAX_SAMPLE_DISPLAY_LENGTH = 100

interface FieldStatsRowProps {
  stats: FieldStats[]
  /** Ordered column names matching the record table columns. */
  columns: string[]
  /** Total number of records that were analyzed (the current page). */
  recordCount: number
  /** Current page number (for scope label). */
  page: number
}

function truncate(value: unknown): string {
  const str = String(value)
  if (str.length > MAX_SAMPLE_DISPLAY_LENGTH) {
    return str.slice(0, MAX_SAMPLE_DISPLAY_LENGTH) + '…'
  }
  return str
}

function SampleChip({ value }: { value: unknown }) {
  const display = truncate(value)
  const full = String(value)
  const isTruncated = full.length > MAX_SAMPLE_DISPLAY_LENGTH

  return (
    <span
      className="inline-block max-w-[120px] truncate align-middle bg-muted text-muted-foreground rounded px-1 py-0.5 text-[10px] font-mono leading-tight"
      title={isTruncated ? full : undefined}
    >
      {display}
    </span>
  )
}

function FieldStatCell({ stat, recordCount }: { stat: FieldStats | undefined; recordCount: number }) {
  if (!stat) {
    return <td className="px-3 py-2 align-top min-w-[120px] border-r last:border-r-0 border-border/40" />
  }

  // Binary field sentinel
  if (stat.nullCount === -1) {
    return (
      <td className="px-3 py-2 align-top min-w-[120px] border-r last:border-r-0 border-border/40">
        <span className="text-[10px] text-muted-foreground italic">N/A (binary)</span>
      </td>
    )
  }

  const nullPct = recordCount > 0 ? Math.round((stat.nullCount / recordCount) * 100) : 0

  return (
    <td className="px-3 py-2 align-top min-w-[120px] border-r last:border-r-0 border-border/40">
      <div className="space-y-1">
        <div className="flex gap-2 text-[10px] text-muted-foreground">
          <span title="Null count">
            <span className="font-semibold text-foreground">{stat.nullCount}</span> null ({nullPct}%)
          </span>
          <span>·</span>
          <span title="Distinct count">
            <span className="font-semibold text-foreground">{stat.distinctCount}</span> distinct
          </span>
        </div>
        {stat.sampleValues.length > 0 ? (
          <div className="flex flex-wrap gap-0.5">
            {stat.sampleValues.map((v, i) => (
              <SampleChip key={i} value={v} />
            ))}
          </div>
        ) : (
          <span className="text-[10px] text-muted-foreground/60 italic">no values</span>
        )}
      </div>
    </td>
  )
}

export function FieldStatsRow({ stats, columns, recordCount, page }: FieldStatsRowProps) {
  // Build a lookup map for quick access
  const statMap = new Map<string, FieldStats>(stats.map((s) => [s.fieldApiName, s]))

  return (
    <div className="overflow-x-auto border rounded-md bg-muted/10">
      {/* Scope label */}
      <div className="px-3 py-1.5 border-b text-[10px] text-muted-foreground font-medium">
        Stats based on {recordCount} record{recordCount !== 1 ? 's' : ''} (page {page})
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-muted/30">
            {columns.map((col) => (
              <th
                key={col}
                className="text-left px-3 py-1.5 font-medium text-muted-foreground font-mono whitespace-nowrap text-[10px] border-r last:border-r-0 border-border/40"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {columns.map((col) => (
              <FieldStatCell key={col} stat={statMap.get(col)} recordCount={recordCount} />
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}
