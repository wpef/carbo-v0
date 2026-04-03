// 003-source-schema-retrieval — Schema retrieval service (connection-agnostic)

import { prisma } from '@/lib/db/prisma'
import { logAction } from './audit-service'
import { DemoSourceAdapter } from '@/lib/connectors/adapters/demo-source'
import { DemoDestinationAdapter } from '@/lib/connectors/adapters/demo-destination'
import type { ConnectorAdapter } from '@/lib/connectors/types'
import type { SchemaDiff } from '@/lib/types/schema'

// --- Errors ---

export class SchemaConnectionNotFoundError extends Error {
  constructor(connectionId: string, role: string) {
    super(`No ${role} connection found with id: ${connectionId}`)
    this.name = 'SchemaConnectionNotFoundError'
  }
}

export class SchemaConnectionNotConnectedError extends Error {
  constructor(connectionId: string) {
    super(`Connection ${connectionId} is not in CONNECTED status`)
    this.name = 'SchemaConnectionNotConnectedError'
  }
}

export class UnknownAdapterError extends Error {
  constructor(adapterType: string) {
    super(`Unknown adapter: ${adapterType}`)
    this.name = 'UnknownAdapterError'
  }
}

// --- Adapter factory ---

function getAdapterInstance(adapterType: string): ConnectorAdapter {
  switch (adapterType) {
    case 'demo':
      return new DemoSourceAdapter()
    case 'demo-destination':
      return new DemoDestinationAdapter()
    default:
      throw new UnknownAdapterError(adapterType)
  }
}

// --- Helpers ---

async function findConnectionRecord(connectionId: string, role: 'source' | 'destination') {
  if (role === 'source') {
    return prisma.sourceConnection.findUnique({ where: { id: connectionId } })
  }
  return prisma.destinationConnection.findUnique({ where: { id: connectionId } })
}

async function findPlanIdForConnection(connectionId: string, role: 'source' | 'destination'): Promise<string | null> {
  const record = await findConnectionRecord(connectionId, role)
  return record?.planId ?? null
}

// --- Service functions ---

/**
 * Retrieve the schema for a connection (source or destination).
 * Rotates snapshots: deletes PREVIOUS, demotes CURRENT to PREVIOUS, creates new CURRENT.
 */
export async function retrieveSchema(connectionId: string, role: 'source' | 'destination') {
  // Look up the connection record
  const connectionRecord = await findConnectionRecord(connectionId, role)
  if (!connectionRecord) {
    throw new SchemaConnectionNotFoundError(connectionId, role)
  }

  if (connectionRecord.status !== 'CONNECTED') {
    throw new SchemaConnectionNotConnectedError(connectionId)
  }

  const { adapterType, planId } = connectionRecord

  // Instantiate adapter
  const adapter = getAdapterInstance(adapterType)

  // Fetch schema from adapter
  const schema = await adapter.getSchema(connectionId)

  // Rotate snapshots: delete PREVIOUS, demote CURRENT to PREVIOUS
  await prisma.schemaSnapshot.deleteMany({
    where: { connectionId, role, status: 'PREVIOUS' },
  })

  await prisma.schemaSnapshot.updateMany({
    where: { connectionId, role, status: 'CURRENT' },
    data: { status: 'PREVIOUS' },
  })

  // Create new CURRENT snapshot
  const snapshot = await prisma.schemaSnapshot.create({
    data: {
      connectionId,
      role,
      status: 'CURRENT',
      objectCount: schema.objects.length,
      retrievedAt: new Date(),
      objects: {
        create: schema.objects.map((obj) => ({
          apiName: obj.apiName,
          label: obj.label,
          description: obj.description ?? null,
          isCustom: obj.isCustom,
        })),
      },
    },
    include: { objects: true },
  })

  await logAction(planId, 'SCHEMA_RETRIEVED', {
    connectionId,
    role,
    snapshotId: snapshot.id,
    objectCount: schema.objects.length,
  })

  return snapshot
}

/**
 * Get a snapshot (with objects) for a given connectionId + role + status.
 * Defaults to CURRENT.
 */
export async function getSnapshot(connectionId: string, role: string, status = 'CURRENT') {
  return prisma.schemaSnapshot.findFirst({
    where: { connectionId, role, status },
    include: { objects: true },
  })
}

/**
 * Compute diff between CURRENT and PREVIOUS snapshots for a connection.
 * Returns null if there is no previous snapshot (first retrieval).
 */
export async function computeDiff(connectionId: string, role: string): Promise<SchemaDiff | null> {
  const current = await getSnapshot(connectionId, role, 'CURRENT')
  const previous = await getSnapshot(connectionId, role, 'PREVIOUS')

  if (!current || !previous) {
    return null
  }

  const currentNames = new Set(current.objects.map((o) => o.apiName))
  const previousNames = new Set(previous.objects.map((o) => o.apiName))

  const added = [...currentNames].filter((name) => !previousNames.has(name))
  const removed = [...previousNames].filter((name) => !currentNames.has(name))
  const unchanged = [...currentNames].filter((name) => previousNames.has(name))

  // In this implementation, "modified" is not tracked at the object level
  // (would require field-level comparison — out of scope for 003)
  const modified: string[] = []

  return { added, removed, modified, unchanged }
}

/**
 * Find the connectionId for a given planId and role.
 * Used by API routes that receive planId.
 */
export async function getConnectionIdForPlan(planId: string, role: 'source' | 'destination'): Promise<string | null> {
  if (role === 'source') {
    const conn = await prisma.sourceConnection.findUnique({ where: { planId } })
    return conn?.id ?? null
  }
  const conn = await prisma.destinationConnection.findUnique({ where: { planId } })
  return conn?.id ?? null
}

/**
 * Find the connection status for a given planId and role.
 */
export async function getConnectionStatusForPlan(planId: string, role: 'source' | 'destination'): Promise<string | null> {
  if (role === 'source') {
    const conn = await prisma.sourceConnection.findUnique({ where: { planId } })
    return conn?.status ?? null
  }
  const conn = await prisma.destinationConnection.findUnique({ where: { planId } })
  return conn?.status ?? null
}
