// 003-source-schema-retrieval — Schema drift detection (FR-012 … FR-016)
// PURE module: no Prisma, no network, no React, no side effects.
// Adapter calls and DB reads are performed by the caller (service layer) and
// injected via function arguments.

// ---------------------------------------------------------------------------
// Canonical taxonomy (FR-013 — single source of truth, spec table §Drift Detection)
// ---------------------------------------------------------------------------

export const DRIFT_MODIFICATION_TYPES = {
  OBJECT_ADDED:           { severity: 'info'     as const },
  OBJECT_REMOVED:         { severity: 'critical' as const },
  FIELD_ADDED:            { severity: 'info'     as const },
  FIELD_REMOVED:          { severity: 'critical' as const },
  /** severity 'critical' by default; downgraded to 'info' when types are compatible */
  FIELD_TYPE_CHANGED:     { severity: 'critical' as const },
  FIELD_BECAME_REQUIRED:  { severity: 'warning'  as const },
  FIELD_BECAME_OPTIONAL:  { severity: 'info'     as const },
  FIELD_LABEL_CHANGED:    { severity: 'info'     as const },
  /** warning only when a D1 (Value Equivalence) mapping exists for the field */
  PICKLIST_VALUE_ADDED:   { severity: 'warning'  as const },
  /** warning only when the removed value is referenced in a D1 equivalence */
  PICKLIST_VALUE_REMOVED: { severity: 'warning'  as const },
  FIELD_READONLY_CHANGED: { severity: 'warning'  as const },
  FIELD_UNIQUE_CHANGED:   { severity: 'warning'  as const },
} as const

export type DriftModificationType = keyof typeof DRIFT_MODIFICATION_TYPES
export type DriftSeverity = 'info' | 'warning' | 'critical'

// ---------------------------------------------------------------------------
// DriftChange — one atomic difference (FR-013)
// ---------------------------------------------------------------------------

export interface DriftChange {
  type: DriftModificationType
  objectApiName: string
  /** Absent for object-level changes (OBJECT_ADDED / OBJECT_REMOVED) */
  fieldApiName?: string
  before?: unknown
  after?: unknown
  severity: DriftSeverity
  /** true when an existing ObjectMapping or FieldMapping references this object/field */
  affectsMapping: boolean
}

// ---------------------------------------------------------------------------
// DriftReport — full report returned by computeDrift / detectLiveDrift (FR-012, FR-015)
// ---------------------------------------------------------------------------

export interface DriftReport {
  connectionId: string
  role: 'source' | 'destination'
  checkedAt: string // ISO 8601
  status: 'ok' | 'drift' | 'unavailable'
  changes: DriftChange[]
  severitySummary: {
    critical: number
    warning: number
    info: number
  }
  /** Populated when status='unavailable' */
  reason?: string
}

// ---------------------------------------------------------------------------
// Snapshot types (in-memory projection; caller hydrates from DB)
// ---------------------------------------------------------------------------

export interface SnapshotField {
  apiName: string
  label: string
  dataType: string
  isRequired: boolean
  isReadOnly: boolean
  isUnique: boolean
  picklistValues?: string[]
}

export interface SnapshotObject {
  apiName: string
  label: string
  fields: SnapshotField[]
}

// ---------------------------------------------------------------------------
// Context injected by the caller for affectsMapping resolution (FR-016)
// ---------------------------------------------------------------------------

export interface MappingContext {
  /** Set of objectApiName values referenced by an existing ObjectMapping */
  mappedObjectApiNames: Set<string>
  /** Map from objectApiName → Set<fieldApiName> for existing FieldMappings */
  mappedFieldsByObject: Map<string, Set<string>>
}

// ---------------------------------------------------------------------------
// computeDrift — pure comparison between a stored snapshot and a live schema
// ---------------------------------------------------------------------------

/**
 * Compare `stored` snapshot objects to `live` objects and produce a DriftReport.
 *
 * FR-016: field-level inspection is limited to objects present in `mappingCtx`.
 * Unmapped objects are inspected at object-level only (added / removed).
 *
 * @param connectionId  - passed through to the report
 * @param role          - passed through to the report
 * @param stored        - objects from the CURRENT snapshot (from DB)
 * @param live          - objects retrieved live from the adapter
 * @param mappingCtx    - which objects/fields are referenced by existing mappings
 * @returns DriftReport (never throws — caller may wrap in try/catch for FR-015)
 */
