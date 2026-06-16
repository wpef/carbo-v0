// 013-migration-logic — Classification service (D2: text→picklist)
//
// TODO: replace stub with real Claude API call when ANTHROPIC_API_KEY is wired.
// See v3 src/lib/services/classification.ts for the production implementation pattern.
//
// Current stub: deterministic fallback — maps each source value to the first destination
// value whose lowercase label contains the source value lowercase (or vice versa).
// If no inclusion match, falls back to the first destination value.
// This keeps D2 usable in dev/demo without an API key.

export interface ClassifyResult {
  sourceValue: string
  classifiedValue: string | null
  error?: string
}

const STUB_FALLBACK_NOTE =
  'Classification unavailable — check LLM configuration'

/**
 * Deterministic stub classifier: picks the best-matching destination value via
 * case-insensitive substring inclusion, falling back to destValues[0].
 *
 * TODO: replace with Claude API call (see v3 classify service for reference).
 */
function stubClassify(sourceValue: string, destValues: string[]): string | null {
  if (destValues.length === 0) return null
  const src = sourceValue.toLowerCase().trim()
  // Try direct inclusion both ways
  const match =
    destValues.find((dv) => dv.toLowerCase().includes(src)) ??
    destValues.find((dv) => src.includes(dv.toLowerCase()))
  return match ?? destValues[0]
}

/**
 * Classify multiple source values into one of the destination picklist values.
 *
 * When ANTHROPIC_API_KEY is present — TODO: call Claude API.
 * When absent — use deterministic stub with a logged warning.
 *
 * @param _promptText   User-supplied classification instruction (used by LLM, ignored by stub)
 * @param destValues    Valid destination picklist values
 * @param sampleValues  4-5 source record values to classify
 */
export async function classify(
  _promptText: string,
  destValues: string[],
  sampleValues: string[],
): Promise<ClassifyResult[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    console.warn('[classify] ANTHROPIC_API_KEY not set — using deterministic stub')
    return sampleValues.map((v) => ({
      sourceValue: v,
      classifiedValue: stubClassify(v, destValues),
      error: STUB_FALLBACK_NOTE,
    }))
  }

  // TODO: implement real LLM call via @anthropic-ai/sdk or fetch to Anthropic API.
  // Reference pattern: v3 recette src/lib/services/classification.ts
  // - Build a structured prompt constraining output to one of destValues
  // - Classify each sampleValue independently (Promise.all)
  // - Validate response is one of destValues (case-insensitive)
  // - Return ClassifyResult[] with null + error on LLM failure
  console.warn('[classify] ANTHROPIC_API_KEY present but LLM call not yet implemented — using stub')
  return sampleValues.map((v) => ({
    sourceValue: v,
    classifiedValue: stubClassify(v, destValues),
    error: STUB_FALLBACK_NOTE,
  }))
}
