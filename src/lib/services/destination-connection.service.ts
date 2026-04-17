// 006-destination-connection — Destination Connection Service

import { prisma } from '@/lib/db/prisma'
import { logAction } from './audit-service'
import { getPlan } from './plan-service'
import { getAdapterInstance, UnknownAdapterError } from '@/lib/connectors/adapter-factory'
import type { ConnectorAdapter } from '@/lib/connectors/types'

// ---------------------------------------------------------------------------
// Custom errors
// ---------------------------------------------------------------------------

export class DestinationAlreadyConnectedError extends Error {
  constructor() {
    super('Plan already has a destination connection. Disconnect first.')
    this.name = 'DestinationAlreadyConnectedError'
  }
}

export class DestinationNotConnectedError extends Error {
  constructor() {
    super('No destination connection exists for this plan.')
    this.name = 'DestinationNotConnectedError'
  }
}

export class DestinationConnectionFailedError extends Error {
  constructor(message: string) {
    super(`Connection failed: ${message}`)
    this.name = 'DestinationConnectionFailedError'
  }
}

// ---------------------------------------------------------------------------
// Adapter resolution — delegated to the shared factory
// ---------------------------------------------------------------------------

function getAdapter(adapterType: string): ConnectorAdapter {
  try {
    return getAdapterInstance(adapterType)
  } catch (err) {
    if (err instanceof UnknownAdapterError) {
      throw new DestinationConnectionFailedError(err.message)
    }
    throw err
  }
}

// ---------------------------------------------------------------------------
// Service operations
// ---------------------------------------------------------------------------

/**
 * Connect a destination system to a migration plan.
 * Validates the plan exists, checks no existing connection, instantiates the
 * adapter, tests the connection, persists to DB, and logs to audit trail.
 */
export async function connectDestination(
  planId: string,
  adapterType: string,
  config: Record<string, unknown>
) {
  // 1. Validate plan exists
  await getPlan(planId) // throws PlanNotFoundError if not found

  // 2. Check for existing destination connection
  const existing = await prisma.destinationConnection.findUnique({
    where: { planId },
  })
  if (existing) {
    throw new DestinationAlreadyConnectedError()
  }

  // 3. Instantiate adapter and test connection
  const adapter = getAdapter(adapterType)
  let connectorConnection
  try {
    connectorConnection = await adapter.connect(config)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await logAction(planId, 'destination.connection_failed', { planId, adapterType, error: message })
    throw new DestinationConnectionFailedError(message)
  }

  // 4. Persist destination connection
  const connection = await prisma.destinationConnection.create({
    data: {
      planId,
      adapterType,
      status: connectorConnection.status,
      config: JSON.stringify(config),
      connectedAt: new Date(),
    },
  })

  // 5. Log audit event
  await logAction(planId, 'destination.connected', {
    planId,
    adapterType,
    connectionId: connection.id,
  })

  console.log(`[destination-connection] Connected: plan=${planId} adapter=${adapterType} id=${connection.id}`)

  return connection
}

/**
 * Disconnect the destination from a migration plan.
 * Deletes the connection record (and any schema data if models exist),
 * then logs to audit trail.
 */
export async function disconnectDestination(planId: string) {
  // 1. Validate plan exists
  await getPlan(planId) // throws PlanNotFoundError if not found

  // 2. Find existing connection
  const connection = await prisma.destinationConnection.findUnique({
    where: { planId },
  })
  if (!connection) {
    throw new DestinationNotConnectedError()
  }

  // 3. Delete the connection record (cascade cleanup will be added in later features)
  await prisma.destinationConnection.delete({
    where: { planId },
  })

  // 4. Log audit event
  await logAction(planId, 'destination.disconnected', {
    planId,
    connectionId: connection.id,
  })

  console.log(`[destination-connection] Disconnected: plan=${planId} id=${connection.id}`)

  return { success: true }
}

/**
 * Get the current destination connection for a plan, or null if not connected.
 */
export async function getDestinationConnection(planId: string) {
  const connection = await prisma.destinationConnection.findUnique({
    where: { planId },
  })
  return connection ?? null
}

/**
 * Persist a destination connection whose credentials were obtained externally
 * (e.g. by an OAuth callback, or a Private App token already validated by the
 * caller). Unlike `connectDestination()`, this does NOT call `adapter.connect()`
 * and replaces any existing connection on the same plan.
 *
 * Used by the HubSpot OAuth callback and the HubSpot Private App POST route.
 */
export async function upsertDestinationConnectionRaw(
  planId: string,
  adapterType: string,
  config: Record<string, unknown>,
  status: string,
) {
  await getPlan(planId) // throws PlanNotFoundError if not found

  const existing = await prisma.destinationConnection.findUnique({ where: { planId } })
  if (existing) {
    await prisma.destinationConnection.delete({ where: { planId } })
    await logAction(planId, 'destination.disconnected', {
      planId,
      connectionId: existing.id,
      reason: 'replaced-oauth-or-token',
    })
  }

  const connection = await prisma.destinationConnection.create({
    data: {
      planId,
      adapterType,
      status,
      config: JSON.stringify(config),
      connectedAt: new Date(),
    },
  })

  await logAction(planId, 'destination.connected', {
    planId,
    adapterType,
    connectionId: connection.id,
    method: 'oauth-or-private-app',
  })

  return connection
}