export function computeDrift(
  connectionId: string,
  role: 'source' | 'destination',
  stored: SnapshotObject[],
  live: SnapshotObject[],
  mappingCtx: MappingContext,
): DriftReport {
  const checkedAt = new Date().toISOString()
  const changes: DriftChange[] = []

  const storedMap = new Map(stored.map((o) => [o.apiName, o]))
  const liveMap   = new Map(live.map((o) => [o.apiName, o]))

  // --- Object-level additions ---
  for (const [apiName] of liveMap) {
    if (!storedMap.has(apiName)) {
      changes.push({
        type:          'OBJECT_ADDED',
        objectApiName: apiName,
        severity:      'info',
        affectsMapping: false, // newly added → cannot already be mapped
      })
    }
  }

  // --- Object-level removals ---
  for (const [apiName] of storedMap) {
    if (!liveMap.has(apiName)) {
      changes.push({
        type:          'OBJECT_REMOVED',
        objectApiName: apiName,
        severity:      'critical',
        affectsMapping: mappingCtx.mappedObjectApiNames.has(apiName),
      })
    }
  }

  // --- Field-level diff (only for objects present in both snapshots) ---
  for (const [apiName, storedObj] of storedMap) {
    const liveObj = liveMap.get(apiName)
    if (!liveObj) continue // handled as OBJECT_REMOVED above

    // FR-016: restrict field inspection to mapped objects
    const isMapped = mappingCtx.mappedObjectApiNames.has(apiName)
    if (!isMapped) continue

    const mappedFields = mappingCtx.mappedFieldsByObject.get(apiName) ?? new Set<string>()

    const storedFieldMap = new Map(storedObj.fields.map((f) => [f.apiName, f]))
    const liveFieldMap   = new Map(liveObj.fields.map((f) => [f.apiName, f]))

    // Field additions
    for (const [fApiName] of liveFieldMap) {
      if (!storedFieldMap.has(fApiName)) {
        changes.push({
          type:          'FIELD_ADDED',
          objectApiName: apiName,
          fieldApiName:  fApiName,
          severity:      'info',
          affectsMapping: false,
        })
      }
    }

    // Field removals and modifications
    for (const [fApiName, storedField] of storedFieldMap) {
      const liveField = liveFieldMap.get(fApiName)
      const fieldAffects = mappedFields.has(fApiName)

      if (!liveField) {
        changes.push({
          type:           'FIELD_REMOVED',
          objectApiName:  apiName,
          fieldApiName:   fApiName,
          severity:       'critical',
          affectsMapping: fieldAffects,
        })
        continue
      }

      // dataType changed
      if (storedField.dataType !== liveField.dataType) {
        // Downgrade severity to 'info' for widening-compatible changes (e.g. text→textarea)
        const severity = isCompatibleTypeChange(storedField.dataType, liveField.dataType)
          ? ('info' as const)
          : ('critical' as const)
        changes.push({
          type:           'FIELD_TYPE_CHANGED',
          objectApiName:  apiName,
          fieldApiName:   fApiName,
          before:         storedField.dataType,
          after:          liveField.dataType,
          severity,
          affectsMapping: fieldAffects,
        })
      }

      // isRequired changed
      if (storedField.isRequired !== liveField.isRequired) {
        const type: DriftModificationType = liveField.isRequired
          ? 'FIELD_BECAME_REQUIRED'
          : 'FIELD_BECAME_OPTIONAL'
        changes.push({
          type,
          objectApiName:  apiName,
          fieldApiName:   fApiName,
          before:         storedField.isRequired,
          after:          liveField.isRequired,
          severity:       DRIFT_MODIFICATION_TYPES[type].severity,
          affectsMapping: fieldAffects,
        })
      }

      // label changed
      if (storedField.label !== liveField.label) {
        changes.push({
          type:           'FIELD_LABEL_CHANGED',
          objectApiName:  apiName,
          fieldApiName:   fApiName,
          before:         storedField.label,
          after:          liveField.label,
          severity:       'info',
          affectsMapping: fieldAffects,
        })
      }

      // isReadOnly changed
      if (storedField.isReadOnly !== liveField.isReadOnly) {
        changes.push({
          type:           'FIELD_READONLY_CHANGED',
          objectApiName:  apiName,
          fieldApiName:   fApiName,
          before:         storedField.isReadOnly,
          after:          liveField.isReadOnly,
          severity:       'warning',
          affectsMapping: fieldAffects,
        })
      }

      // isUnique changed
      if (storedField.isUnique !== liveField.isUnique) {
        changes.push({
          type:           'FIELD_UNIQUE_CHANGED',
          objectApiName:  apiName,
          fieldApiName:   fApiName,
          before:         storedField.isUnique,
          after:          liveField.isUnique,
          severity:       'warning',
          affectsMapping: fieldAffects,
        })
      }

      // Picklist value changes (only when both sides carry picklist metadata)
      const storedPL = storedField.picklistValues
      const livePL   = liveField.picklistValues
      if (storedPL && livePL) {
        const storedSet = new Set(storedPL)
        const liveSet   = new Set(livePL)

        for (const val of liveSet) {
          if (!storedSet.has(val)) {
            changes.push({
              type:           'PICKLIST_VALUE_ADDED',
              objectApiName:  apiName,
              fieldApiName:   fApiName,
              after:          val,
              severity:       'warning',
              affectsMapping: fieldAffects,
            })
          }
        }
        for (const val of storedSet) {
          if (!liveSet.has(val)) {
            changes.push({
              type:           'PICKLIST_VALUE_REMOVED',
              objectApiName:  apiName,
              fieldApiName:   fApiName,
              before:         val,
              severity:       'warning',
              affectsMapping: fieldAffects,
            })
          }
        }
      }
    }
  }

  // Severity summary
  const severitySummary = { critical: 0, warning: 0, info: 0 }
  for (const c of changes) {
    severitySummary[c.severity]++
  }

  const status: DriftReport['status'] = changes.length === 0 ? 'ok' : 'drift'

  return { connectionId, role, checkedAt, status, changes, severitySummary }
}

