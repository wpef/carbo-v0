# 03 — Data model

**Statut** : document normatif du dossier de fondation v5.
**Dernière mise à jour** : 2026-07-02.
**Source de vérité** : `prisma/schema.prisma` de la worktree v4 récupérée (`keen-matsumoto-22c856`). Ce fichier est le **point de départ officiel du data-model v5** (décision utilisateur) : il sera **copié tel quel en Phase 1**. Le présent document ne recopie pas le schéma — il explique les décisions et fixe ce qui est non négociable.
**Références** : `.specify/regression-audit-v3-v4.md` (audit des 130 régressions, §2 pour les trous data-model) et `.specify/recovery-decisions.md` (arbitrages de réconciliation).

## 1. Pourquoi ce schéma est le point de départ

Les specs speckit v4 se contredisaient entre elles sur le data-model de base (SchemaSnapshot modélisé de 3 façons incompatibles, ObjectSelection tantôt table tantôt champ, `cuid()` vs `uuid()`…). Le schéma récupéré est le résultat de la **réconciliation** de ces contradictions (recovery-decisions §3) plus le comblement des **9 trous structurels** identifiés par l'audit (§8 ci-dessous). Régénérer un schéma depuis les specs reproduirait les incohérences ; on repart donc du schéma réconcilié, et les specs/docs s'alignent dessus — pas l'inverse.

## 2. Vue d'ensemble des modèles (18 modèles)

| Modèle | Rôle | Relations clés |
|---|---|---|
| `MigrationPlan` | Conteneur racine de tout le parcours (statut, étape courante) | 1↔1 optionnelles vers 2 `ConnectorConnection` (source/destination) ; 1→N `ObjectMapping`, `IntegrityIssue`, `TextDocument`, `ContractualDocument`, `AuditLog` |
| `ConnectorConnection` | Connexion à un CRM via un adaptateur (type, config, secrets) | 1→N `SchemaSnapshot` ; référencée par 0..1 plan côté source et 0..1 côté destination |
| `SchemaSnapshot` | Photo datée du schéma d'une connexion (côté + statut CURRENT/PREVIOUS) | N→1 `ConnectorConnection` (cascade) ; 1→N `SchemaObject` ; `@@unique(connectionId, side, status)` |
| `SchemaObject` | Objet CRM d'un snapshot (apiName, label, isCustom) | N→1 `SchemaSnapshot` (cascade) ; 1→N `ObjectField` ; `@@unique(snapshotId, apiName)` |
| `ObjectSelection` | Sélection d'un objet source dans le périmètre du plan | Table autonome sans FK Prisma — clés scalaires `connectionId`/`snapshotId`/`objectApiName`, `@@unique` sur le triplet |
| `ObjectField` | Champ d'un objet (type, contraintes, picklist, accessibilité) | N→1 `SchemaObject` (cascade) ; `@@unique(objectId, apiName)` |
| `ObjectMapping` | Association objet source → objet destination d'un plan | N→1 `MigrationPlan` (cascade) ; 1→N `FieldMapping`, `MigrationFilter`, `FieldExclusion` ; `@@unique(planId, sourceObjectName, destinationObjectName)` |
| `FieldMapping` | Association champ source → champ destination (types bruts, compatibilité) | N→1 `ObjectMapping` (cascade) ; 0..1 `MigrationLogic` ; `@@unique` séparés sur (mapping, sourceField) et (mapping, destinationField) |
| `MigrationLogic` | Règle de migration attachée à un field mapping (config JSON, statut) | 1↔1 `FieldMapping` (cascade) ; 1→N `ValueEquivalence` ; 0..1 `ClassificationPrompt` |
| `ValueEquivalence` | Correspondance valeur source → valeur destination (picklists) | N→1 `MigrationLogic` (cascade) |
| `ClassificationPrompt` | Prompt LLM pour la classification texte → picklist (section D2) | 1↔1 `MigrationLogic` (cascade) |
| `MigrationFilter` | Filtre d'enregistrements sur un object mapping (champ, opérateur, valeur, actif) | N→1 `ObjectMapping` (cascade) |
| `FieldExclusion` | Exclusion explicite d'un champ source non mappé (raison, date) | N→1 `ObjectMapping` (cascade) ; `@@unique(objectMappingId, sourceFieldName)` |
| `IntegrityIssue` | Problème d'intégrité détecté sur une entité du plan (type, sévérité, résolu) | N→1 `MigrationPlan` (cascade) ; `@@unique(planId, entityType, entityId, issueType)` |
| `TextDocument` | Document texte généré (HTML versionné + compteurs) | N→1 `MigrationPlan` (cascade) |
| `ContractualDocument` | Document contractuel généré (référence unique, HTML versionné + compteurs) | N→1 `MigrationPlan` (cascade) |
| `SchemaWriteOperation` | Trace d'audit d'une écriture de schéma côté destination (022) | Table autonome sans FK Prisma (clé scalaire `connectionId`) |
| `AuditLog` | Journal d'audit générique (action, entité, détails JSON) | N→1 optionnelle `MigrationPlan` (cascade) |

