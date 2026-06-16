// 015-migration-filters — Filter service (CRUD + estimation + filterable fields)
// Ported from v3 src/lib/services/migration-filter.ts, adapted to v4 structure.

import { prisma } from '@/lib/prisma'
import { logAuditEvent } from '@/lib/audit'
import type { FilterOperator as PrismaFilterOperator } from '@prisma/client'
import { isValidOperator } from '../lib/filter-operators'
import { validateFilter } from '../lib/filter-validation'
import type {
  FilterItem,
  FilterListResponse,
  CreateFilterInput,
  UpdateFilterInput,
  FilterableField,
  FilterEstimate,
} from '../types'

// ─── Custom errors ────────────────────────────────────────────────────────────

export class FilterNotFoundError extends Error {
  constructor(filterId: string) {
    super(`MigrationFilter introuvable : ${filterId}`)
    this.name = 'FilterNotFoundError'
  }
}

export class MappingNotFoundError extends Error {
  constructor(mappingId: string) {
    super(`ObjectMapping introuvable : ${mappingId}`)
    this.name = 'MappingNotFoundError'
  }
}

export class InvalidFilterOperatorError extends Error {
  constructor(operator: string) {
    super(`Opérateur de filtre invalide : ${operator}`)
    this.name = 'InvalidFilterOperatorError'
  }
}

