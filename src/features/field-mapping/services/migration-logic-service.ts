// 013-migration-logic — Re-export shim (v4 migration)
// The canonical service has moved to src/features/migration-logic/services/migration-logic-service.ts.
// This file keeps backward compatibility for:
//   - src/app/api/plans/[planId]/object-mappings/[mappingId]/migration-logic/route.ts (legacy route)
//   - src/features/field-mapping/services/field-mapping-service.ts (buildLogicSnapshot usage)

export {
  getMigrationLogic,
  saveMigrationLogic,
  deleteMigrationLogic,
  getInformationalMessage,
  buildMigrationLogicContext,
} from '@/features/migration-logic/services/migration-logic-service'

export type {
  MigrationLogicDTO,
  SaveMigrationLogicInput,
  ValueEquivalenceItem,
} from '@/features/migration-logic/services/migration-logic-service'
