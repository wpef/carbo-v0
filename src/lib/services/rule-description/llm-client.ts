// 018-rule-description-engine — LLM client for PROMPT rule descriptions
// Uses raw fetch (same pattern as classification.ts) — no @anthropic-ai/sdk dependency.

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-3-haiku-20240307'

const DEFAULT_TIMEOUT_MS = parseInt(process.env.RULE_DESCRIPTION_LLM_TIMEOUT_MS ?? '15000', 10)

const FALLBACK_SUFFIX = '(requires review)'

/**
 * Result of describing a PROMPT rule via LLM.
 */
export interface LLMDescriptionResult {
  description: string
  source: 'llm' | 'fallback'
  latencyMs: number
}

/**
 * Call Claude to produce a plain-language explanation of a classification prompt.
 *
 * Falls back gracefully (no throw) when:
 *  - ANTHROPIC_API_KEY is not set
 *  - promptText is empty
 *  - The API call times out (configurable, default 15 s)
 *  - The API returns an error or an empty response
 *
 * Logs every call to console for audit-trail compatibility (Constitution Principle VI).
 */
export async function describePROMPT(
  promptText: string | undefined | null,
  destPicklistValues: string[] = [],
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<LLMDescriptionResult> {
  const start = Date.now()

  // Guard: empty prompt
  if (!promptText || promptText.trim() === '') {
    console.log('[rule-description][llm] SKIP — empty prompt text')
    return {
      description: `No classification prompt defined. ${FALLBACK_SUFFIX}`,
      source: 'fallback',
      latencyMs: Date.now() - start,
    }
  }

  // Guard: missing API key
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.log('[rule-description][llm] SKIP — ANTHROPIC_API_KEY not set, using fallback')
    return {
      description: `${promptText.trim()} ${FALLBACK_SUFFIX}`,
      source: 'fallback',
      latencyMs: Date.now() - start,
    }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const picklistHint =
      destPicklistValues.length > 0
        ? ` The destination field accepts the following values: ${destPicklistValues.join(', ')}.`
        : ''

    const userMessage =
      `You are helping a data migration consultant write a client-facing description. ` +
      `Given the following AI classification rule used during migration, produce a single plain-English sentence ` +
      `(no jargon, no markdown, maximum 2 sentences) explaining what the rule does.\n\n` +
      `Classification rule:\n"${promptText.trim()}"${picklistHint}\n\n` +
      `Respond with only the description sentence. Do not add preamble or metadata.`

    console.log('[rule-description][llm] Calling Claude API for PROMPT rule', {
      promptLength: promptText.length,
      timeoutMs,
    })

    const res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 256,
        messages: [{ role: 'user', content: userMessage }],
      }),
      signal: controller.signal,
    })

    const latencyMs = Date.now() - start

    if (!res.ok) {
      const errorBody = await res.text()
      console.warn('[rule-description][llm] API error', res.status, errorBody, { latencyMs })
      return {
        description: `${promptText.trim()} ${FALLBACK_SUFFIX}`,
        source: 'fallback',
        latencyMs,
      }
    }

    const data = (await res.json()) as {
      content?: Array<{ type: string; text: string }>
    }

    const text = data.content?.find((c) => c.type === 'text')?.text?.trim() ?? ''

    if (!text) {
      console.warn('[rule-description][llm] Empty response from Claude API, falling back', { latencyMs })
      return {
        description: `${promptText.trim()} ${FALLBACK_SUFFIX}`,
        source: 'fallback',
        latencyMs,
      }
    }

    console.log('[rule-description][llm] Success', { latencyMs, outputLength: text.length })

    return { description: text, source: 'llm', latencyMs }
  } catch (err) {
    const latencyMs = Date.now() - start
    const reason = err instanceof Error ? err.message : String(err)

    if (err instanceof Error && err.name === 'AbortError') {
      console.warn(`[rule-description][llm] Timeout after ${latencyMs}ms, falling back`)
    } else {
      console.error('[rule-description][llm] API error, falling back', { reason, latencyMs })
    }

    return {
      description: `${promptText.trim()} ${FALLBACK_SUFFIX}`,
      source: 'fallback',
      latencyMs,
    }
  } finally {
    clearTimeout(timer)
  }
}
