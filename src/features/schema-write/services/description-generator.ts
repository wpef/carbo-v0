// 022-schema-write — LLM description generator (T007)
//
// STUB — deterministic implementation (TODO: real Claude API call).
// Per task instructions: do NOT call any external API; return a deterministic
// result that is clearly marked as a stub. The real implementation would call
// the Claude API with the assembled prompt.
//
// When ANTHROPIC_API_KEY is absent, throws LLM_UNAVAILABLE (FR-006).

import type { GenerateDescriptionRequest, GenerateDescriptionResponse } from '@/lib/types/schema-write'

export class LlmUnavailableError extends Error {
  readonly code = 'LLM_UNAVAILABLE'
  constructor(reason: string) {
    super(reason)
    this.name = 'LlmUnavailableError'
  }
}

/**
 * Generate a field description using the Claude API. (FR-005)
 *
 * STUB: returns a deterministic description for testing/demo purposes.
 * TODO: replace with real `@anthropic-ai/sdk` call when API key is available.
 *
 * Throws `LlmUnavailableError` (code: 'LLM_UNAVAILABLE') when:
 * - The ANTHROPIC_API_KEY environment variable is not set.
 * - (Real impl) The Claude API returns an error or times out.
 */
export async function generateDescription(
  context: GenerateDescriptionRequest,
): Promise<GenerateDescriptionResponse> {
  console.log(`[DescriptionGenerator] Generating description for '${context.fieldName}' on '${context.objectLabel}'`)

  // FR-006: API key required
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new LlmUnavailableError(
      'LLM description generation is unavailable. ANTHROPIC_API_KEY is not configured. Please write the description manually.',
    )
  }

  // ── STUB: deterministic description ──────────────────────────────────────
  // TODO: replace this block with the actual Claude API call:
  //
  //   import Anthropic from '@anthropic-ai/sdk'
  //   const client = new Anthropic()
  //   const message = await client.messages.create({
  //     model: 'claude-sonnet-4-20250514',
  //     max_tokens: 200,
  //     system: 'You are a CRM data migration expert. Write concise, professional field descriptions.',
  //     messages: [{
  //       role: 'user',
  //       content: buildPrompt(context),
  //     }],
  //   })
  //   const description = (message.content[0] as { type: 'text'; text: string }).text
  //   return { description, model: message.model, tokensUsed: message.usage.input_tokens + message.usage.output_tokens }
  //
  // ─────────────────────────────────────────────────────────────────────────

  const typeLabel: Record<string, string> = {
    string: 'text',
    number: 'numeric',
    date: 'date',
    datetime: 'date-time',
    enumeration: 'picklist',
    bool: 'boolean',
  }

  const readableType = typeLabel[context.fieldType] ?? context.fieldType
  const companyCtx = context.companyContext ? ` Used in the context of: ${context.companyContext}.` : ''

  const description =
    `${context.fieldName} — ${readableType} field on the ${context.objectLabel} object.` +
    ` Stores the ${context.fieldName.replace(/_/g, ' ')} value for each record.` +
    companyCtx +
    ' [STUB — TODO: replace with Claude API call]'

  console.log(`[DescriptionGenerator] Stub response generated (0 tokens — STUB mode)`)

  return {
    description,
    model: 'stub-deterministic',
    tokensUsed: 0,
  }
}
