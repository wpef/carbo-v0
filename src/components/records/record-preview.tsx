// 009-record-preview — Composite record preview component (table + pagination)
// 010-field-stats — Extended with field stats toggle

'use client'

import { useState } from 'react'
import { useRecordPreview } from '@/hooks/use-record-preview'
import { RecordTable } from './record-table'
import { PaginationControls } from './pagination-controls'
import { FieldStatsRow } from './field-stats-row'

interface RecordPreviewProps {
  planId: string
  role: 'source' | 'destination'
  objectApiName: string
}

// Simple skeleton row for loading state
function SkeletonRows() {
  return (
    <div className="border rounded-md overflow-hidden animate-pulse">
      <div className="h-8 bg-muted w-full" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-7 bg-muted/30 w-full border-t" />
      ))}
    </div>
  )
}

export function RecordPreview({ planId, role, objectApiName }: RecordPreviewProps) {
  const { data, loading, error, currentPage, pageSize, fieldStats, setPage, setPageSize, retry } =
    useRecordPreview(planId, role, objectApiName)

  const [showStats, setShowStats] = useState(false)

  if (loading) {
    return (
      <div className="space-y-3">
        <SkeletonRows />
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-6 text-center space-y-3">
        <p className="text-sm text-destructive">{error}</p>
        <button
          onClick={retry}
          className="text-xs border rounded px-3 py-1 hover:bg-muted transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!data || data.records.length === 0) {
    return (
      <div className="py-8 text-center space-y-2">
        <p className="text-sm text-muted-foreground">
          No records found{data ? ` (total: ${data.totalCount})` : ''}.
        </p>
        <p className="text-xs text-muted-foreground/60">No data to analyze.</p>
      </div>
    )
  }

  const columns = Object.keys(data.records[0])

  return (
    <div className="space-y-3">
      {/* Toolbar: field stats toggle */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowStats((prev) => !prev)}
          className={`text-xs border rounded px-3 py-1 transition-colors ${
            showStats
              ? 'bg-muted border-foreground/30 text-foreground'
              : 'hover:bg-muted text-muted-foreground'
          }`}
        >
          {showStats ? 'Hide field stats' : 'Show field stats'}
        </button>
      </div>

      {/* Field stats row — shown above the record table when toggled */}
      {showStats && fieldStats && (
        <FieldStatsRow
          stats={fieldStats}
          columns={columns}
          recordCount={data.records.length}
          page={currentPage}
        />
      )}

      <RecordTable records={data.records} columns={columns} />
      <PaginationControls
        currentPage={currentPage}
        totalCount={data.totalCount}
        pageSize={pageSize}
        hasNextPage={data.hasNextPage}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />
    </div>
  )
}
