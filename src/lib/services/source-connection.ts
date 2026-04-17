import { prisma } from '@/lib/db/prisma'
import { logAction } from './audit-service'
import { getAdapterMetadata } from '@/lib/connectors/registry'
import { DemoSourceAdapter } from '@/lib/connectors/adapters/demo-source'
import { PlanNotFoundError } from './plan-service'

// --- Errors ---

export class InvalidAdapterError extends Error {
  constructor(adapterType: string) {
    super(`Adapter type '${adapterType}' is not registered.`)
    this.name = 'InvalidAdapterError'
  }
}

export class AuthFailedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthFailedError'
  }
}

export class SourceConnectionNotFoundError extends Error {
  constructor(planId: string) {
    super(`No source connection found for plan: ${planId}`)
    this.name = 'SourceConnectionNotFoundError'
  }
}

// --- Helpers ---

function getAdapterInstance(adapterType: string) {
  switch (adapterType) {
    case 'demo':
      return new DemoSourceAdapter()
    // Future: 'salesforce' -> new SalesforceAdapter()
    default:
      return null
  }
}

// --- Service functions ---

/**
 * Connect a source adapter to a plan.
 * Validates adapter type, calls adapter.connect(), persists SourceConnection,
 * logs to audit trail. If a connection already exists it is replaced.
 */
export async function connectSource(planId: string, adapterType: string, config: Record<string, unknown>) {
  // Verify plan exists
  const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
  if (!plan) throw new PlanNotFoundError(planId)

  // Verify adapter is registered
  const metadata = getAdapterMetadata(adapterType)
  if (!metadata) throw new InvalidAdapterError(adapterType)

  // Verify adapter role is "source"
  if (metadata.role !== 'source') throw new InvalidAdapterError(adapterType)

  // Get adapter instance
  const adapter = getAdapterInstance(adapterType)
  if (!adapter) throw new InvalidAdapterError(adapterType)

  // If a connection already exists, delete it first (replace semantics)
  const existing = await prisma.sourceConnection.findUnique({ where: { planId } })
  if (existing) {
    await prisma.sourceConnection.delete({ where: { planId } })
    await logAction(planId, 'SOURCE_DISCONNECTED', { adapterType: existing.adapterType, reason: 'replaced' })
  }

  // Call adapter.connect() — may throw AuthFailedError
  let connection
  try {
    connection = await adapter.connect(config)
  } catch (err) {
    throw new AuthFailedError(err instanceof Error ? err.message : 'Authentication failed.')
  }

  // Persist the connection
  const now = new Date()
  const sourceConnection = await prisma.sourceConnection.create({
    data: {
      planId,
      adapterType,
      status: connection.status,
      config: JSON.stringify(config),
      connectedAt: now,
    },
  })

  await logAction(planId, 'SOURCE_CONNECTED', { adapterType, status: connection.status })

  return sourceConnection
}

/**
 * Disconnect and delete the source connection for a plan.
 * Cascade-deletes schema snapshots etc. (via Prisma relations in future features).
 * Returns a deletion summary.
 */
export async function disconnectSource(planId: string) {
  const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
  if (!plan) throw new PlanNotFoundError(planId)

  const existing = await prisma.sourceConnection.findUnique({ where: { planId } })
  if (!existing) throw new SourceConnectionNotFoundError(planId)

  // Cascade counts — these models are added in later features (003+)
  // For now we only track the connection row itself.
  const cascadeDeleted = {
    schemaSnapshots: 0,
    objectSelections: 0,
    objectFields: 0,
  }

  await prisma.sourceConnection.delete({ where: { planId } })

  await logAction(planId, 'SOURCE_DISCONNECTED', { adapterType: existing.adapterType, ...cascadeDeleted })

  return { deleted: true, cascadeDeleted }
}

/**
 * Get the current source connection for a plan, or null if none exists.
 */
export async function getSourceConnection(planId: string) {
  const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
  if (!plan) throw new PlanNotFoundError(planId)

  return prisma.sourceConnection.findUnique({ where: { planId } })
}

/**
 * Persist a source connection whose credentials have already been obtained
 * externally (e.g. by an OAuth callback route). Unlike `connectSource()`, this
 * does NOT call `adapter.connect()` — the caller is responsible for validating
 * tokens beforehand. Existing connection on the same plan is replaced.
 *
 * Used by the Salesforce OAuth callback to persist the token bundle returned
 * by the `/services/oauth2/token` exchange.
 */
export async function upsertSourceConnectionRaw(
  planId: string,
  adapterType: string,
  config: Record<string, unknown>,
  status: string,
) {
  const plan = await prisma.migrationPlan.findUnique({ where: { id: planId } })
  if (!plan) throw new PlanNotFoundError(planId)

  const existing = await prisma.sourceConnection.findUnique({ where: { planId } })
  if (existing) {
    await prisma.sourceConnection.delete({ where: { planId } })
    await logAction(planId, 'SOURCE_DISCONNECTED', { adapterType: existing.adapterType, reason: 'replaced-oauth' })
  }

  const connection = await prisma.sourceConnection.create({
    data: {
      planId,
      adapterType,
      status,
      config: JSON.stringify(config),
      connectedAt: new Date(),
    },
  })

  await logAction(planId, 'SOURCE_CONNECTED', { adapterType, status, method: 'oauth-callback' })

  return connection
}
