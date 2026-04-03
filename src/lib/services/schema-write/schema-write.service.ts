// 022-schema-write — Schema write service

import { prisma } from '@/lib/db/prisma'
import { logAction } from '@/lib/services/audit-service'
import { getAdapterInstance } from '@/lib/connectors/adapter-factory'
import { retrieveSchema } from '@/lib/services/schema-retrieval'
import type { CreateObjectInput, CreateFieldInput, SchemaWriteResult, SchemaWriteCapability } from './types'
import type { ConnectorObject, ConnectorField } from '@/lib/connectors/types'

// --- Errors ---

export class SchemaWriteNotFoundError extends Error {
  constructor(planId: string) {
    super(`No destination connection found for plan: ${planId}`)
    this.name = 'SchemaWriteNotFoundError'
  }
}

export class SchemaWriteNotSupportedError extends Error {
  constructor(adapterType: string) {
    super(`Adapter '${adapterType}' does not support schema write (canWriteSchema=false)`)
    this.name = 'SchemaWriteNotSupportedError'
  }
}

// --- Helpers ---

async function getDestinationConnection(planId: string) {
  const conn = await prisma.destinationConnection.findUnique({ where: { planId } })
  if (!conn) throw new SchemaWriteNotFoundError(planId)
  return conn
}

// --- Service Functions ---

/**
 * Check whether the destination adapter for a plan supports schema write.
 */
export async function checkSchemaWriteCapability(planId: string): Promise<SchemaWriteCapability> {
  const conn = await getDestinationConnection(planId)
  const adapter = getAdapterInstance(conn.adapterType)
  return {
    canWriteSchema: adapter.canWriteSchema,
    adapterType: conn.adapterType,
  }
}

/**
 * Create a new object in the destination system.
 * Validates capability, calls adapter, refreshes schema snapshot, logs audit.
 */
export async function createObjectInDestination(
  planId: string,
  input: CreateObjectInput,
): Promise<SchemaWriteResult<ConnectorObject>> {
  const conn = await getDestinationConnection(planId)
  const adapter = getAdapterInstance(conn.adapterType)

  if (!adapter.canWriteSchema || !adapter.createObject) {
    throw new SchemaWriteNotSupportedError(conn.adapterType)
  }

  try {
    const created = await adapter.createObject(conn.id, input.apiName, input.label)

    // Refresh destination schema snapshot
    await retrieveSchema(conn.id, 'destination').catch((err) =>
      console.warn('[WARN] schema refresh after createObject failed (non-fatal):', err),
    )

    await logAction(planId, 'SCHEMA_WRITE_OBJECT_CREATED', {
      connectionId: conn.id,
      adapterType: conn.adapterType,
      objectApiName: input.apiName,
      objectLabel: input.label,
    })

    return { success: true, data: created }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    await logAction(planId, 'SCHEMA_WRITE_OBJECT_FAILED', {
      connectionId: conn.id,
      adapterType: conn.adapterType,
      objectApiName: input.apiName,
      error: message,
    }).catch(() => {})

    return { success: false, error: message }
  }
}

/**
 * Create a new field in the destination object.
 * Validates capability, calls adapter, refreshes schema snapshot, logs audit.
 */
export async function createFieldInDestination(
  planId: string,
  input: CreateFieldInput,
): Promise<SchemaWriteResult<ConnectorField>> {
  const conn = await getDestinationConnection(planId)
  const adapter = getAdapterInstance(conn.adapterType)

  if (!adapter.canWriteSchema || !adapter.createField) {
    throw new SchemaWriteNotSupportedError(conn.adapterType)
  }

  try {
    const created = await adapter.createField(conn.id, input.objectApiName, {
      apiName: input.apiName,
      label: input.label,
      dataType: input.dataType,
      isRequired: input.isRequired,
    })

    // Refresh destination schema snapshot
    await retrieveSchema(conn.id, 'destination').catch((err) =>
      console.warn('[WARN] schema refresh after createField failed (non-fatal):', err),
    )

    await logAction(planId, 'SCHEMA_WRITE_FIELD_CREATED', {
      connectionId: conn.id,
      adapterType: conn.adapterType,
      objectApiName: input.objectApiName,
      fieldApiName: input.apiName,
      fieldLabel: input.label,
      dataType: input.dataType,
    })

    return { success: true, data: created }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    await logAction(planId, 'SCHEMA_WRITE_FIELD_FAILED', {
      connectionId: conn.id,
      adapterType: conn.adapterType,
      objectApiName: input.objectApiName,
      fieldApiName: input.apiName,
      error: message,
    }).catch(() => {})

    return { success: false, error: message }
  }
}
