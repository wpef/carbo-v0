// 018-rule-description-engine — POST /api/plans/[planId]/rule-descriptions
//
// Loads all MigrationLogic + associated data for the plan, then calls
// generateDescriptions() to produce a DescriptionBatch.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { logAction } from '@/lib/services/audit-service'
import { generateDescriptions } from '@/lib/services/rule-description'
import type { DescriptionRequest } from '@/lib/services/rule-description'
import type { SectionType } from '@/lib/types/mapping'

type RouteParams = { params: Promise<{ planId: string }> }

/**
 * POST /api/plans/[planId]/rule-descriptions
 *
 * Generates human-readable descriptions for all migration logic rules in the plan.
 * Returns a DescriptionBatch with descriptions + stats.
 *
 * Logs to audit trail (Constitution Principle VI).
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { planId } = await params

  try {
    // Verify plan exists
    const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
    if (!plan) {
      return NextResponse.json({ error: 'PLAN_NOT_FOUND', message: `Plan not found: ${planId}` }, { status: 404 })
    }

    // Load all object mappings → field mappings → migration logic + children
    const objectMappings = await prisma.objectMapping.findMany({
      where: { planId },
      include: {
        fieldMappings: {
          include: {
            migrationLogic: {
              include: {
                valueEquivalences: true,
                classificationPrompt: true,
              },
            },
          },
        },
      },
    })

    // Build DescriptionRequest list
    const requests: DescriptionRequest[] = []

    for (const om of objectMappings) {
      for (const fm of om.fieldMappings) {
        const logic = fm.migrationLogic
        if (!logic) continue

        const req: DescriptionRequest = {
          ruleId: logic.id,
          logicType: logic.sectionType as SectionType,
        }

        switch (logic.sectionType as SectionType) {
          case 'VALUE_EQUIVALENCE':
            req.valueEquivalences = logic.valueEquivalences.map((ve) => ({
              sourceValue: ve.sourceValue,
              destinationValue: ve.destinationValue,
            }))
            break
          case 'INFORMATIONAL':
            // The informational message may be stored in a classificationPrompt row with a special convention,
            // or directly in status. For now, use promptText if available, else empty.
            req.informationalMessage = logic.classificationPrompt?.promptText ?? undefined
            break
          case 'ERROR':
            // type info comes from FieldMapping typeCompatibility — we parse it as best-effort
            req.sourceType = fm.sourceFieldApiName ? `(${fm.sourceFieldApiName} type)` : undefined
            req.destType = fm.destFieldApiName ? `(${fm.destFieldApiName} type)` : undefined
            break
          case 'PROMPT':
            req.promptText = logic.classificationPrompt?.promptText ?? undefined
            break
        }

        requests.push(req)
      }
    }

    console.log(`[rule-descriptions] Generating descriptions for ${requests.length} rules in plan ${planId}`)

    const batch = await generateDescriptions(requests)

    await logAction(planId, 'RULE_DESCRIPTIONS_GENERATED', {
      ruleCount: requests.length,
      templateCount: batch.stats.templateCount,
      llmCount: batch.stats.llmCount,
      fallbackCount: batch.stats.fallbackCount,
    })

    return NextResponse.json(batch)
  } catch (err) {
    console.error('[POST /rule-descriptions]', err)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Unexpected error.' }, { status: 500 })
  }
}
