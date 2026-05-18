interface ValueEquivalenceInput {
  sourceFieldName: string
  destinationFieldName: string
  equivalences: { sourceValue: string; destinationValue: string }[]
}

interface FieldMappingDescription {
  sourceFieldName: string
  destinationFieldName: string
  sourceType: string
  destType: string
  description: string
  ruleType: 'DIRECT_COPY' | 'VALUE_EQUIVALENCE' | 'INCOMPATIBLE' | 'NONE'
}

export function describeDirectCopy(sourceType: string, destType: string): string {
  if (sourceType === destType) {
    return `Copie directe (${sourceType} → ${destType})`
  }
  return `Copie avec conversion de type (${sourceType} → ${destType})`
}

export function describeValueEquivalence(input: ValueEquivalenceInput): string {
  const { equivalences } = input
  if (equivalences.length === 0) {
    return 'Table de correspondance vide — aucune valeur définie'
  }

  const shown = equivalences.slice(0, 5)
  const lines = shown.map((eq) => `"${eq.sourceValue}" → "${eq.destinationValue}"`)
  let text = `Table de correspondance :\n${lines.join('\n')}`

  if (equivalences.length > 5) {
    text += `\n... et ${equivalences.length - 5} autres correspondance(s)`
  }

  return text
}

export function describeIncompatible(sourceType: string, destType: string): string {
  return `Types incompatibles (${sourceType} → ${destType}). Ce champ ne sera pas migré automatiquement.`
}

export function generateFieldMappingDescriptions(
  fieldMappings: {
    sourceFieldName: string
    destinationFieldName: string
    compatibilityStatus: string
    migrationLogic: {
      status: string
      valueEquivalences: { sourceValue: string; destinationValue: string }[]
    } | null
  }[],
  sourceFields: Map<string, { dataType: string }>,
  destFields: Map<string, { dataType: string }>,
): FieldMappingDescription[] {
  return fieldMappings.map((fm) => {
    const srcType = sourceFields.get(fm.sourceFieldName)?.dataType ?? 'unknown'
    const dstType = destFields.get(fm.destinationFieldName)?.dataType ?? 'unknown'

    if (fm.compatibilityStatus === 'INCOMPATIBLE') {
      return {
        sourceFieldName: fm.sourceFieldName,
        destinationFieldName: fm.destinationFieldName,
        sourceType: srcType,
        destType: dstType,
        description: describeIncompatible(srcType, dstType),
        ruleType: 'INCOMPATIBLE' as const,
      }
    }

    if (fm.migrationLogic && fm.migrationLogic.valueEquivalences.length > 0) {
      return {
        sourceFieldName: fm.sourceFieldName,
        destinationFieldName: fm.destinationFieldName,
        sourceType: srcType,
        destType: dstType,
        description: describeValueEquivalence({
          sourceFieldName: fm.sourceFieldName,
          destinationFieldName: fm.destinationFieldName,
          equivalences: fm.migrationLogic.valueEquivalences,
        }),
        ruleType: 'VALUE_EQUIVALENCE' as const,
      }
    }

    return {
      sourceFieldName: fm.sourceFieldName,
      destinationFieldName: fm.destinationFieldName,
      sourceType: srcType,
      destType: dstType,
      description: describeDirectCopy(srcType, dstType),
      ruleType: 'DIRECT_COPY' as const,
    }
  })
}