export class FilterFieldNotFoundError extends Error {
  sourceFieldName: string
  sourceObjectName: string
  constructor(fieldName: string, objectName: string) {
    super(`Le champ "${fieldName}" n'existe pas dans l'objet source "${objectName}".`)
    this.sourceFieldName = fieldName
    this.sourceObjectName = objectName
    this.name = 'FilterFieldNotFoundError'
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

// Note: MigrationFilter in v4 Prisma schema has no createdAt/updatedAt columns.
// We omit those fields from the DTO (the spec's FilterItem has them as optional
// from the contracts, but the DB model does not include them to stay schema-pure).
type PrismaFilter = {
  id: string
  objectMappingId: string
  fieldApiName: string
  operator: PrismaFilterOperator
  value: string | null
  isActive: boolean
}

function toFilterItem(r: PrismaFilter, fieldLabel?: string, warning?: string): FilterItem {
  return {
    id: r.id,
    objectMappingId: r.objectMappingId,
    fieldApiName: r.fieldApiName,
    ...(fieldLabel !== undefined && { fieldLabel }),
    operator: r.operator as FilterItem['operator'],
    value: r.value,
    isActive: r.isActive,
    ...(warning !== undefined && { warning }),
    // createdAt/updatedAt: not present in v4 schema — use placeholder so types satisfy
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Resolve the source SchemaObject for a given ObjectMapping.
 * Returns null if no snapshot is available (not yet fetched).
 */
async function getSourceObjectFields(objectMappingId: string): Promise<{
  planId: string
  sourceObjectName: string
  fields: { apiName: string; label: string; dataType: string }[]
} | null> {
  const mapping = await prisma.objectMapping.findUnique({
    where: { id: objectMappingId },
    include: {
      plan: {
        include: {
          sourceConnection: {
            include: {
              schemaSnapshots: {
                where: { side: 'SOURCE', status: 'CURRENT' },
                include: {
                  objects: {
                    include: { fields: true },
                  },
                },
                take: 1,
              },
            },
          },
        },
      },
    },
  })

  if (!mapping) return null

  const snapshot = mapping.plan.sourceConnection?.schemaSnapshots?.[0]
  if (!snapshot) {
    return { planId: mapping.planId, sourceObjectName: mapping.sourceObjectName, fields: [] }
  }

  const obj = snapshot.objects.find((o) => o.apiName === mapping.sourceObjectName)
  return {
    planId: mapping.planId,
    sourceObjectName: mapping.sourceObjectName,
    fields: (obj?.fields ?? []).map((f) => ({
      apiName: f.apiName,
      label: f.label,
      dataType: f.dataType,
    })),
  }
}

// ─── Public service functions ─────────────────────────────────────────────────

/**
 * List all filters for an object mapping, ordered by creation date (asc).
 * Enriches each filter with its field label from the source schema snapshot.
 * FR-001, FR-003
 */
export async function listFilters(objectMappingId: string): Promise<FilterListResponse> {
  const mapping = await prisma.objectMapping.findUnique({ where: { id: objectMappingId } })
  if (!mapping) throw new MappingNotFoundError(objectMappingId)

  // Note: no createdAt in v4 schema — order by id (uuid, insertion-order proxy)
  const records = await prisma.migrationFilter.findMany({
    where: { objectMappingId },
    orderBy: { id: 'asc' },
  })

  // Enrich with field labels
  const sourceCtx = await getSourceObjectFields(objectMappingId)
  const labelByApiName = new Map(sourceCtx?.fields.map((f) => [f.apiName, f.label]) ?? [])

  const filters = records.map((r) => toFilterItem(r, labelByApiName.get(r.fieldApiName)))

  return { filters, count: filters.length }
}

/**
 * Create a new migration filter.
 * FR-001 (create), FR-002 (valid operator), FR-005 (field must exist), FR-007 (audit)
 */
export async function createFilter(
  objectMappingId: string,
  input: CreateFilterInput,
): Promise<FilterItem & { warning?: string }> {
  const mapping = await prisma.objectMapping.findUnique({ where: { id: objectMappingId } })
  if (!mapping) throw new MappingNotFoundError(objectMappingId)

  // Validate operator early (before hitting DB for schema)
  if (!isValidOperator(input.operator)) {
    throw new InvalidFilterOperatorError(input.operator)
  }

  // Get source fields for FR-005 validation
  const sourceCtx = await getSourceObjectFields(objectMappingId)
  const sourceFields = (sourceCtx?.fields ?? []).map((f) => ({
    apiName: f.apiName,
    label: f.label,
    dataType: f.dataType,
    isRequired: false,
    isReadOnly: false,
    isUnique: false,
  }))

  // If we have a schema snapshot, enforce FR-005
  if (sourceCtx && sourceCtx.fields.length > 0) {
    const result = validateFilter(
      { fieldApiName: input.fieldApiName, operator: input.operator, value: input.value },
      sourceFields,
    )

    if (!result.valid) {
      // Check specifically whether the field was not found (FR-005 = 422)
      const fieldExists = sourceCtx.fields.some((f) => f.apiName === input.fieldApiName)
      if (!fieldExists) {
        throw new FilterFieldNotFoundError(input.fieldApiName, mapping.sourceObjectName)
      }
      throw new InvalidFilterOperatorError(result.error ?? 'Validation échouée')
    }

    // Build the record; carry warning for soft issues
    const record = await prisma.migrationFilter.create({
      data: {
        objectMappingId,
        fieldApiName: input.fieldApiName,
        operator: input.operator as PrismaFilterOperator,
        value: input.value ?? null,
        isActive: true,
      },
    })

    await logAuditEvent({
      planId: mapping.planId,
      action: 'FILTER_CREATED',
      entity: 'MigrationFilter',
      entityId: record.id,
      details: {
        objectMappingId,
        fieldApiName: input.fieldApiName,
        operator: input.operator,
        value: input.value,
      },
    })

    return toFilterItem(record, undefined, result.warning)
  }

  // No schema snapshot available — skip FR-005 (cannot validate), allow creation
  const record = await prisma.migrationFilter.create({
    data: {
      objectMappingId,
      fieldApiName: input.fieldApiName,
      operator: input.operator as PrismaFilterOperator,
      value: input.value ?? null,
      isActive: true,
    },
  })

  await logAuditEvent({
    planId: mapping.planId,
    action: 'FILTER_CREATED',
    entity: 'MigrationFilter',
    entityId: record.id,
    details: {
      objectMappingId,
      fieldApiName: input.fieldApiName,
      operator: input.operator,
      value: input.value,
    },
  })

  return toFilterItem(record)
}

/**
 * Update an existing filter (operator, value, isActive toggle).
 * PATCH: partial update — only provided fields are changed.
 */
export async function updateFilter(
  filterId: string,
  updates: UpdateFilterInput,
): Promise<FilterItem> {
  const existing = await prisma.migrationFilter.findUnique({ where: { id: filterId } })
  if (!existing) throw new FilterNotFoundError(filterId)

  if (updates.operator !== undefined && !isValidOperator(updates.operator)) {
    throw new InvalidFilterOperatorError(updates.operator)
  }

  const record = await prisma.migrationFilter.update({
    where: { id: filterId },
    data: {
      ...(updates.operator !== undefined && { operator: updates.operator as PrismaFilterOperator }),
      ...(updates.value !== undefined && { value: updates.value }),
      ...(updates.isActive !== undefined && { isActive: updates.isActive }),
    },
  })

  const mapping = await prisma.objectMapping.findUnique({ where: { id: existing.objectMappingId } })

  await logAuditEvent({
    planId: mapping?.planId,
    action: 'FILTER_UPDATED',
    entity: 'MigrationFilter',
    entityId: filterId,
    details: { objectMappingId: existing.objectMappingId, changes: updates },
  })

  return toFilterItem(record)
}

/**
 * Delete a filter by ID.
 * FR-006, FR-007 (audit)
 */
export async function deleteFilter(filterId: string): Promise<void> {
  const existing = await prisma.migrationFilter.findUnique({ where: { id: filterId } })
  if (!existing) throw new FilterNotFoundError(filterId)

  await prisma.migrationFilter.delete({ where: { id: filterId } })

  const mapping = await prisma.objectMapping.findUnique({ where: { id: existing.objectMappingId } })

  await logAuditEvent({
    planId: mapping?.planId,
    action: 'FILTER_REMOVED',
    entity: 'MigrationFilter',
    entityId: filterId,
    details: {
      objectMappingId: existing.objectMappingId,
      fieldApiName: existing.fieldApiName,
      operator: existing.operator,
      value: existing.value,
    },
  })
}

/**
 * Get the filterable source fields for an object mapping.
 * Returns ObjectField records from the source schema snapshot.
 * FR-005 (used for validation), also exposed via GET /filterable-fields.
 */
export async function getFilterableFields(objectMappingId: string): Promise<FilterableField[]> {
  const sourceCtx = await getSourceObjectFields(objectMappingId)
  if (!sourceCtx) return []

  return sourceCtx.fields.map((f) => ({
    apiName: f.apiName,
    label: f.label,
    dataType: f.dataType,
  }))
}

/**
 * Estimate the number of source records matching the active filters.
 * FR-004: uses connector's getFilteredRecordCount if available, falls back to getRecordCount.
 * Handles unreachable source gracefully (isEstimateAvailable: false).
 */
export async function estimateFilteredCount(objectMappingId: string): Promise<FilterEstimate> {
  const mapping = await prisma.objectMapping.findUnique({
    where: { id: objectMappingId },
    include: {
      plan: {
        include: {
          sourceConnection: true,
        },
      },
    },
  })

  if (!mapping) throw new MappingNotFoundError(objectMappingId)

  const activeFilters = await prisma.migrationFilter.findMany({
    where: { objectMappingId, isActive: true },
    orderBy: { id: 'asc' },
  })

  const isFiltered = activeFilters.length > 0
  const sourceConnection = mapping.plan.sourceConnection

  if (!sourceConnection) {
    return {
      estimatedCount: null,
      totalCount: null,
      isFiltered,
      isEstimateAvailable: false,
      message: "Estimation indisponible — aucune connexion source configurée.",
    }
  }

  // Dynamic import to avoid circular deps and to allow jest/vitest mocking
  let adapter: import('@/lib/types/connector').ConnectorAdapter
  try {
    const { getAdapter } = await import('@/lib/adapters/registry')
    adapter = getAdapter(sourceConnection.adapterType)
  } catch {
    return {
      estimatedCount: null,
      totalCount: null,
      isFiltered,
      isEstimateAvailable: false,
      message: "Estimation indisponible — adaptateur source inconnu.",
    }
  }

  try {
    // Always fetch total count (denominator)
    const totalCount = await adapter.getRecordCount(sourceConnection.id, mapping.sourceObjectName)

    if (!isFiltered) {
      return {
        estimatedCount: totalCount,
        totalCount,
        isFiltered: false,
        isEstimateAvailable: true,
      }
    }

    // Use getFilteredRecordCount if the adapter supports it
    // TODO (Principle IX): connectors (SF/HubSpot) should implement getFilteredRecordCount
    // that translates FilterCondition[] to SOQL COUNT / HubSpot filter API
    const extendedAdapter = adapter as import('@/lib/types/connector').ConnectorAdapter & {
      getFilteredRecordCount?: (
        connectionId: string,
        objectApiName: string,
        filters: { fieldName: string; operator: string; value: string }[],
      ) => Promise<number>
    }

    if (typeof extendedAdapter.getFilteredRecordCount === 'function') {
      const conditions = activeFilters.map((f) => ({
        fieldName: f.fieldApiName,
        operator: f.operator,
        value: f.value ?? '',
      }))
      const estimatedCount = await extendedAdapter.getFilteredRecordCount(
        sourceConnection.id,
        mapping.sourceObjectName,
        conditions,
      )
      return { estimatedCount, totalCount, isFiltered: true, isEstimateAvailable: true }
    }

    // Fallback: no filter-aware count — return total as estimate with a note
    // (spec: "If not implemented, total count is returned")
    return {
      estimatedCount: totalCount,
      totalCount,
      isFiltered: true,
      isEstimateAvailable: true,
      message: "L'estimation filtrée n'est pas disponible pour ce connecteur ; le total non filtré est affiché.",
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    console.error('[filter-service] estimateFilteredCount error:', msg)
    return {
      estimatedCount: null,
      totalCount: null,
      isFiltered,
      isEstimateAvailable: false,
      message: "Estimation indisponible — le système source est inaccessible.",
    }
  }
}
