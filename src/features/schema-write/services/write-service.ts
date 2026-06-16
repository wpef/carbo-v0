// 022-schema-write — Schema write orchestration service (T006)
// Orchestrates: validate → adapter call → audit log (SchemaWriteOperation + AuditLog) → snapshot refresh.

import { prisma } from '@/lib/prisma'
import { logAuditEvent } from '@/lib/audit'
import { getAdapter } from '@/lib/adapters/registry'
import { fetchAndStoreSchema } from '@/features/schema/services/schema-service'
import { validateCreateField, validateModifyField } from './field-validator'
import type { ConnectorField, ConnectorObject, FieldModification } from '@/lib/types/connector'
import type { SchemaWriteOperationDTO } from '@/lib/types/schema-write'

// ---------------------------------------------------------------------------
// Custom errors
// ---------------------------------------------------------------------------

export class SchemaWriteNotSupportedError extends Error {
  constructor(adapterType: string) {
    super(`Adapter '${adapterType}' does not support schema writes (canWriteSchema=false)`)
    this.name = 'SchemaWriteNotSupportedError'
  }
}

export class SchemaWriteValidationError extends Error {
  constructor(public readonly errors: string[]) {
    super(`Validation failed: ${errors.join('; ')}`)
    this.name = 'SchemaWriteValidationError'
  }
}

export class SchemaWriteRemoteError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SchemaWriteRemoteError'
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Serialise a SchemaWriteOperation Prisma record into the public DTO shape.
 */
function toDTO(op: {
  id: string
  connectionId: string
  operationType: string
  objectApiName: string
  fieldApiName: string | null
  status: string
  errorMessage: string | null
  createdAt: Date
}): SchemaWriteOperationDTO {
  // Map v4 schema fields to the DTO shape from data-model.md
  const operationType = op.operationType as 'CREATE_OBJECT' | 'CREATE_FIELD' | 'MODIFY_FIELD'
  return {
    id: op.id,
    connectionId: op.connectionId,
    operationType,
    targetObjectApiName: op.objectApiName,
    details: op.fieldApiName ? { fieldApiName: op.fieldApiName } : {},
    result: op.status === 'SUCCESS' ? 'SUCCESS' : 'ERROR',
    errorMessage: op.errorMessage,
    createdAt: op.createdAt.toISOString(),
  }
}

/** Log the operation to SchemaWriteOperation + AuditLog. */
async function logSchemaWriteOperation(params: {
  planId?: string
  connectionId: string
  operationType: 'CREATE_OBJECT' | 'CREATE_FIELD' | 'MODIFY_FIELD'
  objectApiName: string
  fieldApiName?: string
  status: 'SUCCESS' | 'ERROR'
  errorMessage?: string
}): Promise<SchemaWriteOperationDTO> {
  const op = await prisma.schemaWriteOperation.create({
    data: {
      connectionId: params.connectionId,
      operationType: params.operationType,
      objectApiName: params.objectApiName,
      fieldApiName: params.fieldApiName ?? null,
      status: params.status,
      errorMessage: params.errorMessage ?? null,
    },
  })

  const auditAction = {
    CREATE_OBJECT: 'SCHEMA_WRITE_CREATE_OBJECT',
    CREATE_FIELD: 'SCHEMA_WRITE_CREATE_FIELD',
    MODIFY_FIELD: 'SCHEMA_WRITE_MODIFY_FIELD',
  }[params.operationType]

  await logAuditEvent({
    planId: params.planId,
    action: auditAction,
    entity: 'SchemaWriteOperation',
    entityId: op.id,
    details: {
      connectionId: params.connectionId,
      objectApiName: params.objectApiName,
      fieldApiName: params.fieldApiName,
      result: params.status,
    },
  })

  console.log(`[SchemaWriteService] Logged to audit trail — ${auditAction} (${params.status})`)
  return toDTO(op)
}

/** Refresh the DESTINATION snapshot for a connection after a successful write. */
async function refreshDestinationSnapshot(connectionId: string, planId?: string): Promise<void> {
  try {
    const conn = await prisma.connectorConnection.findUnique({
      where: { id: connectionId },
      select: { adapterType: true },
    })
    if (!conn) {
      console.warn(`[SchemaWriteService] Cannot refresh snapshot — connection ${connectionId} not found`)
      return
    }
    await fetchAndStoreSchema(planId ?? 'system', connectionId, conn.adapterType, 'DESTINATION')
    console.log('[SchemaWriteService] Snapshot refreshed after write')
  } catch (err) {
    console.warn('[SchemaWriteService] Non-fatal: snapshot refresh after write failed —', err)
  }
}

// ---------------------------------------------------------------------------
// Public service functions
// ---------------------------------------------------------------------------

/**
 * Create a new field on a destination object. (T006 / FR-002)
 *
 * Steps:
 * 1. Validate inputs (local)
 * 2. Check canWriteSchema
 * 3. Call adapter.createField
 * 4. Log to SchemaWriteOperation + AuditLog
 * 5. Refresh snapshot
 * 6. Return { field, operation }
 */