### Enums (11)

| Enum | Valeurs | Porté par |
|---|---|---|
| `PlanStatus` | `DRAFT`, `READY`, `BROKEN` (l. 15-19) | `MigrationPlan.status` |
| `PlanStep` | `SOURCE`, `DESTINATION`, `OBJECT_MAPPING`, `FIELD_MAPPING`, `DOCUMENTS` (l. 21-27) | `MigrationPlan.currentStep` |
| `ConnectionStatus` | `CONNECTED`, `EXPIRED`, `ERROR` (l. 53-57) | `ConnectorConnection.status` |
| `SnapshotSide` | `SOURCE`, `DESTINATION` (l. 76-79) | `SchemaSnapshot.side` |
| `SnapshotStatus` | `CURRENT`, `PREVIOUS` (l. 81-84) | `SchemaSnapshot.status` |
| `CompatibilityStatus` | `COMPATIBLE`, `WARNING`, `INCOMPATIBLE` (l. 169-173) | `FieldMapping.compatibilityStatus` |
| `LogicStatus` | `DRAFT`, `DEFINED`, `VALIDATED` (l. 194-198) — pas d'`INCOMPATIBLE`, cf. D8/V2 | `MigrationLogic.status` |
| `FilterOperator` | 11 valeurs (l. 235-247), cf. D7/V1 | `MigrationFilter.operator` |
| `IntegrityEntityType` | `OBJECT_MAPPING`, `FIELD_MAPPING`, `MIGRATION_LOGIC`, `MIGRATION_FILTER` (l. 276-281) | `IntegrityIssue.entityType` |
| `IntegrityIssueType` | `UNMAPPED_REQUIRED_FIELD`, `INCOMPATIBLE_TYPE`, `MISSING_LOGIC`, `INVALID_FILTER`, `BROKEN_REFERENCE`, `MISSING_EQUIVALENCE` (l. 283-290) — taxonomie « complétude » ; l'unification avec la taxonomie « drift » de la spec 017 reste à faire (recovery-decisions §3) | `IntegrityIssue.issueType` |
| `DocumentStatus` | `CURRENT`, `OUTDATED` (l. 311-314) | `TextDocument.status`, `ContractualDocument.status` |

Deux champs sont des String libres là où on attendrait un enum : `IntegrityIssue.severity` (défaut `"ERROR"`, l. 298) et `SchemaWriteOperation.status`/`operationType` (l. 357-360). C'est l'état réel du schéma ; un durcissement éventuel en enum est une évolution v5 possible mais non requise.

## 3. Décisions canoniques (normatif)

Chaque décision est vérifiée contre le `schema.prisma` réel (lignes citées). Toute évolution v5 du schéma doit respecter ces décisions ou les amender explicitement ici.

**D1 — `uuid()` partout, jamais `cuid()`** (l. 30, 60, 87, 101, 117, 129, 151, 176, 201, 214, 225, 249, 262, 293, 317, 334, 355, 368). Les specs v4 disaient `cuid()`, le code `uuid()` ; différence non fonctionnelle, on fige `uuid()` comme convention.

**D2 — Pas de `@@map` snake_case.** Aucun `@@map` dans le schéma (vérifié : zéro occurrence). Les specs v4 en prescrivaient ; renommer les tables imposerait un reset de la DB démo pour un gain nul. Les noms de tables Prisma par défaut (PascalCase) sont canoniques.

