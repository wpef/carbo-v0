// 012-field-mapping + 013-migration-logic — Link status computation.
// Pure TypeScript — no DB, no Prisma, no React, no network calls.
//
// Spec 012 §LinkStatus precedence: BROKEN > RED_DASHED > RED_SOLID > ORANGE > GREEN

import { getSectionType } from './type-compatibility'
import type { SectionType } from './type-compatibility'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type LinkStatus = 'GREEN' | 'ORANGE' | 'RED_SOLID' | 'RED_DASHED' | 'BROKEN'
export type MigrationLogicStatus = 'DRAFT' | 'DEFINED' | 'VALIDATED'

export interface MigrationLogicSnapshot {
  status: MigrationLogicStatus
  /** Source picklist values (for D1 completeness check). */
  sourceValues?: string[]
  /** Destination picklist values (for D1 completeness check). */
  destValues?: string[]
  /** Already-mapped sourceValue strings (for D1 completeness check). */
  mappedSourceValues?: string[]
}

export interface ComputeLinkStatusResult {
  linkStatus: LinkStatus
  /** Human-readable detail for partial or broken states. */
  statusDetail?: string
}

// ─── computeLinkStatus ─────────────────────────────────────────────────────────

/**
 * Computes the visual link status for a field mapping.
 *
 * Precedence (spec 012): BROKEN > RED_DASHED > RED_SOLID > ORANGE > GREEN
 *
 * @param sourceType         Raw dataType of the source field (e.g. "picklist", "string")
 * @param destType           Raw dataType of the destination field
 * @param migrationLogic     Snapshot of the MigrationLogic record, or null if none exists
 * @param sourceFieldExists  false when the source field is absent from the current schema
 * @param destFieldExists    false when the destination field is absent from the current schema
 */
export function computeLinkStatus(
  sourceType: string,
  destType: string,
  migrationLogic: MigrationLogicSnapshot | null,
  sourceFieldExists = true,
  destFieldExists = true,
): ComputeLinkStatusResult {
  // ── BROKEN (017) — field no longer exists in the current snapshot ─────────
  if (!sourceFieldExists && !destFieldExists) {
    return {
      linkStatus: 'BROKEN',
      statusDetail: 'Champs source et destination introuvables dans le schéma actuel',
    }
  }
  if (!sourceFieldExists) {
    return { linkStatus: 'BROKEN', statusDetail: 'Champ source introuvable dans le schéma actuel' }
  }
  if (!destFieldExists) {
    return { linkStatus: 'BROKEN', statusDetail: 'Champ destination introuvable dans le schéma actuel' }
  }

  const sectionType: SectionType = getSectionType(sourceType, destType)

  // ── D3 (ERROR) — types are incompatible; no logic can fix this ───────────
  if (sectionType === 'ERROR') return { linkStatus: 'RED_DASHED' }

  // ── D4 (INFORMATIONAL) — direct copy; auto-validated ─────────────────────
  if (sectionType === 'INFORMATIONAL') return { linkStatus: 'GREEN' }

  // ── D1 / D2 — configuration required ─────────────────────────────────────
  if (!migrationLogic || migrationLogic.status === 'DRAFT') {
    return { linkStatus: 'RED_SOLID' }
  }

  // Logic exists (DEFINED or VALIDATED) — check completeness for D1
  if (sectionType === 'VALUE_EQUIVALENCE') {
    const { sourceValues, mappedSourceValues } = migrationLogic
    if (sourceValues && mappedSourceValues) {
      const unmappedCount = sourceValues.filter((v) => !mappedSourceValues.includes(v)).length
      if (unmappedCount > 0) {
        // Not all source values are mapped → ORANGE (config in progress, not complete)
        return {
          linkStatus: 'ORANGE',
          statusDetail: `${unmappedCount} valeur${unmappedCount > 1 ? 's' : ''} source non liée${unmappedCount > 1 ? 's' : ''}`,
        }
      }
    }
    // All values mapped — honour the stored status
    if (migrationLogic.status === 'VALIDATED') return { linkStatus: 'GREEN' }
    return { linkStatus: 'ORANGE' }
  }

  // ── D2 (PROMPT) ───────────────────────────────────────────────────────────
  if (migrationLogic.status === 'VALIDATED') return { linkStatus: 'GREEN' }
  return { linkStatus: 'ORANGE' }
}
