# Plan de récupération v4 — décisions & suivi

**Date** : 2026-06-15/16
**Contexte** : voir [regression-audit-v3-v4.md](regression-audit-v3-v4.md) — 130 régressions, échec d'implémentation (specs majoritairement saines, code en retard).

## Stratégie (affinée après lecture des data-model)

**Découverte clé** : les specs v4 se **contredisent entre elles** sur le data-model de base (voir §3). Donc **« régénérer avec speckit » est écarté** — la régen produirait des schémas incohérents. 

**Décision : remédiation ciblée + réconciliation des specs**, feature par feature :
1. Amener le code au niveau du *meilleur modèle canonique* pour chaque trou fonctionnel réel.
2. Réconcilier/enrichir les specs au passage pour qu'elles redeviennent une source de vérité cohérente (la régénérabilité depuis les specs doit être restaurée).
3. Porter depuis v3 (`.claude/worktrees/v3-recette-ref`) les algorithmes éprouvés plutôt que les re-dériver.

## 1. ÉTAPE 0 — Déblocage + fondation data-model — ✅ FAIT

- **Bug bloquant** : `step/route.ts` lisait `body.step` alors que le contrat spec + les 4 appelants utilisent `targetStep`. Route alignée. Débloque tout le parcours. (commit `8fbd0c1c`)
- **Fondation data-model** (ajouts additifs, schéma v4 globalement sain conservé) :
  - `PlanStatus` → `DRAFT/READY/BROKEN` (aligné spec 001/002/017 ; le code avait inventé `IN_PROGRESS/COMPLETED/ARCHIVED`, dont 2 morts). `plan-service.advanceStep` passe `READY` à l'étape DOCUMENTS.
  - `ObjectField.picklistValues` (013 value-equivalence) — **enrichi spec 005**.
  - `FieldMapping.sourceFieldType/destinationFieldType/autoCreated` (déjà spec 012).
  - `ObjectMapping.autoCreated` (déjà spec 011).
  - `ClassificationPrompt` model + relation (déjà spec 013).
  - `MigrationFilter.isActive` — **enrichi spec 015**.
  - `FilterOperator` + `DATE_AFTER/DATE_BEFORE` (déjà spec 015).
  - `TextDocument`/`ContractualDocument` + `unmappedCount/llmCallCount` (déjà specs 019/020).
- ⚠️ Nécessite `prisma generate` + `prisma db push` au déploiement (non exécutable en local Node 18). DB démo à re-pousser.

## 2. Ce qui est DÉRIVÉ/CALCULÉ (pas de colonne — redesign v4 délibéré)

- `linkStatus` 5-états (GREEN/ORANGE/RED_SOLID/RED_DASHED/BROKEN) → calculé via `computeLinkStatus()` (spec 012/013).
- `sectionType` (D1/D2/D3/D4) → calculé via `getSectionType(srcType, destType)` (spec 013). **Ne PAS stocker** (contrairement à v3).
- `LogicStatus` reste `DRAFT/DEFINED/VALIDATED` — **pas** d'`INCOMPATIBLE` (D3 = aucun record, spec 013).
- Broken-ness d'un mapping/champ → dérivée des `IntegrityIssue` (spec 017), **pas** de colonne `status` sur ObjectMapping (contrairement à v3).

## 3. Divergences spec↔spec / spec↔code à réconcilier (pendant la remédiation)

| Sujet | État | À faire |
|---|---|---|
| `SchemaSnapshot` | spec 002 (`data Json`+`side`) vs 003/005 (normalisé `role`/`status`+objets) — **contradictoire** ; code a fusionné `side`+`status`+objets (sain) | Garder le choix code ; réconcilier specs 002/003/005 |
| `ObjectSelection` | table séparée (004) vs champ `isSelected` sur SchemaObject (005) — contradictoire ; code = table séparée | Garder table séparée ; corriger spec 005 |
| `id` | `cuid()` (specs) vs `uuid()` (code) | Garder `uuid()` (non-fonctionnel) ; noter convention |
| `@@map` snake_case | dans specs, absent du code | Différé (renommerait les tables = reset DB) |
| `PlanStep` | `MAPPING` (spec) vs `OBJECT_MAPPING` (code, cohérent en interne) | Trancher en remédiation 001/011 |
| `MigrationFilter.fieldApiName` | code `fieldApiName` vs spec 015 `sourceFieldName` | Trancher en remédiation 015 |
| `IntegrityIssue` taxonomie | code = complétude (UNMAPPED/MISSING_LOGIC…) vs spec 017 = drift (SOURCE_OBJECT_DELETED…) | Unifier (complétude + drift) en remédiation 017 |
| `LogicStatus` vs `MigrationLogicStatus` | nom d'enum diffère | Cosmétique ; garder `LogicStatus` |

## 4. ÉTAPE 1 — Remédiation code, feature par feature (ordre des dépendances)

Chaque feature : (a) lire spec (data-model/contracts/tasks/quickstart), (b) **faire valider le plan de tests** par l'utilisateur, (c) implémenter le delta, (d) réconcilier la spec, (e) committer. Workflows pour le travail parallélisable (beaucoup de fichiers indépendants).

Ordre : `002/006 + adapters SF/HubSpot` → `003/007 diff+drift` → `004 sélection` → `005/008 champs (peupler isAccessible)` → `009/010 preview+stats` → `011 object-mapping (auto-link)` → `012 field-mapping (auto-match, types, linkStatus)` → `013 migration-logic (modale D1-D4, /classify)` → `015 filtres` → `016 unmapped + FieldExclusion CRUD` → `017 intégrité+statut+drift` → `018-021 documents (PDF, descriptions LLM)` → `022 schema-write (routes/service/UI)`.

## 5. ÉTAPE 2 — Port depuis v3

Registres sémantiques (auto-link objets SF→HS, auto-match champs), `computeLinkStatus`, `migrateSelection`, `repairBrokenMappings`, `MigrationPreviewPanel`, SVG bézier overlay, `getFilterableFields`, intégration `detectUnmappedFields` dans les documents.
