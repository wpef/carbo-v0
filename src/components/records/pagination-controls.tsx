// 009-record-preview — Pagination controls component

'use client'

interface PaginationControlsProps {
  currentPage: number
  totalCount: number
  pageSize: number
  hasNextPage: boolean
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
}

const PAGE_SIZE_OPTIONS = [25, 50, 100]

export function PaginationControls({
  currentPage,
  totalCount,
  pageSize,
  hasNextPage,
  onPageChange,
  onPageSizeChange,
}: PaginationControlsProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const hasPrev = currentPage > 1

  return (
    <div className="flex items-center justify-between gap-4 pt-3 text-sm">
      {/* Left: total count + page size selector */}
      <div className="flex items-center gap-3 text-muted-foreground">
        <span>{totalCount.toLocaleString()} records</span>
        {onPageSizeChange && (
          <label className="flex items-center gap-1">
            <span className="text-xs">Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="text-xs border rounded px-1 py-0.5 bg-background"
            >
              {PAGE_SIZE_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {/* Right: page indicator + prev/next */}
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-xs">
          Page {currentPage} of {totalPages}
        </span>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!hasPrev}
          className="px-2 py-1 text-xs border rounded disabled:opacity-40 hover:bg-muted transition-colors"
        >
          &larr; Prev
        </button>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!hasNextPage}
          className="px-2 py-1 text-xs border rounded disabled:opacity-40 hover:bg-muted transition-colors"
        >
          Next &rarr;
        </button>
      </div>
    </div>
  )
}