// ---------------------------------------------------------------------------
// buildUnavailableReport — FR-015 graceful failure helper
// ---------------------------------------------------------------------------

/**
 * Build a DriftReport with status='unavailable' when the live re-fetch fails.
 * The caller catches the adapter error and delegates here — no throws propagate.
 */
export function buildUnavailableReport(
  connectionId: string,
  role: 'source' | 'destination',
  reason: string,
): DriftReport {
  return {
    connectionId,
    role,
    checkedAt: new Date().toISOString(),
    status: 'unavailable',
    changes: [],
    severitySummary: { critical: 0, warning: 0, info: 0 },
    reason,
  }
}

// ---------------------------------------------------------------------------
// mergeDriftReports — 001 FR-015 (plan-level merge of source + destination)
// ---------------------------------------------------------------------------

/**
 * Merge the source and destination DriftReports into a single plan-level report
 * for rendering by the banner / PlanDriftContext (001 §"Drift report computation").
 *
 * Merge rules:
 * - `changes` are concatenated (each DriftChange already carries `role` via its
 *   originating report; the merged report keeps every change so consumers can
 *   filter by side using the per-report context they hold separately).
 * - `severitySummary` is summed.
 * - `status` precedence: 'drift' if either side drifted, else 'unavailable' if
 *   either side is unavailable (degraded — 001 FR-016), else 'ok'.
 * - `checkedAt` is the most recent of the two.
 * - Absent sides (null) are skipped — a plan with no destination connection
 *   contributes nothing (001: "that side is skipped").
 *
 * The merged report's `connectionId`/`role` are not meaningful at plan level;
 * `role` is set to 'source' as a stable placeholder and `connectionId` to ''.
 */
export function mergeDriftReports(
  source: DriftReport | null,
  destination: DriftReport | null,
): DriftReport | null {
  const present = [source, destination].filter((r): r is DriftReport => r != null)
  if (present.length === 0) return null

  const changes = present.flatMap((r) => r.changes)
  const severitySummary = present.reduce(
    (acc, r) => ({
      critical: acc.critical + r.severitySummary.critical,
      warning: acc.warning + r.severitySummary.warning,
      info: acc.info + r.severitySummary.info,
    }),
    { critical: 0, warning: 0, info: 0 },
  )

  const anyDrift = present.some((r) => r.status === 'drift')
  const anyUnavailable = present.some((r) => r.status === 'unavailable')
  const status: DriftReport['status'] = anyDrift ? 'drift' : anyUnavailable ? 'unavailable' : 'ok'

  const checkedAt = present
    .map((r) => r.checkedAt)
    .sort()
    .at(-1)!

  const reason = anyUnavailable
    ? present.find((r) => r.status === 'unavailable')?.reason
    : undefined

  return {
    connectionId: '',
    role: 'source',
    checkedAt,
    status,
    changes,
    severitySummary,
    ...(reason ? { reason } : {}),
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns true when a type change is considered "compatible" (widening only).
 * In that case FIELD_TYPE_CHANGED is downgraded from 'critical' to 'info'.
 *
 * Conservative list intentionally kept small — better to over-flag than miss.
 * Salesforce examples: string→textarea, int→double (widening numerics).
 * HubSpot examples: single_line_text→multi_line_text.
 */
const COMPATIBLE_TYPE_WIDENING: [string, string][] = [
  ['string',            'textarea'],
  ['int',               'double'],
  ['integer',           'double'],
  ['single_line_text',  'multi_line_text'],
  ['number',            'decimal'],
]

function isCompatibleTypeChange(before: string, after: string): boolean {
  return COMPATIBLE_TYPE_WIDENING.some(([b, a]) => b === before && a === after)
}
