// 017-mapping-integrity-check — IntegrityCheckPanel component (v4)
// Shows the integrity check result for a plan.
// - Green banner when all mappings are healthy
// - Red section for BROKEN_REFERENCE issues with Repair button (Principle IX: explicit only)
// - Warning section for UNMAPPED_REQUIRED_FIELD / INCOMPATIBLE_TYPE / INVALID_FILTER

'use client'

import { useState } from 'react'
import { CheckCircle, AlertTriangle, XCircle, ChevronDown, ChevronRight, RefreshCw, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { IntegrityCheckResult, IntegrityIssueDTO } from '../types'

// ─── Issue row ─────────────────────────────────────────────────────────────────

interface IssueRowProps {
  issue: IntegrityIssueDTO
  onResolve?: (issueId: string) => void
  resolving?: boolean
}

function IssueRow({ issue, onResolve, resolving }: IssueRowProps) {
  const isError = issue.severity === 'ERROR'
  const colorCls = isError
    ? 'bg-red-50 border-red-100 text-red-800'
    : 'bg-amber-50 border-amber-100 text-amber-800'
  const iconCls = isError ? 'text-red-500' : 'text-amber-500'
  const msgCls = isError ? 'text-red-600' : 'text-amber-600'

  return (
    <div className={`flex items-start gap-2 px-2 py-1.5 rounded text-sm border ${colorCls}`}>
      {isError ? (
        <XCircle className={`h-4 w-4 ${iconCls} mt-0.5 shrink-0`} />
      ) : (
        <AlertTriangle className={`h-4 w-4 ${iconCls} mt-0.5 shrink-0`} />
      )}
      <div className="min-w-0 flex-1">
        <span className="font-medium text-xs uppercase tracking-wide opacity-60">{issue.issueType.replace(/_/g, ' ')}</span>
        <p className={`${msgCls} text-xs mt-0.5`}>{issue.message}</p>
      </div>
      {onResolve && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs shrink-0"
          disabled={resolving}
          onClick={() => onResolve(issue.id)}
        >
          Résoudre
        </Button>
      )}
    </div>
  )
}

// ─── Collapsible section ───────────────────────────────────────────────────────

interface SectionProps {
  title: string
  count: number
  variant: 'red' | 'amber'
  defaultOpen?: boolean
  children: React.ReactNode
}

