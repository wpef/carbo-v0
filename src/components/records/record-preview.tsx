// 009-record-preview — Composite record preview component (table + pagination)

'use client'

import { useRecordPreview } from '@/hooks/use-record-preview'
import { RecordTable } from './record-table'
import { PaginationControls } from './pagination-controls'

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
  const { data, loading, error, currentPage, pageSize, setPage, setPageSize, retry } =
    useRecordPreview(planId, role, objectApiName)

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
      <div className="py-8 text-center">
        <p className="text-sm text-muted-foreground">
          No records found{data ? ` (total: ${data.totalCount})` : ''}.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <RecordTable records={data.records} />
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