**D3 — `PlanStatus = DRAFT | READY | BROKEN`** (l. 15-19). La v4 avait inventé `IN_PROGRESS/COMPLETED/ARCHIVED` (dont 2 morts) et surtout **omis `BROKEN`** — le plan ne pouvait jamais signaler un mapping cassé. `READY` est atteint en bout de parcours (étape DOCUMENTS) ; `BROKEN` est posé par le contrôle d'intégrité.

**D4 — `PlanStep` inclut `OBJECT_MAPPING`** (l. 21-27) : `SOURCE / DESTINATION / OBJECT_MAPPING / FIELD_MAPPING / DOCUMENTS`. La spec 001 disait `MAPPING` (fusionné) ; le découpage en deux étapes est canonique.

**D5 — `SchemaSnapshot` réconcilié : `side` + `status` + relation `objects`** (l. 86-97). C'était modélisé de **3 façons incompatibles** dans les specs v4 (spec 002 : blob `data Json` + `side` ; specs 003/005 : normalisé `role`/`status`). Le modèle canonique combine : `side` (`SOURCE`/`DESTINATION`, l. 76-79), `status` (`CURRENT`/`PREVIOUS`, l. 81-84), objets normalisés en relation (l. 94), et l'invariant `@@unique([connectionId, side, status])` (l. 96) — un seul snapshot CURRENT par connexion et par côté, le PREVIOUS servant au diff/drift.

**D6 — `ObjectSelection` = table séparée, pas un champ** (l. 117-125). La spec 005 mettait un `isSelected` sur `SchemaObject` — contradictoire avec la spec 004 et destructeur : la sélection aurait été perdue à chaque refresh de snapshot. La table séparée (clé `connectionId + snapshotId + objectApiName`, l. 124) permet de **migrer la sélection** d'un snapshot à l'autre (`migrateSelection`). Elle est volontairement sans FK Prisma (résolution par apiName, cf. §5).

**D7 — `MigrationFilter.fieldApiName` + `isActive` + `FilterOperator` à 11 opérateurs** (l. 249-258 et 235-247). `fieldApiName` (l. 252, la spec 015 disait `sourceFieldName` — tranché : apiName), `isActive` (l. 255, toggle on/off sans suppression). Opérateurs présents : `EQUALS, NOT_EQUALS, CONTAINS, NOT_CONTAINS, STARTS_WITH, ENDS_WITH, GREATER_THAN, LESS_THAN, IS_NULL, DATE_AFTER, DATE_BEFORE`. ⚠️ Voir divergence V1 (§7) : `IS_NOT_NULL` et `NOT_IN` sont absents du schéma réel.

**D8 — `LogicStatus`** (l. 194-198) : `DRAFT / DEFINED / VALIDATED`. ⚠️ Voir divergence V2 (§7) : pas de valeur `INCOMPATIBLE` — omission **délibérée** actée dans recovery-decisions §2 (un champ D3/incompatible n'a simplement **aucun** enregistrement `MigrationLogic` ; l'incompatibilité est portée par `FieldMapping.compatibilityStatus` et le calcul de section).

**D9 — `MigrationLogic` avec `createdAt`/`updatedAt`** (l. 206-207) et `config` JSON + `description` (l. 204-205). ⚠️ Voir divergence V3 (§7) : **pas de colonne `sectionType`** — décision recovery §2 : la section D1–D4 est **calculée** via `getSectionType(srcType, destType)`, jamais stockée (contrairement à v3). C'est l'application de la règle transversale §6.

**D10 — Modèle `ClassificationPrompt`** (l. 225-231) : 1↔1 avec `MigrationLogic` (l. 227 `@unique`), porte le `promptText` de la classification LLM texte → picklist (section D2). Son absence en v4 rendait la modale D1–D4 structurellement impossible.

**D11 — `ObjectField.picklistValues` + `isAccessible`** (l. 142 et 139). `picklistValues` : JSON array des valeurs de picklist, prérequis structurel de la value-equivalence (013). `isAccessible` : ⚠️ la colonne existait déjà en v4 mais **n'était pas peuplée** par le `createMany` du field-retrieval — perte silencieuse de données, violation de la Constitution. **Règle v5 : toute écriture de champs DOIT peupler `isAccessible`** (et `picklistValues`) ; c'est un item de la checklist d'acceptation (05), pas seulement une colonne.

