// 013-migration-logic — D2: LLM Classification Prompt section (text→picklist)
// Prompt textarea + debounced classification preview table.
// Ported from v3 src/components/mapping/ClassificationPromptSection.tsx

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { ClassifyResult } from '../services/classify-service'

interface ClassificationPromptSectionProps {
  destinationValues: string[]
  sampleSourceValues: string[]
  initialPromptText: string
  onPromptChange: (text: string) => void
  onClassify: (
    promptText: string,
    destinationValues: string[],
    sampleSourceValues: string[],
  ) => Promise<{ classifications: ClassifyResult[]; error?: string }>
}

const DEFAULT_PLACEHOLDER = 'Classifie ce texte dans une des catégories suivantes'

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
  const hasSamples = sampleSourceValues.length > 0

  const runClassification = useCallback(
    async (text: string) => {
      if (!hasSamples || destinationValues.length === 0) return
      setClassifying(true)
      setClassifyError('')
      const result = await onClassify(text, destinationValues, sampleSourceValues)
      setClassifying(false)
      if (result.error && result.classifications.length === 0) {
        setClassifyError(result.error)
        return
      }
      setClassifications(result.classifications)
    },
    [hasSamples, destinationValues, sampleSourceValues, onClassify],
  )

  // Run initial classification once on mount
  useEffect(() => {
    if (hasSamples) runClassification(initialPromptText)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const text = e.target.value
      setPromptText(text)
      onPromptChange(text)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => runClassification(text), 1000)
    },
    [onPromptChange, runClassification],
  )

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
          Prompt de classification
        </label>
        <textarea
          value={promptText}
          onChange={handleChange}
          placeholder={DEFAULT_PLACEHOLDER}
          rows={3}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </div>

      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Exemples de classification
          {classifying && (
            <span className="ml-2 font-normal text-primary animate-pulse">Classification en cours…</span>
          )}
        </p>

        {!hasSamples ? (
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
                  const classified = result?.classifiedValue ?? (classifying ? '…' : null)
                  return (
                    <tr key={idx} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 text-foreground truncate max-w-[200px]">{val}</td>
                      <td className="px-3 py-2">
                        {result?.error && !result.classifiedValue ? (
                          <span className="text-amber-600 text-xs">{result.error}</span>
                        ) : classified ? (
                          <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                            {classified}
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

      <p className="text-xs text-muted-foreground">
        Catégories : {destinationValues.map((v) => `"${v}"`).join(', ')}
      </p>
    </div>
  )
}
