// 013-migration-logic — D2: LLM Classification Prompt section (text-to-picklist)
// Text area for prompt + 4-5 example rows with LLM classifications.
// Debounces prompt changes (1s) before re-triggering classification.

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { ClassifyResult } from '@/lib/types/mapping'

interface ClassificationPromptSectionProps {
  /** Destination picklist values to classify into */
  destinationValues: string[]
  /** Sample source values to classify (4-5 examples) */
  sampleSourceValues: string[]
  /** Initial prompt text (from saved migration logic) */
  initialPromptText: string
  /** Called when prompt text changes */
  onPromptChange: (promptText: string) => void
  /** Function to call for LLM classification */
  onClassify: (
    promptText: string,
    destinationValues: string[],
    sampleSourceValues: string[],
  ) => Promise<{ classifications: ClassifyResult[]; error?: string }>
}

const DEFAULT_PLACEHOLDER =
  'Classifie ce texte dans une des catégories suivantes'

export function ClassificationPromptSection({
  destinationValues,
  sampleSourceValues,
  initialPromptText,
  onPromptChange,
  onClassify,
}: ClassificationPromptSectionProps) {
  const [promptText, setPromptText] = useState(initialPromptText)
  const [classifications, setClassifications] = useState<ClassifyResult[]>([])
  const [classifying, setClassifying] = useState(false)
  const [classifyError, setClassifyError] = useState('')

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasSamplesRef = useRef(sampleSourceValues.length > 0)

  const runClassification = useCallback(
    async (text: string) => {
      if (sampleSourceValues.length === 0 || destinationValues.length === 0) return

      setClassifying(true)
      setClassifyError('')

      const result = await onClassify(text, destinationValues, sampleSourceValues)

      setClassifying(false)

      if (result.error) {
        setClassifyError(result.error)
        return
      }

      setClassifications(result.classifications)
    },
    [sampleSourceValues, destinationValues, onClassify],
  )

  // Run initial classification on mount (once)
  useEffect(() => {
    if (hasSamplesRef.current) {
      runClassification(initialPromptText)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally empty — run once on mount

  const handlePromptChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const text = e.target.value
      setPromptText(text)
      onPromptChange(text)

      // Debounce classification re-trigger
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        runClassification(text)
      }, 1000)
    },
    [onPromptChange, runClassification],
  )

  return (
    <div className="space-y-4">
      {/* Prompt editor */}
      <div>
        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
          Prompt de classification
        </label>
        <textarea
          value={promptText}
          onChange={handlePromptChange}
          placeholder={DEFAULT_PLACEHOLDER}
          rows={3}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </div>

      {/* Example classifications */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Exemples de classification
          {classifying && <span className="ml-2 font-normal text-primary animate-pulse">Classification en cours...</span>}
        </p>

        {sampleSourceValues.length === 0 ? (
          <div className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground text-center">
            Connectez-vous au système source pour voir les exemples de classification.
          </div>
        ) : classifyError ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
            {classifyError}
          </div>
        ) : (
          <div className="rounded-md border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 border-b border-border">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Valeur source
                  </th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Classification
                  </th>
                </tr>
              </thead>
              <tbody>
                {sampleSourceValues.map((val, idx) => {
                  const result = classifications.find((c) => c.sourceValue === val)
                  const classification = result?.classification ?? (classifying ? '...' : null)
                  const hasError = result?.error

                  return (
                    <tr key={idx} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 text-foreground truncate max-w-[200px]">{val}</td>
                      <td className="px-3 py-2">
                        {hasError ? (
                          <span className="text-amber-600 text-xs">{result?.error}</span>
                        ) : classification ? (
                          <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                            {classification}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Destination values hint */}
      <p className="text-xs text-muted-foreground">
        Catégories : {destinationValues.map((v) => `"${v}"`).join(', ')}
      </p>
    </div>
  )
}