**D12 — `FieldExclusion.createdAt`** (l. 267) : l'exclusion d'un champ est un acte tracé et daté (elle apparaît dans les documents contractuels).

**D13 — Timestamps d'idempotence : `MigrationPlan.objectAutoLinkedAt`** (l. 35) **et `ObjectMapping.fieldAutoMatchedAt`** (l. 157). L'auto-link des objets et l'auto-match des champs ne s'exécutent qu'une fois (timestamp null → exécution → timestamp posé) ; un re-passage sur la page ne recrée ni n'écrase les mappings modifiés à la main. En v4 les colonnes existaient mais la logique qui les remplit n'a jamais été écrite — la v5 doit livrer les deux.

**D14 — `CompatibilityStatus` sur `FieldMapping`** (l. 169-173, 182) : `COMPATIBLE / WARNING / INCOMPATIBLE`, seul statut **stocké** au niveau du field mapping, alimenté à la création/modification à partir des types bruts `sourceFieldType`/`destinationFieldType` (l. 180-181, snapshot des types au moment du mapping — sert à détecter les typeChanges au refresh).

## 4. Sémantique de suppression (cascades)

État réel du schéma, à connaître avant d'écrire le moindre service de suppression :

- **Supprimer un plan** cascade sur : `ObjectMapping` (→ `FieldMapping` → `MigrationLogic` → `ValueEquivalence` + `ClassificationPrompt` ; → `MigrationFilter` ; → `FieldExclusion`), `IntegrityIssue`, `TextDocument`, `ContractualDocument`, `AuditLog` (l. 159, 185, 209, 220, 230, 257, 269, 304, 329, 349, 376 — tous `onDelete: Cascade`).
- **Supprimer un plan ne supprime PAS ses connexions** : les relations plan→connexion (l. 41-42) n'ont pas de cascade ; une `ConnectorConnection` peut survivre à son plan.
- **Supprimer une connexion** cascade sur `SchemaSnapshot` → `SchemaObject` → `ObjectField` (l. 93, 109, 144).
- **Deux tables sans FK Prisma, donc sans cascade** : `ObjectSelection` (l. 117-125) et `SchemaWriteOperation` (l. 354-363). Leur nettoyage est de la responsabilité du code applicatif — un service de suppression de connexion/plan qui les oublie laisse des lignes orphelines. À couvrir par test.

## 5. Résolution par apiName (anti-stale-FK)

`ObjectMapping` et `FieldMapping` référencent les objets/champs par **nom** (`sourceObjectName`, `sourceFieldName`…), pas par FK vers `SchemaObject`/`ObjectField`. De même `ObjectSelection`, `MigrationFilter.fieldApiName` et `SchemaWriteOperation`. Raison : les snapshots sont recréés à chaque refresh (delete + create en cascade) ; des FK vers les lignes de snapshot deviendraient stales à chaque refresh. La résolution se fait par apiName à la lecture, contre le snapshot CURRENT (spec 017 : « FK = simple indice »). C'est ce qui rend le diff/drift et la réparation (`repairBrokenMappings`) possibles.

## 6. Règle transversale : calculé à la lecture, pas stocké

Ce qui suit n'a **pas de colonne** et ne doit jamais en avoir (redesign v4 délibéré, recovery-decisions §2) :

| Concept | Calcul | Vérifié dans le schéma |
|---|---|---|
| `linkStatus` 5 états (GREEN / ORANGE / RED_SOLID / RED_DASHED / BROKEN) | `computeLinkStatus()` à partir de compatibilité + logique + intégrité, avec précédence du BROKEN (spec 012 FR-007) | `FieldMapping` ne stocke que `compatibilityStatus` 3 états (l. 182) — conforme |
| `sectionType` D1/D2/D3/D4 | `getSectionType(srcType, destType)` (spec 013) | aucune colonne sur `MigrationLogic` (l. 200-212) — conforme |
| Broken-ness d'un mapping/champ | dérivée des `IntegrityIssue` (spec 017) | aucune colonne `status` sur `ObjectMapping` (l. 151-165) — conforme |

