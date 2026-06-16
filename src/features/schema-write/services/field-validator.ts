// 022-schema-write — Field validation service (T005)
// Validates CreateFieldRequest / modify updates before the adapter call.
// All checks run locally against the current schema snapshot (no remote calls).

import { prisma } from '@/lib/prisma'
import { getAdapter } from '@/lib/adapters/registry'
import type { ValidationResult } from '@/lib/types/schema-write'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Resolve the current DESTINATION snapshot id for a connection. */
async function getCurrentSnapshotId(connectionId: string): Promise<string | null> {
  const snapshot = await prisma.schemaSnapshot.findUnique({
    where: { connectionId_side_status: { connectionId, side: 'DESTINATION', status: 'CURRENT' } },
    select: { id: true },
  })
  return snapshot?.id ?? null
}

/** Return all field apiNames already stored for an object in the snapshot. */
async function getExistingFieldNames(snapshotId: string, objectApiName: string): Promise<Set<string>> {
  const obj = await prisma.schemaObject.findUnique({
    where: { snapshotId_apiName: { snapshotId, apiName: objectApiName } },
    include: { fields: { select: { apiName: true } } },
  })
  if (!obj) return new Set()
  return new Set(obj.fields.map((f) => f.apiName))
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Validate a field-creation request against the current destination snapshot. (T005)
 *
 * Rules:
 * - `name` must not be empty
 * - `type` must be in the adapter's supportedFieldTypes
 * - `name` must not already exist on the object in the current snapshot
 * - If `type` is 'picklist' or 'enumeration', `picklistValues` must be non-empty
 */
export async function validateCreateField(
  connectionId: string,
  adapterType: string,
  objectApiName: string,
  fieldData: { name: string; type: string; picklistValues?: string[] },
): Promise<ValidationResult> {
  const errors: string[] = []

  console.log(`[FieldValidator] Validating field creation for '${fieldData.name}' on '${objectApiName}'`)

  // name required
  if (!fieldData.name || fieldData.name.trim() === '') {
    errors.push('Field name is required')
  }

  // type must be in supportedFieldTypes
  const adapter = getAdapter(adapterType)
  const supported = adapter.capabilities.supportedFieldTypes ?? []
  if (supported.length > 0 && fieldData.type && !supported.includes(fieldData.type)) {
    errors.push(`Field type '${fieldData.type}' is not supported. Supported types: ${supported.join(', ')}`)
  }

  // picklist requires values
  const isPicklist = ['picklist', 'enumeration'].includes(fieldData.type)
  if (isPicklist && (!fieldData.picklistValues || fieldData.picklistValues.length === 0)) {
    errors.push(`picklistValues is required for field type '${fieldData.type}'`)
  }

  // name uniqueness — checked against current snapshot if one exists
  if (fieldData.name && fieldData.name.trim() !== '') {
    const snapshotId = await getCurrentSnapshotId(connectionId)
    if (snapshotId) {
      const existing = await getExistingFieldNames(snapshotId, objectApiName)
      if (existing.has(fieldData.name)) {
        errors.push(`Field '${fieldData.name}' already exists on object '${objectApiName}'`)
      }
    }
  }

  if (errors.length > 0) {
    console.log(`[FieldValidator] Validation failed: ${errors.join('; ')}`)
    return { valid: false, errors }
  }

  console.log(`[FieldValidator] Validation passed for '${fieldData.name}'`)
  return { valid: true }
}

/**
 * Validate a field-modification request against the current destination snapshot. (T005)
 *
 * Rules:
 * - The field must exist in the current snapshot
 * - If renaming, new name must not conflict with an existing field
 * - If changing type, new type must be in supportedFieldTypes
 */
export async function validateModifyField(
  connectionId: string,
  adapterType: string,
  objectApiName: string,
  fieldApiName: string,
  updates: { name?: string; type?: string; label?: string; description?: string; picklistValues?: string[]; group?: string },
): Promise<ValidationResult> {
  const errors: string[] = []

  console.log(`[FieldValidator] Validating field modification for '${fieldApiName}' on '${objectApiName}'`)

  const snapshotId = await getCurrentSnapshotId(connectionId)
  if (!snapshotId) {
    // No snapshot — cannot validate but allow the adapter call to proceed
    console.log('[FieldValidator] No snapshot found — skipping snapshot-based checks')
    return { valid: true }
  }

  const existing = await getExistingFieldNames(snapshotId, objectApiName)

  // field must exist
  if (!existing.has(fieldApiName)) {
    errors.push(`Field '${fieldApiName}' does not exist on object '${objectApiName}'`)
  }

  // rename conflict
  if (updates.name && updates.name !== fieldApiName && existing.has(updates.name)) {
    errors.push(`Field '${updates.name}' already exists on object '${objectApiName}'`)
  }

  // type compatibility
  if (updates.type) {
    const adapter = getAdapter(adapterType)
    const supported = adapter.capabilities.supportedFieldTypes ?? []
    if (supported.length > 0 && !supported.includes(updates.type)) {
      errors.push(`Field type '${updates.type}' is not supported. Supported types: ${supported.join(', ')}`)
    }
  }

  if (errors.length > 0) {
    console.log(`[FieldValidator] Validation failed: ${errors.join('; ')}`)
    return { valid: false, errors }
  }

  console.log(`[FieldValidator] Modification validation passed for '${fieldApiName}'`)
  return { valid: true }
}
