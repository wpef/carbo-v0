// 020-contractual-document — Renders the generated contractual HTML in an iframe for in-app preview

'use client'

import type { ContractualDocumentStats } from '@/hooks/use-contractual-document'

interface ContractualDocumentViewProps {
  htmlContent: string
  referenceNumber: string
  stats: ContractualDocumentStats
  generatedAt: string
}

/**
 * Renders a contractual document HTML string inside an iframe (srcDoc).
 * Shows reference number and generation stats above the iframe.
 * Formal styling is distinct from the text document preview.
 */
export function ContractualDocumentView({
  htmlContent,
  referenceNumber,
  stats,
  generatedAt,
}: ContractualDocumentViewProps) {
  const dateStr = new Date(generatedAt).toLocaleString()

  return (
    <div className="flex flex-col gap-4">
      {/* Reference + stats bar */}
      <div className="flex flex-wrap items-center gap-4 p-4 rounded-lg border border-gray-300 bg-gray-50 text-sm font-serif">
        <div className="flex items-center gap-2">
          <span className="text-gray-500 font-sans text-xs uppercase tracking-wider">Reference</span>
          <span className="font-bold text-gray-800 tabular-nums">{referenceNumber}</span>
        </div>

        <div className="h-4 border-l border-gray-300" />

        <StatBadge label="Fields" value={stats.fieldCount} />
        <StatBadge label="Rules" value={stats.ruleCount} />
        <StatBadge
          label="Unmapped"
          value={stats.unmappedCount}
          highlight={stats.unmappedCount > 0 ? 'warning' : 'ok'}
        />
        <StatBadge label="Filters" value={stats.filterCount} />

        <div className="ml-auto text-gray-400 text-xs font-sans self-center">Generated {dateStr}</div>
      </div>

      {/* Formal document preview */}
      <div className="border-2 border-gray-400 rounded overflow-hidden" style={{ height: '80vh' }}>
        <iframe
          srcDoc={htmlContent}
          title="Contractual Migration Specification"
          className="w-full h-full"
          sandbox="allow-same-origin"
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-component
// ---------------------------------------------------------------------------

interface StatBadgeProps {
  label: string
  value: number
  highlight?: 'ok' | 'warning'
}

function StatBadge({ label, value, highlight }: StatBadgeProps) {
  const textColor =
    highlight === 'warning' && value > 0
      ? 'text-amber-700'
      : highlight === 'ok'
        ? 'text-emerald-700'
        : 'text-gray-800'

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-gray-500 font-sans text-xs uppercase tracking-wider">{label}:</span>
      <span className={`font-bold tabular-nums font-sans ${textColor}`}>{value}</span>
    </div>
  )
}