Rationale : ces états dépendent du schéma live et des issues d'intégrité ; les stocker créerait des données périmées à chaque refresh (c'est exactement le bug de staleness que la v3 traînait). Le seul état persistant lié à la casse est `PlanStatus.BROKEN` (niveau plan) et les lignes `IntegrityIssue` (faits datés, résolubles).

## 7. Divergences relevées (schéma réel vs décisions annoncées)

| # | Décision annoncée | État réel du schéma | Arbitrage |
|---|---|---|---|
| V1 | `FilterOperator` complet **dont `IS_NOT_NULL` / `NOT_IN`** | 11 opérateurs (l. 235-247) mais `IS_NOT_NULL` et `NOT_IN` **absents** ; `IS_NULL`, `DATE_AFTER`, `DATE_BEFORE` présents | **À trancher en Phase 1** : soit ajouter les 2 opérateurs (additif, sans risque), soit amender la décision. En l'état, le schéma copié tel quel ne les aura pas. |
| V2 | `LogicStatus` inclut `INCOMPATIBLE` | Absent (l. 194-198) — omission **délibérée** (recovery-decisions §2 : « D3 = aucun record ») | Le schéma et recovery-decisions concordent contre la décision annoncée. **Canonique v5 : pas d'INCOMPATIBLE stocké** ; l'incompatibilité D3 est un état calculé. |
| V3 | `MigrationLogic.sectionType` stocké | Pas de colonne — `sectionType` est calculé (recovery-decisions §2 : « Ne PAS stocker ») | Cohérent avec la règle transversale §6, qui prime. **Canonique v5 : calculé.** |

V2 et V3 sont des contradictions internes du brief (la règle transversale « calculé, pas stocké » l'emporte, et le schéma réconcilié l'applique déjà). V1 est le seul vrai écart matériel à traiter.

## 8. Trous historiques — liste de vérification négative

Les 9 trous de data-model qui ont **verrouillé la v4** (audit §2) : chacun rendait l'app *structurellement incapable* d'un comportement, quelle que soit la qualité du code au-dessus. Avant toute release v5, vérifier que chaque ligne est couverte.

| # | Champ/valeur | Si absent, l'app est incapable de… | État v5 (schéma récupéré) |
|---|---|---|---|
| 1 | `PlanStatus.BROKEN` | signaler au consultant qu'un plan contient un mapping cassé | ✅ présent (l. 18) |
| 2 | `LogicStatus.INCOMPATIBLE` | — remplacé : marquage D3 porté par le calcul de section + `compatibilityStatus` | ✅ résolu autrement (D8/V2) |
| 3 | `MigrationLogic.sectionType` + modèle `ClassificationPrompt` | afficher la modale D1–D4 et persister un prompt de classification | ✅ `ClassificationPrompt` (l. 225-231) ; sectionType calculé (V3) |
| 4 | `MigrationFilter.isActive` | activer/désactiver un filtre sans le supprimer | ✅ présent (l. 255) |
| 5 | `FilterOperator` étendu (`IS_NOT_NULL`, `NOT_IN`, `DATE_AFTER`, `DATE_BEFORE`) | exprimer les filtres date et négatifs | ⚠️ partiel : dates ✅, `IS_NOT_NULL`/`NOT_IN` ❌ (V1) |
| 6 | `ObjectField.picklistValues` | proposer la value-equivalence (mapping de valeurs de picklists) | ✅ présent (l. 142) |
| 7 | `ObjectField.isAccessible` **peuplé** | signaler les champs inaccessibles (perte silencieuse sinon) | ✅ colonne (l. 139) ; le **peuplement à l'écriture** reste une exigence de code (D11, checklist 05) |
| 8 | `FieldMapping.linkStatus` 5 états | afficher le statut riche d'un lien champ→champ | ✅ résolu autrement : calculé (§6), jamais stocké |
| 9 | `ObjectMapping.status` (ACTIVE/BROKEN) | afficher le badge rouge sur un mapping cassé | ✅ résolu autrement : dérivé des `IntegrityIssue` (§6) |

Leçon générale : trois de ces trous (2, 8, 9) ne se comblent **pas** par une colonne mais par du calcul à la lecture — c'est la moitié de la règle transversale. Les six autres sont des colonnes/valeurs qui doivent exister dès la Phase 1 (elles existent dans le schéma copié, sauf le point 5 partiel).
