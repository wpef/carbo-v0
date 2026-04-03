// 015-migration-filters — Migration filter service

import { prisma } from '@/lib/db/prisma'
import { logAction } from './audit-service'
import type {
  MigrationFilterDTO,
  CreateFilterInput,
  UpdateFilterInput,
  FilterableField,
  FilterOperator,
} from '@/lib/types/filter'
import { FILTER_OPERATORS } from '@/lib/types/filter'

// --- Errors ---

export class FilterNotFoundError extends Error {
  constructor(filterId: string) {
    super(`MigrationFilter not found: ${filterId}`)
    this.name = 'FilterNotFoundError'
  }
}

export class InvalidFilterOperatorError extends Error {
  constructor(operator: string) {
    super(`Invalid filter operator: ${operator}`)
    this.name = 'InvalidFilterOperatorError'
  }
}

export class MappingNotFoundError extends Error {
  constructor(mappingId: string) {
    super(`ObjectMapping not found: ${mappingId}`)
    this.name = 'MappingNotFoundError'
  }
}

// --- Helpers ---

const VALID_OPERATORS = new Set<string>(FILTER_OPERATORS.map((op) => op.value))

function validateOperator(operator: string): asserts operator is FilterOperator {
  if (!VALID_OPERATORS.has(operator)) {
    throw new InvalidFilterOperatorError(operator)
  }
}

// Access migrationFilter via prisma as any since the model may not yet be in the generated client
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => prisma.migrationFilter

function toDTO(record: {
  id: string
  objectMappingId: string
  fieldApiName: string
  operator: string
  value: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}): MigrationFilterDTO {
  return {
    id: record.id,
    objectMappingId: record.objectMappingId,
    fieldApiName: record.fieldApiName,
    operator: record.operator as FilterOperator,
    value: record.value,
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

// --- Service functions ---

/**
 * List all filters for an object mapping, ordered by creation date.
 */
export async function listFilters(objectMappingId: string): Promise<MigrationFilterDTO[]> {
  const records = await db().findMany({
    where: { objectMappingId },
    orderBy: { createdAt: 'asc' },
  })

  // Optionally enrich with field labels from source schema
  const fields = await getFilterableFields(objectMappingId)
  const fieldLabelByApiName = new Map(fields.map((f) => [f.apiName, f.label]))

  return records.map((r: Parameters<typeof toDTO>[0]) => ({
    ...toDTO(r),
    fieldLabel: fieldLabelByApiName.get(r.fieldApiName),
  }))
}

/**
 * Create a new filter for an object mapping. Validates the operator.
 */
export async function createFilter(
  objectMappingId: string,
  input: CreateFilterInput,
): Promise<MigrationFilterDTO> {
  // Validate mapping exists
  const mapping = await prisma.objectMapping.findUnique({ where: { id: objectMappingId } })
  if (!mapping) {
    throw new MappingNotFoundError(objectMappingId)
  }

  validateOperator(input.operator)

  const record = await db().create({
    data: {
      objectMappingId,
      fieldApiName: input.fieldApiName,
      operator: input.operator,
      value: input.value ?? null,
      isActive: true,
    },
  })

  await logAction(mapping.planId, 'FILTER_CREATED', {
    filterId: record.id,
    objectMappingId,
    fieldApiName: input.fieldApiName,
    operator: input.operator,
  })

  console.log(`[FILTER] Created filter ${record.id} on mapping ${objectMappingId}`)

  return toDTO(record)
}

/**
 * Update an existing filter's operator, value, or active state.
 */
export async function updateFilter(
  filterId: string,
  updates: UpdateFilterInput,
): Promise<MigrationFilterDTO> {
  const existing = await db().findUnique({ where: { id: filterId } })
  if (!existing) {
    throw new FilterNotFoundError(filterId)
  }

  if (updates.operator !== undefined) {
    validateOperator(updates.operator)
  }

  const record = await db().update({
    where: { id: filterId },
    data: {
      ...(updates.operator !== undefined && { operator: updates.operator }),
      ...(updates.value !== undefined && { value: updates.value }),
      ...(updates.isActive !== undefined && { isActive: updates.isActive }),
    },
  })

  // Fetch plan ID for audit
  const mapping = await prisma.objectMapping.findUnique({ where: { id: existing.objectMappingId } })
  const planId = mapping?.planId ?? null

  await logAction(planId, 'FILTER_UPDATED', {
    filterId,
    objectMappingId: existing.objectMappingId,
    changes: updates,
  })

  console.log(`[FILTER] Updated filter ${filterId}`)

  return toDTO(record)
}

/**
 * Delete a filter by ID.
 */
export async function deleteFilter(filterId: string): Promise<void> {
  const existing = await db().findUnique({ where: { id: filterId } })
  if (!existing) {
    throw new FilterNotFoundError(filterId)
  }

  await db().delete({ where: { id: filterId } })

  const mapping = await prisma.objectMapping.findUnique({ where: { id: existing.objectMappingId } })
  const planId = mapping?.planId ?? null

  await logAction(planId, 'FILTER_DELETED', {
    filterId,
    objectMappingId: existing.objectMappingId,
    fieldApiName: existing.fieldApiName,
  })

  console.log(`[FILTER] Deleted filter ${filterId}`)
}

/**
 * Toggle the isActive state of a filter.
 */
export async function toggleFilter(filterId: string): Promise<MigrationFilterDTO> {
  const existing = await db().findUnique({ where: { id: filterId } })
  if (!existing) {
    throw new FilterNotFoundError(filterId)
  }

  const newActive = !existing.isActive

  const record = await db().update({
    where: { id: filterId },
    data: { isActive: newActive },
  })

  const mapping = await prisma.objectMapping.findUnique({ where: { id: existing.objectMappingId } })
  const planId = mapping?.planId ?? null

  await logAction(planId, 'FILTER_TOGGLED', {
    filterId,
    objectMappingId: existing.objectMappingId,
    isActive: newActive,
  })

  console.log(`[FILTER] Toggled filter ${filterId} → isActive=${newActive}`)

  return toDTO(record)
}

/**
 * Return the source fields available for filtering on a given object mapping.
 * Looks up the source object's fields from ObjectField records.
 */
export async function getFilterableFields(objectMappingId: string): Promise<FilterableField[]> {
  const mapping = await prisma.objectMapping.findUnique({ where: { id: objectMappingId } })
  if (!mapping) return []

  // Find fields for the source object
  const fields = await prisma.objectField.findMany({
    where: { objectId: mapping.sourceObjectId },
    orderBy: { label: 'asc' },
  })

  return fields.map((f) => ({
    apiName: f.apiName,
    label: f.label,
    dataType: f.dataType,
  }))
}
