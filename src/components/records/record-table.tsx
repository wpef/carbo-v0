// 009-record-preview — Record table component

'use client'

import { useState } from 'react'
import type { ConnectorRecord } from '@/lib/connectors/types'

interface RecordTableProps {
  records: ConnectorRecord[]
  /** Optional explicit column order. Auto-detected from first record if omitted. */
  columns?: string[]
}

function CellValue({ value }: { value: unknown }) {
  const [expanded, setExpanded] = useState(false)

  if (value === null || value === undefined) {
    return <span className="text-muted-foreground/60 italic text-[11px]">null</span>
  }

  const str = String(value)

  if (str.length > 200 && !expanded) {
    return (
      <span>
        {str.slice(0, 200)}
        <button
          onClick={() => setExpanded(true)}
          className="ml-1 text-[10px] underline text-muted-foreground hover:text-foreground"
        >
          Show more
        </button>
      </span>
    )
  }

  return <span>{str}</span>
}

export function RecordTable({ records, columns }: RecordTableProps) {
  const cols = columns ?? (records.length > 0 ? Object.keys(records[0]) : [])

  if (cols.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">No columns to display.</p>
  }

  return (
    <div className="overflow-x-auto border rounded-md">
      <table className="w-full text-xs">
        <thead className="bg-muted">
          <tr>
            {cols.map((col) => (
              <th
                key={col}
                className="text-left px-3 py-2 font-medium text-muted-foreground font-mono whitespace-nowrap"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((record, rowIdx) => (
            <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
              {cols.map((col) => (
                <td
                  key={col}
                  className="px-3 py-1.5 max-w-[240px] align-top"
                >
                  <CellValue value={record[col]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
