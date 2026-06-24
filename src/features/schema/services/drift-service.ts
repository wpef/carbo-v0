// 003-source-schema-retrieval — Live drift detection (FR-012 … FR-016, Cluster 11)
// Loads the CURRENT snapshot from DB, fetches live schema via adapter, builds
// MappingContext from existing ObjectMapping / FieldMapping rows, then delegates
// to the pure computeDrift() core (lib/drift.ts, already committed).

import { prisma } from '@/lib/prisma'
import { getAdapter } from '@/lib/adapters/registry'
import { logAuditEvent } from '@/lib/audit'
import {
  computeDrift,
  buildUnavailableReport,
  type DriftReport,
  type SnapshotObject,
  type SnapshotField,
  type MappingContext,
} from '@/features/schema/lib/drift'
import type { SnapshotSide } from '@prisma/client'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Hydrate stored snapshot rows into the pure SnapshotObject[] shape
 * expected by computeDrift().
 */
function hydrateStoredSnapshot(
  objects: Array<{
    apiName: string
    label: string
    fields: Array<{
      apiName: string
      label: string
      dataType: string
      isRequired: boolean
      isReadOnly: boolean
      isUnique: boolean
      picklistValues: string | null
    }>
  }>,
): SnapshotObject[] {
  return objects.map((obj) => ({
    apiName: obj.apiName,
    label: obj.label,
    fields: obj.fields.map((f): SnapshotField => ({
      apiName: f.apiName,
      label: f.label,
      dataType: f.dataType,
      isRequired: f.isRequired,
      isReadOnly: f.isReadOnly,
      isUnique: f.isUnique,
      // Deserialise JSON picklist column — null means the field has no metadata
      picklistValues: f.picklistValues != null ? (JSON.parse(f.picklistValues) as string[]) : undefined,
    })),
  }))
}

/**
 * Build MappingContext from ObjectMapping / FieldMapping rows already present
 * in the plan.  Only mappings where sourceObjectName references a CURRENT-snapshot
 * object are counted (role=SOURCE) or destinationObjectName (role=DESTINATION).
 */