export async function createField(
  connectionId: string,
  adapterType: string,
  objectApiName: string,
  fieldData: {
    name: string
    label: string
    type: string
    description?: string
    picklistValues?: string[]
    group?: string
  },
  planId?: string,
): Promise<{ field: ConnectorField; operation: SchemaWriteOperationDTO }> {
  console.log(`[SchemaWriteService] Validating field creation for '${fieldData.name}' on '${objectApiName}'`)

  // 1. Validate
  const validation = await validateCreateField(connectionId, adapterType, objectApiName, {
    name: fieldData.name,
    type: fieldData.type,
    picklistValues: fieldData.picklistValues,
  })
  if (!validation.valid) {
    throw new SchemaWriteValidationError(validation.errors)
  }

  // 2. Check capability
  const adapter = getAdapter(adapterType)
  if (!adapter.capabilities.canWriteSchema || !adapter.createField) {
    throw new SchemaWriteNotSupportedError(adapterType)
  }

  // 3. Call adapter
  console.log('[SchemaWriteService] Calling adapter.createField')
  let field: ConnectorField
  try {
    field = await adapter.createField(connectionId, objectApiName, {
      apiName: fieldData.name,
      label: fieldData.label,
      dataType: fieldData.type,
      isRequired: false,
      isAccessible: true,
      picklistValues: fieldData.picklistValues,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown adapter error'
    // 4. Log failure
    const operation = await logSchemaWriteOperation({
      planId,
      connectionId,
      operationType: 'CREATE_FIELD',
      objectApiName,
      fieldApiName: fieldData.name,
      status: 'ERROR',
      errorMessage: message,
    })
    throw new SchemaWriteRemoteError(message)
  }

  // 4. Log success
  console.log('[SchemaWriteService] Field created successfully, refreshing snapshot')
  const operation = await logSchemaWriteOperation({
    planId,
    connectionId,
    operationType: 'CREATE_FIELD',
    objectApiName,
    fieldApiName: field.apiName,
    status: 'SUCCESS',
  })

  // 5. Refresh snapshot
  await refreshDestinationSnapshot(connectionId, planId)

  return { field, operation }
}

/**
 * Modify an existing destination field. (T006 / FR-004)
 */
export async function modifyField(
  connectionId: string,
  adapterType: string,
  objectApiName: string,
  fieldApiName: string,
  updates: FieldModification,
  planId?: string,
): Promise<{ field: ConnectorField; operation: SchemaWriteOperationDTO }> {
  console.log(`[SchemaWriteService] Validating field modification for '${fieldApiName}' on '${objectApiName}'`)

  // 1. Validate
  const validation = await validateModifyField(connectionId, adapterType, objectApiName, fieldApiName, {
    name: updates.name,
    type: updates.type,
  })
  if (!validation.valid) {
    throw new SchemaWriteValidationError(validation.errors)
  }

  // 2. Check capability
  const adapter = getAdapter(adapterType)
  if (!adapter.capabilities.canWriteSchema || !adapter.modifyField) {
    throw new SchemaWriteNotSupportedError(adapterType)
  }

  // 3. Call adapter
  console.log('[SchemaWriteService] Calling adapter.modifyField')
  let field: ConnectorField
  try {
    field = await adapter.modifyField(connectionId, objectApiName, fieldApiName, updates)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown adapter error'
    const operation = await logSchemaWriteOperation({
      planId,
      connectionId,
      operationType: 'MODIFY_FIELD',
      objectApiName,
      fieldApiName,
      status: 'ERROR',
      errorMessage: message,
    })
    throw new SchemaWriteRemoteError(message)
  }

  // 4. Log success
  console.log('[SchemaWriteService] Field modified successfully, refreshing snapshot')
  const operation = await logSchemaWriteOperation({
    planId,
    connectionId,
    operationType: 'MODIFY_FIELD',
    objectApiName,
    fieldApiName: field.apiName,
    status: 'SUCCESS',
  })

  // 5. Refresh snapshot
  await refreshDestinationSnapshot(connectionId, planId)

  return { field, operation }
}

/**
 * Create a new custom object on the destination. (T006 / FR-007)
 */
export async function createObject(
  connectionId: string,
  adapterType: string,
  objectData: {
    name: string
    label: string
    description?: string
    primaryProperty: { name: string; label: string; type: string }
  },
  planId?: string,
): Promise<{ object: ConnectorObject; operation: SchemaWriteOperationDTO }> {
  console.log(`[SchemaWriteService] Validating object creation for '${objectData.name}'`)

  // Inline validation — name must not be empty
  if (!objectData.name || objectData.name.trim() === '') {
    throw new SchemaWriteValidationError(['Object name is required'])
  }

  // 2. Check capability
  const adapter = getAdapter(adapterType)
  if (!adapter.capabilities.canWriteSchema || !adapter.createObject) {
    throw new SchemaWriteNotSupportedError(adapterType)
  }

  // 3. Call adapter
  console.log('[SchemaWriteService] Calling adapter.createObject')
  let object: ConnectorObject
  try {
    object = await adapter.createObject(connectionId, {
      apiName: objectData.name,
      label: objectData.label,
      description: objectData.description,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown adapter error'
    const operation = await logSchemaWriteOperation({
      planId,
      connectionId,
      operationType: 'CREATE_OBJECT',
      objectApiName: objectData.name,
      status: 'ERROR',
      errorMessage: message,
    })
    throw new SchemaWriteRemoteError(message)
  }

  // 4. Log success
  console.log('[SchemaWriteService] Object created successfully, refreshing snapshot')
  const operation = await logSchemaWriteOperation({
    planId,
    connectionId,
    operationType: 'CREATE_OBJECT',
    objectApiName: object.apiName,
    status: 'SUCCESS',
  })

  // 5. Refresh snapshot
  await refreshDestinationSnapshot(connectionId, planId)

  return { object, operation }
}

/**
 * Check whether the destination for a plan supports schema writes. (FR-001)
 * Returns capability info including supportedFieldTypes.
 */
export async function checkCapability(
  connectionId: string,
  adapterType: string,
): Promise<{ canWriteSchema: boolean; supportedFieldTypes: string[] }> {
  const adapter = getAdapter(adapterType)
  return {
    canWriteSchema: adapter.capabilities.canWriteSchema,
    supportedFieldTypes: adapter.capabilities.supportedFieldTypes ?? [],
  }
}
