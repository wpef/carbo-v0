// Calcul du statut de lien d'un mapping de champ (5 états).
// Porté tel quel de v4 (02-domain-rules règle 1 — validé en recette réelle).
// Pur TypeScript — pas de DB, pas de Prisma, pas de React, pas de réseau.
//
// Précédence stricte : BROKEN > RED_DASHED > RED_SOLID > ORANGE > GREEN

import { getSectionType } from "./type-compatibility";
import type { SectionType } from "./type-compatibility";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type LinkStatus = "GREEN" | "ORANGE" | "RED_SOLID" | "RED_DASHED" | "BROKEN";
export type MigrationLogicStatus = "DRAFT" | "DEFINED" | "VALIDATED";

export interface MigrationLogicSnapshot {
  status: MigrationLogicStatus;
  /** Valeurs picklist source (pour le contrôle de complétude D1). */
  sourceValues?: string[];
  /** Valeurs picklist destination (pour le contrôle de complétude D1). */
  destValues?: string[];
  /** Valeurs source déjà mappées (pour le contrôle de complétude D1). */
  mappedSourceValues?: string[];
}

export interface ComputeLinkStatusResult {
  linkStatus: LinkStatus;
  /** Détail lisible pour les états partiels ou cassés. */
  statusDetail?: string;
}

// ─── computeLinkStatus ─────────────────────────────────────────────────────────

/**
 * Calcule le statut visuel d'un mapping de champ.
 *
 * @param sourceType        dataType brut du champ source (ex. "picklist")
 * @param destType          dataType brut du champ destination
 * @param migrationLogic    instantané de la MigrationLogic, ou null si absente
 * @param sourceFieldExists false si le champ source a disparu du schéma CURRENT
 * @param destFieldExists   false si le champ destination a disparu du schéma CURRENT
 */
export function computeLinkStatus(
  sourceType: string,
  destType: string,
  migrationLogic: MigrationLogicSnapshot | null,
  sourceFieldExists = true,
  destFieldExists = true,
): ComputeLinkStatusResult {
  // ── BROKEN — le champ n'existe plus dans le snapshot CURRENT ─────────────
  if (!sourceFieldExists && !destFieldExists) {
    return {
      linkStatus: "BROKEN",
      statusDetail: "Champs source et destination introuvables dans le schéma actuel",
    };
  }
  if (!sourceFieldExists) {
    return { linkStatus: "BROKEN", statusDetail: "Champ source introuvable dans le schéma actuel" };
  }
  if (!destFieldExists) {
    return {
      linkStatus: "BROKEN",
      statusDetail: "Champ destination introuvable dans le schéma actuel",
    };
  }

  const sectionType: SectionType = getSectionType(sourceType, destType);

  // ── D3 (ERROR) — types incompatibles ; aucune logique ne peut corriger ───
  if (sectionType === "ERROR") return { linkStatus: "RED_DASHED" };

  // ── D4 (INFORMATIONAL) — copie directe ; auto-validé ─────────────────────
  if (sectionType === "INFORMATIONAL") return { linkStatus: "GREEN" };

  // ── D1 / D2 — configuration requise ──────────────────────────────────────
  if (!migrationLogic || migrationLogic.status === "DRAFT") {
    return { linkStatus: "RED_SOLID" };
  }

  // Logique existante (DEFINED ou VALIDATED) — contrôle de complétude D1
  if (sectionType === "VALUE_EQUIVALENCE") {
    const { sourceValues, mappedSourceValues } = migrationLogic;
    if (sourceValues && mappedSourceValues) {
      const unmappedCount = sourceValues.filter((v) => !mappedSourceValues.includes(v)).length;
      if (unmappedCount > 0) {
        // Toutes les valeurs source ne sont pas mappées → ORANGE, même VALIDATED
        return {
          linkStatus: "ORANGE",
          statusDetail: `${unmappedCount} valeur${unmappedCount > 1 ? "s" : ""} source non liée${unmappedCount > 1 ? "s" : ""}`,
        };
      }
    }
    // Tout est mappé — on honore le statut stocké
    if (migrationLogic.status === "VALIDATED") return { linkStatus: "GREEN" };
    return { linkStatus: "ORANGE" };
  }

  // ── D2 (PROMPT) ───────────────────────────────────────────────────────────
  if (migrationLogic.status === "VALIDATED") return { linkStatus: "GREEN" };
  return { linkStatus: "ORANGE" };
}