async function buildMappingContext(
  planId: string,
  role: 'source' | 'destination',
): Promise<MappingContext> {
  const objectMappings = await prisma.objectMapping.findMany({
    where: { planId },
    include: {
      fieldMappings: {
        select: {
          sourceFieldName: true,
          destinationFieldName: true,
        },
      },
    },
  })

  const mappedObjectApiNames = new Set<string>()
  const mappedFieldsByObject = new Map<string, Set<string>>()

  for (const om of objectMappings) {
    const objectApiName = role === 'source' ? om.sourceObjectName : om.destinationObjectName
    mappedObjectApiNames.add(objectApiName)

    const fieldSet = mappedFieldsByObject.get(objectApiName) ?? new Set<string>()
    for (const fm of om.fieldMappings) {
      const fieldApiName = role === 'source' ? fm.sourceFieldName : fm.destinationFieldName
      fieldSet.add(fieldApiName)
    }
    mappedFieldsByObject.set(objectApiName, fieldSet)
  }

  return { mappedObjectApiNames, mappedFieldsByObject }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * detectLiveDrift — FR-012 / FR-015
 *
 * 1. Load the CURRENT snapshot for the plan's connection (role).
 * 2. Call adapter.getSchema() to get the live object list and
 *    adapter.getFields() for each mapped object (field-level diff is only
 *    meaningful for objects referenced by an ObjectMapping, FR-016).
 * 3. Build MappingContext from existing ObjectMapping / FieldMapping rows.
 * 4. Delegate to computeDrift() (pure, no DB writes).
 * 5. Return DriftReport. Never throws — returns status='unavailable' on error.
 */
export async function detectLiveDrift(
  planId: string,
  role: 'source' | 'destination',
): Promise<DriftReport> {
  // Resolve the connection for this role
  const plan = await prisma.migrationPlan.findUnique({
    where: { id: planId },
    include: {
      sourceConnection: true,
      destinationConnection: true,
    },
  })

  if (!plan) {
    return buildUnavailableReport('', role, `Plan ${planId} not found`)
  }

  const connection = role === 'source' ? plan.sourceConnection : plan.destinationConnection
  if (!connection) {
    return buildUnavailableReport('', role, `No ${role} connection on plan ${planId}`)
  }

  const connectionId = connection.id
  const side: SnapshotSide = role === 'source' ? 'SOURCE' : 'DESTINATION'

  // Load CURRENT snapshot from DB (with all fields for hydration)
  const storedSnapshot = await prisma.schemaSnapshot.findUnique({
    where: { connectionId_side_status: { connectionId, side, status: 'CURRENT' } },
    include: {
      objects: {
        include: { fields: true },
        orderBy: { apiName: 'asc' },
      },
    },
  })

  if (!storedSnapshot) {
    return buildUnavailableReport(connectionId, role, 'No CURRENT snapshot — retrieve schema first')
  }

  const storedObjects = hydrateStoredSnapshot(storedSnapshot.objects)

  // Build mapping context before calling the adapter (needed to limit field fetching)
  const mappingCtx = await buildMappingContext(planId, role)

  // Fetch live schema from adapter — wrap in try/catch (FR-015 graceful failure)
  let liveObjects: SnapshotObject[]

  try {
    const adapter = getAdapter(connection.adapterType)
    const liveSchema = await adapter.getSchema(connectionId)

    // For mapped objects, also fetch live fields so field-level drift is visible
    const liveObjectMap = new Map<string, SnapshotObject>()
    for (const obj of liveSchema.objects) {
      liveObjectMap.set(obj.apiName, { apiName: obj.apiName, label: obj.label, fields: [] })
    }

    // Fetch fields for mapped objects only (FR-016 + avoid N+1 for unmapped ones)
    const mappedObjectNames = Array.from(mappingCtx.mappedObjectApiNames).filter((n) =>
      liveObjectMap.has(n),
    )

    for (const objectApiName of mappedObjectNames) {
      try {
        const fields = await adapter.getFields(connectionId, objectApiName)
        const liveObj = liveObjectMap.get(objectApiName)!
        liveObj.fields = fields.map((f): SnapshotField => ({
          apiName: f.apiName,
          label: f.label,
          dataType: f.dataType,
          isRequired: f.isRequired,
          isReadOnly: f.isReadOnly,
          isUnique: f.isUnique,
          picklistValues: f.picklistValues,
        }))
      } catch (fieldErr) {
        // Field fetch failure for one object is non-fatal — log and continue
        console.warn(`[drift] getFields(${objectApiName}) failed (non-fatal):`, fieldErr)
      }
    }

    liveObjects = Array.from(liveObjectMap.values())
  } catch (adapterErr) {
    const reason = adapterErr instanceof Error ? adapterErr.message : String(adapterErr)
    console.error(`[drift] adapter.getSchema failed for connection ${connectionId}:`, adapterErr)
    return buildUnavailableReport(connectionId, role, reason)
  }

  const report = computeDrift(connectionId, role, storedObjects, liveObjects, mappingCtx)

  // Audit trail — only log when there is actionable drift or an error (avoid noise)
  if (report.status !== 'ok') {
    await logAuditEvent({
      planId,
      action: 'DETECT_LIVE_DRIFT',
      entity: 'SchemaSnapshot',
      entityId: storedSnapshot.id,
      details: {
        role,
        status: report.status,
        critical: report.severitySummary.critical,
        warning: report.severitySummary.warning,
        info: report.severitySummary.info,
        reason: report.reason,
      },
    }).catch((err) => console.warn('[drift] audit log failed (non-fatal):', err))
  }

  return report
}

/**
 * computePersistedDrift — 003 FR-006 ("display the diff when a refresh is performed").
 *
 * Compares the two persisted snapshots PREVIOUS → CURRENT (both produced by
 * fetchAndStoreSchema's rotation) and returns a DriftReport describing what the
 * refresh just changed. Unlike detectLiveDrift this is purely DB-backed (no
 * adapter call) and is meant to be called by the schema POST route *after* the
 * new CURRENT has been written.
 *
 * Why this exists: calling detectLiveDrift() right after a refresh is a no-op,
 * because the new CURRENT was just written from the same live fetch the drift
 * compares against (CURRENT == live). The meaningful "what changed in this
 * refresh" is PREVIOUS → CURRENT, which this function computes.
 *
 * Returns status='ok' with no changes when there is no PREVIOUS snapshot
 * (first-ever retrieval — nothing to diff against). Never throws.
 */
export async function computePersistedDrift(
  planId: string,
  role: 'source' | 'destination',
): Promise<DriftReport> {
  const plan = await prisma.migrationPlan.findUnique({
    where: { id: planId },
    include: { sourceConnection: true, destinationConnection: true },
  })

  if (!plan) {
    return buildUnavailableReport('', role, `Plan ${planId} not found`)
  }

  const connection = role === 'source' ? plan.sourceConnection : plan.destinationConnection
  if (!connection) {
    return buildUnavailableReport('', role, `No ${role} connection on plan ${planId}`)
  }

  const connectionId = connection.id
  const side: SnapshotSide = role === 'source' ? 'SOURCE' : 'DESTINATION'

  const [currentSnapshot, previousSnapshot] = await Promise.all([
    prisma.schemaSnapshot.findUnique({
      where: { connectionId_side_status: { connectionId, side, status: 'CURRENT' } },
      include: { objects: { include: { fields: true }, orderBy: { apiName: 'asc' } } },
    }),
    prisma.schemaSnapshot.findUnique({
      where: { connectionId_side_status: { connectionId, side, status: 'PREVIOUS' } },
      include: { objects: { include: { fields: true }, orderBy: { apiName: 'asc' } } },
    }),
  ])

  if (!currentSnapshot) {
    return buildUnavailableReport(connectionId, role, 'No CURRENT snapshot — retrieve schema first')
  }

  // First-ever retrieval: nothing to diff against. Report 'ok' (no drift), per
  // 003 edge case "PREVIOUS is the first-ever snapshot → all objects added" is
  // surfaced by the live diff path; here we simply report no change.
  if (!previousSnapshot) {
    return {
      connectionId,
      role,
      checkedAt: new Date().toISOString(),
      status: 'ok',
      changes: [],
      severitySummary: { critical: 0, warning: 0, info: 0 },
    }
  }

  const currentObjects = hydrateStoredSnapshot(currentSnapshot.objects)
  const previousObjects = hydrateStoredSnapshot(previousSnapshot.objects)

  // PREVIOUS plays the role of "stored", CURRENT the role of "live" so that
  // additions/removals read in the natural refresh direction.
  const mappingCtx = await buildMappingContext(planId, role)
  const report = computeDrift(connectionId, role, previousObjects, currentObjects, mappingCtx)

  return report
}
