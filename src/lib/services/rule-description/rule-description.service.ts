// 018-rule-description-engine — Batch orchestration service

import type { DescriptionRequest, DescriptionBatch, RuleDescription } from './types'
import { describeValueEquivalence, describeInformational, describeError, describeUnknown } from './templates'
import { describePROMPT } from './llm-client'

/**
 * Generate human-readable descriptions for a list of migration logic rules.
 *
 * Dispatches template rules synchronously and PROMPT rules concurrently via `Promise.allSettled`.
 * Returns all descriptions in the same order as the input, even if some LLM calls fail.
 * Logs a batch summary to console (Constitution Principle VII).
 */
export async function generateDescriptions(rules: DescriptionRequest[]): Promise<DescriptionBatch> {
  const start = Date.now()

  // Separate PROMPT rules from template rules so we can batch LLM calls
  const results: (RuleDescription | null)[] = new Array(rules.length).fill(null)

  // 1. Resolve all non-PROMPT rules synchronously (no I/O)
  const promptIndices: number[] = []

  for (let i = 0; i < rules.length; i++) {
    const req = rules[i]

    switch (req.logicType) {
      case 'VALUE_EQUIVALENCE': {
        const description = describeValueEquivalence(req.valueEquivalences ?? [])
        results[i] = {
          ruleId: req.ruleId,
          logicType: req.logicType,
          description,
          source: 'template',
        }
        break
      }
      case 'INFORMATIONAL': {
        const description = describeInformational(req.informationalMessage)
        results[i] = {
          ruleId: req.ruleId,
          logicType: req.logicType,
          description,
          source: 'template',
        }
        break
      }
      case 'ERROR': {
        const description = describeError(req.sourceType, req.destType)
        results[i] = {
          ruleId: req.ruleId,
          logicType: req.logicType,
          description,
          source: 'template',
        }
        break
      }
      case 'PROMPT': {
        promptIndices.push(i)
        break
      }
      default: {
        results[i] = {
          ruleId: req.ruleId,
          logicType: req.logicType,
          description: describeUnknown(),
          source: 'fallback',
        }
      }
    }
  }

  // 2. Resolve PROMPT rules concurrently
  if (promptIndices.length > 0) {
    const promptTasks = promptIndices.map((idx) => {
      const req = rules[idx]
      return describePROMPT(req.promptText, req.destPicklistValues ?? [])
    })

    const settled = await Promise.allSettled(promptTasks)

    for (let k = 0; k < promptIndices.length; k++) {
      const idx = promptIndices[k]
      const req = rules[idx]
      const outcome = settled[k]

      if (outcome.status === 'fulfilled') {
        const { description, source, latencyMs } = outcome.value
        results[idx] = {
          ruleId: req.ruleId,
          logicType: req.logicType,
          description,
          source,
          latencyMs,
        }
      } else {
        // Should not happen because describePROMPT never throws, but guard defensively
        console.error('[rule-description][batch] Unexpected rejection for PROMPT rule', {
          ruleId: req.ruleId,
          reason: outcome.reason,
        })
        results[idx] = {
          ruleId: req.ruleId,
          logicType: req.logicType,
          description: `${req.promptText?.trim() ?? ''} (requires review)`,
          source: 'fallback',
          latencyMs: 0,
        }
      }
    }
  }

  // 3. Compute stats
  const descriptions = results as RuleDescription[]
  let templateCount = 0
  let llmCount = 0
  let fallbackCount = 0
  let totalLatencyMs = 0

  for (const d of descriptions) {
    if (d.source === 'template') templateCount++
    else if (d.source === 'llm') llmCount++
    else fallbackCount++

    if (d.latencyMs) totalLatencyMs += d.latencyMs
  }

  const batchDuration = Date.now() - start

  console.log('[rule-description][batch] Complete', {
    total: descriptions.length,
    templateCount,
    llmCount,
    fallbackCount,
    totalLatencyMs,
    batchDurationMs: batchDuration,
  })

  return {
    descriptions,
    stats: {
      templateCount,
      llmCount,
      fallbackCount,
      totalLatencyMs,
    },
  }
}
