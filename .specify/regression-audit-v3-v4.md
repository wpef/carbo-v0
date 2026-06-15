# Audit de régression V3 → V4 (régénération speckit)

**Date** : 2026-06-15
**Méthode** : workflow `regression-audit-v3-vs-v4` — 14 agents d'analyse parallèles (un par domaine fonctionnel) + synthèse architecte.
**Comparaison** : `implement/phase-1-v3` @ `b87e926d` (référence validée en recette) vs `implement/phase-1-v4` @ `c2b77469` (régénérée from-scratch).
**Worktree de référence v3** : `.claude/worktrees/v3-recette-ref` (conservé pour l'ÉTAPE 2 — port-from-v3).

---

## 1. Vue d'ensemble

La régénération from-scratch de la V4 via speckit a produit une **base saine côté spécifications** mais a **droppé massivement des raffinements validés en recette**.

| Indicateur | Valeur |
|---|---|
| **Régressions totales** | **130** |
| Sévérité **haute** | 59 (45 %) |
| Sévérité **moyenne** | 55 (42 %) |
| Sévérité **basse** | 16 (13 %) |
| Domaines impactés | 14 / 14 |

### Répartition spec-vs-code (le critère de décision)

| specCovered | Nombre | % |
|---|---|---|
| **yes** (déjà spécifié en v4) | 94 | 72 % |
| **partial** | 26 | 20 % |
| **no** (non spécifié) | 9 | 7 % |
| **unknown** | 1 | 1 % |

> **92 % des régressions sont au moins partiellement couvertes par les specs v4.** C'est un **échec d'implémentation**, pas un déficit de spécification.

---

## 2. Verdict spec-vs-code

Les pertes sont très majoritairement **déjà spécifiées** en v4 (vérifié dans le dépôt) :

- `specs/adapters/salesforce/spec.md` et `specs/adapters/hubspot/spec.md` documentent OAuth2+PKCE, Private App, jsforce, refresh transparent, properties API.
- `specs/003` FR-012..016 spécifie intégralement `detectLiveDrift` + `DriftReport` + taxonomie 12 types.
- `specs/012` **FR-007** impose le `LinkStatus` à 5 états avec **précédence du BROKEN**, plus un `driftFlag` orthogonal.
- `specs/013` détaille les sections **D1/D2/D3/D4** et le rafraîchissement LLM des classifications.
- `specs/017` FR-009/010 impose la transition du plan vers **BROKEN** et la résolution **par apiName** (FK = simple indice).
- `specs/022` a 52 tâches listées, **0 cochée** ⇒ domaine entier jamais généré.

**MAIS** un sous-ensemble est verrouillé par des **trous de data-model Prisma** divergents des specs (vérifiés dans `prisma/schema.prisma`) :

| Manque data-model | État code V4 | Conséquence |
|---|---|---|
| `PlanStatus.BROKEN` | absent (l.13 : DRAFT/IN_PROGRESS/COMPLETED/ARCHIVED) | le plan ne signale jamais un mapping cassé |
| `LogicStatus.INCOMPATIBLE` | absent (l.188 : DRAFT/DEFINED/VALIDATED) | champ D3 non marquable |
| `MigrationLogic.sectionType` + modèle `ClassificationPrompt` | absents | modale D1–D4 impossible |
| `MigrationFilter.isActive` | absent | toggle de filtre impossible |
| `FilterOperator` (IS_NOT_NULL, NOT_IN, DATE_AFTER, DATE_BEFORE) | incomplet (l.216) | filtres manquants |
| `ObjectField.picklistValues` | absent | casse VALUE_EQUIVALENCE |
| `ObjectField.isAccessible` | **colonne présente (l.138) mais non peuplée** par `createMany` (field-retrieval-service.ts) | champs inaccessibles silencieux (viol « pas de perte silencieuse ») |
| `FieldMapping.linkStatus` (5 états) | absent — seulement `compatibilityStatus` 3 états (l.166) | pas de statut riche ni de détection BROKEN inline |
| `ObjectMapping.status` (ACTIVE/BROKEN) | absent | pas de badge rouge sur un mapping cassé |

> **Corroboration** : le schéma contient déjà `MigrationPlan.objectAutoLinkedAt` (l.34) et `ObjectMapping.fieldAutoMatchedAt` (l.154) — les timestamps dédiés à l'auto-mapping. La structure anticipe la feature, mais **la logique qui crée les mappings et remplit ces champs n'a jamais été écrite**.

⇒ **Régénérer sans corriger d'abord le data-model reproduirait les mêmes manques.**

---

## 3. Clusters thématiques (dédupliqués)

### Sévérité HAUTE

| # | Cluster | specCovered | Récupération |
|---|---|---|---|
| 1 | **Connecteurs réels SF/HubSpot** (OAuth2+PKCE, Private App, adapters, registry, post-OAuth, SetupProgress) | yes | speckit-regen |
| 2 | **Statut BROKEN + intégrité auto-déclenchée** (enum à étendre, trigger après refresh & CRUD, repair, typeChanges) | yes | mixte |
| 3 | **linkStatus 5 états + résolution par apiName** (anti-stale-FK, statusDetail, surbrillance « Cassé ») | yes | speckit-regen |
| 4 | **Migration-logic D1/D2/D3/D4** (modale, sectionType, /classify LLM, ClassificationPrompt, INCOMPATIBLE) | yes | speckit-regen |
| 5 | **Champs : isAccessible & picklistValues non persistés** (perte silencieuse, casse value-equivalence, delete+createMany non atomique) | partial | mixte |
| 6 | **Détection champs non-mappés** (routes plan+per-mapping, hook, UnmappedFieldsWarning, intégration docs, FieldExclusion CRUD) | partial | speckit-regen |
| 7 | **Schema-write 022** (routes, service, adapter HubSpot, page, composants, hook, LLM, modifyField) — 0/52 tâches | yes | speckit-regen |
| 8 | **Record preview + field stats** (pages, table, pagination, hook, computeFieldStats client-side, audit, binaire) | yes | speckit-regen |
| 9 | **Sélection objets source** (/expand, filtre système, recherche, pré-sélection métier, migrateSelection, summary) | yes | speckit-regen |
| 10 | **Object mapping 011** (SVG bézier overlay, auto-link auto + registry SF→HS, modale détail, recherche/filtres) | yes | speckit-regen |
| 11 | **Schema diff & live drift** (diff post-refresh non branché, route /diff, detectLiveDrift, bannière) | yes | speckit-regen |
| 12 | **Filtres migration** (PATCH/toggle isActive, /filterable-fields, /estimate, validation, composants UI, opérateurs) | partial | mixte |
| 13 | **Documents** (export PDF absent, rule-description sans PROMPT/INFO/ERROR+LLM, vues détail, structure 7 articles) | yes | mixte |
| 14 | **Navigation/Layout/Stepper** (BUG BLOQUANT `targetStep` vs `step`, header connecteurs, bouton étape suivante, vue plan, delete, sous-pages) | yes | mixte |
| 15 | **Pages dédiées champs source+dest** (/source/fields, /destination/fields, accordéon, progress bar, route /[objectId]) | yes | speckit-regen |

### Sévérité MOYENNE

| # | Cluster | specCovered | Récupération |
|---|---|---|---|
| 16 | **Field mapping 012** (registry auto-match SF→HS, MigrationPreviewPanel, anti-doublon 409, recherche, MAJ statut post-CRUD, ModifyFieldModal, TabBadge) | yes | mixte |

> **BUG BLOQUANT — priorité absolue** (cluster 14, vérifié dans le code) : toutes les pages envoient `{ targetStep }` mais `src/app/api/plans/[planId]/step/route.ts` lit `body.step` ⇒ **chaque avancement d'étape renvoie 400**, le workflow est gelé dès la première transition, et la sidebar ne débloque jamais les étapes suivantes (lien probable avec le retour utilisateur « sous-menus non cliquables une fois passés »).

---

## 4. Décision : stratégie **HYBRIDE** (à dominante régénération speckit ciblée)

Décision prise de façon autonome après vérification directe du code. **Hybride, séquencée, data-model d'abord.**

### Pourquoi pas une stratégie pure
- **Pas « intégrer les retours » seul** : 92 % des pertes sont spécifiées et plusieurs domaines entiers (022, 009/010, connecteurs) sont à écrire from-scratch — porter à la main serait plus coûteux que régénérer, et ferait diverger le code des specs (or le projet se veut regénérable depuis les specs).
- **Pas « régénérer avec speckit » à l'aveugle** : la régen reproduirait les trous data-model et re-dériverait mal une logique métier déjà validée en v3 (registres sémantiques, linkStatus). La 1ʳᵉ régen a précisément échoué sur ces points.
- **Pas « régénérer sans speckit »** : gaspillerait l'asset specs, qui est la partie saine.

### Séquencement

**ÉTAPE 0 — Corrections immédiates, coût quasi nul, fort impact :**
1. Fixer le bug `targetStep`/`body.step` (1 ligne) — débloque tout le parcours.
2. Ajouter `BROKEN` (PlanStatus) et `INCOMPATIBLE` (LogicStatus) aux enums.
3. Ajouter `isActive`, `picklistValues`, `sectionType` + modèle `ClassificationPrompt` + champs `linkStatus`/`status` au schéma.
4. Brancher `isAccessible` dans le `createMany` de field-retrieval.

**ÉTAPE 1 — `/speckit.plan` puis `/speckit.tasks` + `/speckit.implement`, feature par feature**, sur les pans entièrement spécifiés et non générés, dans l'ordre des dépendances :
`002/006 + adapters` → `003 diff/drift` → `005/008 pages champs` → `009/010 preview` → `011/012/013 mappings & logic` → `017 intégrité` → `016 unmapped` → `018-021 documents` → `022 schema-write`.

**ÉTAPE 2 — Porter depuis v3** les raffinements algorithmiques (marqués `port-from-v3`) : registres sémantiques (auto-link objets SF→HS, auto-match champs), `computeLinkStatus` 5 états, `migrateSelection`, `repairBrokenMappings`, `MigrationPreviewPanel`, SVG bézier overlay, `getFilterableFields`, intégration `detectUnmappedFields` dans les documents.

### Risques & mitigations

| Risque | Mitigation |
|---|---|
| Régen reproduit les manques si data-model pas corrigé d'abord | ÉTAPE 0 obligatoire + revue du diff data-model avant chaque `implement` |
| Couplage fort (connecteurs/intégrité/linkStatus/unmapped) | respecter l'ordre des dépendances, régénérer par lots cohérents |
| Divergence specs vs v3 (linkStatus, tri filtres, pageSize) | trancher explicitement par régression ; si on garde le v3, **enrichir la spec** |
| LLM/secrets (/classify, PROMPT, descriptions) | provisionner `ANTHROPIC_API_KEY` + timeouts sur la démo Netlify+Neon |
| Coût de pilotage | accepté : seule voie qui préserve à la fois l'asset specs et les acquis de recette |

---

## 5. Trous de couverture de l'audit (à inspecter ultérieurement)

- **000-connector-interface / SDK + skill `/speckit.connector`** : couverture de l'interface `ConnectorAdapter` v4 pour futurs connecteurs non évaluée.
- **Reconnexion / reconfiguration** (002 reconfig, 006) : changement de credentials, revoke, expiration token côté UI non audités.
- **Persistance/refresh des tokens OAuth & stockage des secrets** (v3 : `globalThis.__sfPkceStore`) : stratégie v4 et chiffrement non analysés.
- **Inventaire complet de l'audit trail** : signalé absent ponctuellement (preview, schema-write), pas d'inventaire global.
- **Couverture de tests v4 vs v3** : angle mort total (la mémoire impose la validation des tests avant implémentation).
- **Conformité transverse à la Constitution** (« pas de perte silencieuse de données », violé par isAccessible/picklistValues) non agrégée.
- **Migrations Prisma & DB partagée v3/v4** non traitées globalement.