function CollapsibleSection({ title, count, variant, defaultOpen = true, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  if (count === 0) return null

  const colorCls = variant === 'red' ? 'text-red-700' : 'text-amber-700'

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 text-sm font-medium ${colorCls} hover:opacity-80 transition-opacity mb-1`}
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        {title} ({count})
      </button>
      {open && <div className="space-y-1 ml-1">{children}</div>}
    </div>
  )
}

// ─── Main panel ────────────────────────────────────────────────────────────────

export interface IntegrityCheckPanelProps {
  result: IntegrityCheckResult
  repairing?: boolean
  resolving?: string | null
  onRepair?: () => void
  onRefresh?: () => void
  onResolveIssue?: (issueId: string) => void
}

/**
 * Displays the integrity check result for a plan.
 *
 * - Healthy: green banner
 * - Issues found: grouped by severity, broken references get a Repair button
 *   (Principle IX: repair is always explicit user action, never automatic)
 */
export function IntegrityCheckPanel({
  result,
  repairing,
  resolving,
  onRepair,
  onRefresh,
  onResolveIssue,
}: IntegrityCheckPanelProps) {
  const { issues, unresolvedIssues, checkedAt, planStatus } = result

  const errorIssues = issues.filter((i) => i.severity === 'ERROR')
  const warningIssues = issues.filter((i) => i.severity === 'WARNING')
  const brokenRefIssues = issues.filter((i) => i.issueType === 'BROKEN_REFERENCE')

  if (unresolvedIssues === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
        <CheckCircle className="h-4 w-4 shrink-0" />
        <span>Tous les mappings sont cohérents avec le schéma actuel.</span>
        <span className="ml-auto text-xs text-green-600">
          {new Date(checkedAt).toLocaleTimeString()}
        </span>
        {onRefresh && (
          <Button variant="ghost" size="sm" onClick={onRefresh} className="h-6 text-xs ml-1">
            <RefreshCw className="h-3 w-3" />
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-red-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border-b border-red-200">
        <XCircle className="h-4 w-4 text-red-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-red-800">
            {planStatus === 'BROKEN' ? 'Plan BROKEN' : 'Problèmes d\'intégrité'}
          </p>
          <p className="text-xs text-red-600">
            {unresolvedIssues} problème{unresolvedIssues !== 1 ? 's' : ''} non résolu{unresolvedIssues !== 1 ? 's' : ''}
            {errorIssues.length > 0 && ` · ${errorIssues.length} erreur${errorIssues.length !== 1 ? 's' : ''}`}
            {warningIssues.length > 0 && ` · ${warningIssues.length} avertissement${warningIssues.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onRefresh && (
            <Button variant="ghost" size="sm" onClick={onRefresh} className="h-7 text-xs">
              <RefreshCw className="h-3 w-3 mr-1" />
              Vérifier
            </Button>
          )}
          {brokenRefIssues.length > 0 && onRepair && (
            <Button
              variant="destructive"
              size="sm"
              onClick={onRepair}
              disabled={repairing}
              className="h-7 text-xs"
            >
              <Wrench className="h-3 w-3 mr-1" />
              {repairing ? 'Réparation…' : 'Supprimer les cassés'}
            </Button>
          )}
        </div>
        <span className="text-xs text-red-400 shrink-0">{new Date(checkedAt).toLocaleTimeString()}</span>
      </div>

      {/* Issue groups */}
      <div className="px-4 py-3 space-y-3">
        <CollapsibleSection
          title="Références cassées (BROKEN_REFERENCE)"
          count={brokenRefIssues.length}
          variant="red"
        >
          {brokenRefIssues.map((issue) => (
            <IssueRow
              key={issue.id}
              issue={issue}
              onResolve={onResolveIssue}
              resolving={resolving === issue.id}
            />
          ))}
        </CollapsibleSection>

        <CollapsibleSection
          title="Types incompatibles (INCOMPATIBLE_TYPE)"
          count={issues.filter((i) => i.issueType === 'INCOMPATIBLE_TYPE').length}
          variant="red"
        >
          {issues
            .filter((i) => i.issueType === 'INCOMPATIBLE_TYPE')
            .map((issue) => (
              <IssueRow
                key={issue.id}
                issue={issue}
                onResolve={onResolveIssue}
                resolving={resolving === issue.id}
              />
            ))}
        </CollapsibleSection>

        <CollapsibleSection
          title="Champs requis non mappés (UNMAPPED_REQUIRED_FIELD)"
          count={issues.filter((i) => i.issueType === 'UNMAPPED_REQUIRED_FIELD').length}
          variant="amber"
        >
          {issues
            .filter((i) => i.issueType === 'UNMAPPED_REQUIRED_FIELD')
            .map((issue) => (
              <IssueRow
                key={issue.id}
                issue={issue}
                onResolve={onResolveIssue}
                resolving={resolving === issue.id}
              />
            ))}
        </CollapsibleSection>

        <CollapsibleSection
          title="Filtres invalides (INVALID_FILTER)"
          count={issues.filter((i) => i.issueType === 'INVALID_FILTER').length}
          variant="red"
        >
          {issues
            .filter((i) => i.issueType === 'INVALID_FILTER')
            .map((issue) => (
              <IssueRow
                key={issue.id}
                issue={issue}
                onResolve={onResolveIssue}
                resolving={resolving === issue.id}
              />
            ))}
        </CollapsibleSection>
      </div>
    </div>
  )
}
