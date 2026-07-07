// Filtres de migration — CRUD + toggle + estimation (02-domain-rules règle 5).
// Porté de v4 ; l'estimation s'appuie sur la capacité optionnelle
// getRecordCount des connecteurs (dégradation gracieuse si absente).

import { db } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";
import type { FilterOperator as PrismaFilterOperator } from "@prisma/client";
import { getAdapter } from "@/features/connectors/registry";
import { isValidOperator } from "./lib/filter-operators";
import { validateFilter } from "./lib/filter-validation";
import type { CreateFilterInput, FilterEstimate, FilterItem, UpdateFilterInput } from "./types";

// ─── Erreurs typées ────────────────────────────────────────────────────────────

export class FilterNotFoundError extends Error {
  constructor(filterId: string) {
    super(`Filtre introuvable : ${filterId}`);
    this.name = "FilterNotFoundError";
  }
}

export class InvalidFilterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidFilterError";
  }
}

/** Champ source disparu / inconnu (422 côté route). */
export class FilterFieldNotFoundError extends Error {
  constructor(fieldName: string, objectName: string) {
    super(`Le champ source "${fieldName}" n'existe pas dans l'objet source "${objectName}".`);
    this.name = "FilterFieldNotFoundError";
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

type DbFilter = {
  id: string;
  objectMappingId: string;
  fieldApiName: string;
  operator: PrismaFilterOperator;
  value: string | null;
  isActive: boolean;
};

function toFilterItem(r: DbFilter, fieldLabel?: string, warning?: string): FilterItem {
  return {
    id: r.id,
    objectMappingId: r.objectMappingId,
    fieldApiName: r.fieldApiName,
    ...(fieldLabel !== undefined && { fieldLabel }),
    operator: r.operator,
    value: r.value,
    isActive: r.isActive,
    ...(warning !== undefined && { warning }),
  };
}

/** Champs de l'objet source de la paire, résolus sur le snapshot CURRENT. */
async function getSourceObjectContext(objectMappingId: string) {
  const mapping = await db.objectMapping.findUnique({
    where: { id: objectMappingId },
    include: { plan: { select: { id: true, sourceConnectionId: true } } },
  });
  if (!mapping) return null;

  let fields: { apiName: string; label: string; dataType: string }[] = [];
  if (mapping.plan.sourceConnectionId) {
    const snapshot = await db.schemaSnapshot.findFirst({
      where: {
        connectionId: mapping.plan.sourceConnectionId,
        side: "SOURCE",
        status: "CURRENT",
      },
      select: { id: true },
    });
    if (snapshot) {
      const object = await db.schemaObject.findFirst({
        where: { snapshotId: snapshot.id, apiName: mapping.sourceObjectName },
        include: { fields: { select: { apiName: true, label: true, dataType: true } } },
      });
      fields = object?.fields ?? [];
    }
  }
  return {
    planId: mapping.planId,
    sourceObjectName: mapping.sourceObjectName,
    fields,
  };
}

// ─── CRUD ──────────────────────────────────────────────────────────────────────

/** Filtres d'une paire, labels enrichis depuis le snapshot CURRENT. */
export async function listFilters(objectMappingId: string): Promise<FilterItem[]> {
  const records = await db.migrationFilter.findMany({
    where: { objectMappingId },
    orderBy: { id: "asc" },
  });
  const ctx = await getSourceObjectContext(objectMappingId);
  const labelByApiName = new Map(ctx?.fields.map((f) => [f.apiName, f.label]) ?? []);
  return records.map((r) => toFilterItem(r, labelByApiName.get(r.fieldApiName)));
}

/**
 * Crée un filtre après validation (erreurs dures → exception ; warning souple
 * porté par le FilterItem retourné). Sans snapshot source, la validation
 * d'existence du champ est sautée (l'intégrité la rattrapera).
 */
export async function createFilter(
  objectMappingId: string,
  input: CreateFilterInput,
): Promise<FilterItem> {
  const ctx = await getSourceObjectContext(objectMappingId);
  if (!ctx) throw new InvalidFilterError("Mapping d'objets introuvable");

  if (!isValidOperator(input.operator)) {
    throw new InvalidFilterError(`Opérateur de filtre invalide : ${input.operator}`);
  }

  let warning: string | undefined;
  if (ctx.fields.length > 0) {
    const result = validateFilter(
      { fieldApiName: input.fieldApiName, operator: input.operator, value: input.value },
      ctx.fields,
    );
    if (!result.valid) {
      const fieldExists = ctx.fields.some((f) => f.apiName === input.fieldApiName);
      if (!fieldExists) {
        throw new FilterFieldNotFoundError(input.fieldApiName, ctx.sourceObjectName);
      }
      throw new InvalidFilterError(result.error ?? "Validation échouée");
    }
    warning = result.warning;
  }

  const record = await db.migrationFilter.create({
    data: {
      objectMappingId,
      fieldApiName: input.fieldApiName,
      operator: input.operator as PrismaFilterOperator,
      value: input.value ?? null,
      isActive: true,
    },
  });

  await logAuditEvent({
    planId: ctx.planId,
    action: "FILTER_CREATED",
    entity: "MigrationFilter",
    entityId: record.id,
    details: { objectMappingId, ...input },
  });

  return toFilterItem(record, undefined, warning);
}

/** Mise à jour partielle (opérateur, valeur, toggle isActive — sans suppression). */
export async function updateFilter(
  filterId: string,
  updates: UpdateFilterInput,
): Promise<FilterItem> {
  const existing = await db.migrationFilter.findUnique({
    where: { id: filterId },
    include: { objectMapping: { select: { planId: true } } },
  });
  if (!existing) throw new FilterNotFoundError(filterId);
  if (updates.operator !== undefined && !isValidOperator(updates.operator)) {
    throw new InvalidFilterError(`Opérateur de filtre invalide : ${updates.operator}`);
  }

  const record = await db.migrationFilter.update({
    where: { id: filterId },
    data: {
      ...(updates.operator !== undefined && {
        operator: updates.operator as PrismaFilterOperator,
      }),
      ...(updates.value !== undefined && { value: updates.value }),
      ...(updates.isActive !== undefined && { isActive: updates.isActive }),
    },
  });

  await logAuditEvent({
    planId: existing.objectMapping.planId,
    action: "FILTER_UPDATED",
    entity: "MigrationFilter",
    entityId: filterId,
    details: { objectMappingId: existing.objectMappingId, changes: { ...updates } },
  });

  return toFilterItem(record);
}

export async function deleteFilter(filterId: string): Promise<void> {
  const existing = await db.migrationFilter.findUnique({
    where: { id: filterId },
    include: { objectMapping: { select: { planId: true } } },
  });
  if (!existing) throw new FilterNotFoundError(filterId);

  await db.migrationFilter.delete({ where: { id: filterId } });

  await logAuditEvent({
    planId: existing.objectMapping.planId,
    action: "FILTER_REMOVED",
    entity: "MigrationFilter",
    entityId: filterId,
    details: {
      objectMappingId: existing.objectMappingId,
      fieldApiName: existing.fieldApiName,
      operator: existing.operator,
      value: existing.value,
    },
  });
}

// ─── Estimation ────────────────────────────────────────────────────────────────

/**
 * Estime le nombre d'enregistrements source concernés par les filtres actifs.
 * Toujours 200 côté route : indisponibilité = réponse gracieuse, jamais une
 * erreur. S'appuie sur les capacités optionnelles getRecordCount /
 * getFilteredRecordCount des connecteurs (câblées en tranche aperçu).
 */
export async function estimateFilteredCount(objectMappingId: string): Promise<FilterEstimate> {
  const mapping = await db.objectMapping.findUnique({
    where: { id: objectMappingId },
    include: { plan: { include: { sourceConnection: true } } },
  });
  if (!mapping) throw new InvalidFilterError("Mapping d'objets introuvable");

  const activeFilters = await db.migrationFilter.findMany({
    where: { objectMappingId, isActive: true },
    orderBy: { id: "asc" },
  });
  const isFiltered = activeFilters.length > 0;

  const sourceConnection = mapping.plan.sourceConnection;
  if (!sourceConnection) {
    return {
      estimatedCount: null,
      totalCount: null,
      isFiltered,
      isEstimateAvailable: false,
      message: "Estimation indisponible — aucune connexion source configurée.",
    };
  }

  const adapter = getAdapter(sourceConnection.adapterType);
  if (!adapter.getRecordCount) {
    return {
      estimatedCount: null,
      totalCount: null,
      isFiltered,
      isEstimateAvailable: false,
      message: "Estimation indisponible pour ce connecteur.",
    };
  }

  try {
    const totalCount = await adapter.getRecordCount(sourceConnection.id, mapping.sourceObjectName);
    if (!isFiltered) {
      return { estimatedCount: totalCount, totalCount, isFiltered: false, isEstimateAvailable: true };
    }

    if (adapter.getFilteredRecordCount) {
      const estimatedCount = await adapter.getFilteredRecordCount(
        sourceConnection.id,
        mapping.sourceObjectName,
        activeFilters.map((f) => ({
          fieldName: f.fieldApiName,
          operator: f.operator,
          value: f.value ?? "",
        })),
      );
      return { estimatedCount, totalCount, isFiltered: true, isEstimateAvailable: true };
    }

    return {
      estimatedCount: totalCount,
      totalCount,
      isFiltered: true,
      isEstimateAvailable: true,
      message:
        "L'estimation filtrée n'est pas disponible pour ce connecteur ; le total non filtré est affiché.",
    };
  } catch (err) {
    console.error("[filter-service] estimation en échec:", err);
    return {
      estimatedCount: null,
      totalCount: null,
      isFiltered,
      isEstimateAvailable: false,
      message: "Estimation indisponible — le système source est inaccessible.",
    };
  }
}
