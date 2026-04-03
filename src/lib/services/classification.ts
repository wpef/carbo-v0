// 013-migration-logic — LLM Classification Service using Claude API (via fetch)
// Handles D2 (text-to-picklist) classification preview.

import type { ClassifyResult } from '@/lib/types/mapping'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-3-haiku-20240307'
const FALLBACK_ERROR = 'Classification unavailable -- check ANTHROPIC_API_KEY'

/**
 * Build a structured prompt for classifying a single source value.
 */
function buildPrompt(userInstruction: string, destValues: string[], sampleValue: string): string {
  return [
    `You are a data classification assistant. Your task is to classify a text value into exactly one of the provided categories.`,
    ``,
    `Categories: ${destValues.map((v) => `"${v}"`).join(', ')}`,
    ``,
    `User instruction: ${userInstruction || 'Classify this text into one of the given categories based on its meaning.'}`,
    ``,
    `Value to classify: "${sampleValue}"`,
    ``,
    `Respond with only the category name, exactly as written above. Do not add any explanation.`,
  ].join('\n')
}

/**
 * Classify a single source value via the Claude API.
 * Returns the classification string, or null with an error message on failure.
 */
async function classifyOne(
  apiKey: string,
  userInstruction: string,
  destValues: string[],
  sampleValue: string,
): Promise<ClassifyResult> {
  const prompt = buildPrompt(userInstruction, destValues, sampleValue)

  console.log('[classification] LLM call', { sampleValue, model: MODEL })

  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 64,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      const errorBody = await res.text()
      console.error('[classification] API error', res.status, errorBody)
      return { sourceValue: sampleValue, classification: null, error: FALLBACK_ERROR }
    }

    const data = (await res.json()) as {
      content?: Array<{ type: string; text: string }>
    }

    const text = data.content?.find((c) => c.type === 'text')?.text?.trim() ?? null

    // Validate that the response is one of the valid destination values (case-insensitive)
    const matched = destValues.find((v) => v.toLowerCase() === (text?.toLowerCase() ?? ''))
    const classification = matched ?? text

    console.log('[classification] result', { sampleValue, classification })
    return { sourceValue: sampleValue, classification }
  } catch (err) {
    console.error('[classification] fetch error', err)
    return { sourceValue: sampleValue, classification: null, error: FALLBACK_ERROR }
  }
}

/**
 * Classify multiple sample values in parallel.
 * Falls back gracefully if ANTHROPIC_API_KEY is not configured.
 *
 * @param promptText - User-supplied classification instruction
 * @param destValues - Valid destination picklist values
 * @param sampleValues - 4-5 source record values to classify
 */
export async function classify(
  promptText: string,
  destValues: string[],
  sampleValues: string[],
): Promise<ClassifyResult[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    console.warn('[classification] ANTHROPIC_API_KEY not set — returning fallback for all values')
    return sampleValues.map((v) => ({
      sourceValue: v,
      classification: null,
      error: FALLBACK_ERROR,
    }))
  }

  // Run all classifications in parallel
  const results = await Promise.all(
    sampleValues.map((value) => classifyOne(apiKey, promptText, destValues, value)),
  )

  return results
}
