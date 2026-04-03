// 019-text-document — Renders the generated HTML document in an iframe for in-app preview

'use client'

import type { TextDocumentStats } from '@/hooks/use-text-document'

interface TextDocumentPreviewProps {
  htmlContent: string
  stats: TextDocumentStats
  generatedAt: string
}

/**
 * Renders a text document HTML string inside an iframe (srcDoc).
 * Shows generation stats above the iframe.
 */
export function TextDocumentPreview({ htmlContent, stats, generatedAt }: TextDocumentPreviewProps) {
  const dateStr = new Date(generatedAt).toLocaleString()

  return (
    <div className="flex flex-col gap-4">
      {/* Stats bar */}
      <div className="flex flex-wrap gap-4 p-4 rounded-lg bg-muted/40 border text-sm">
        <StatBadge label="Fields mapped" value={stats.fieldCount} />
        <StatBadge label="Rules defined" value={stats.ruleCount} />
        <StatBadge
          label="Unmapped fields"
          value={stats.unmappedCount}
          highlight={stats.unmappedCount > 0 ? 'warning' : 'ok'}
        />
        <div className="ml-auto text-muted-foreground text-xs self-center">Generated {dateStr}</div>
      </div>

      {/* Document preview */}
      <div className="border rounded-lg overflow-hidden" style={{ height: '80vh' }}>
        <iframe
          srcDoc={htmlContent}
          title="Migration Plan Text Document"
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
        : 'text-foreground'

  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{label}:</span>
      <span className={`font-semibold tabular-nums ${textColor}`}>{value}</span>
    </div>
  )
}
