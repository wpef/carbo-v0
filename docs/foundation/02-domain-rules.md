# Dossier de fondation — 02. Règles métier calculées (catalogue v4 → v5)

> **Source de vérité** : code + tests de la v4 récupérée (validée en recette réelle, 2 cycles),
> worktree `keen-matsumoto-22c856`. Tous les chemins ci-dessous sont relatifs à la racine de ce worktree.
> Ces règles sont le savoir le plus chèrement acquis du projet : elles doivent être portées en v5
> **avec leurs tests**, à l'identique sauf mention contraire.

## Principe transversal — tout est calculé à la lecture

`linkStatus`, `sectionType`, la compatibilité de types et la « broken-ness » d'un mapping ne sont
**jamais stockés** en base : ils sont **recalculés à chaque lecture** à partir du snapshot CURRENT.
C'était l'arbitrage majeur de la réconciliation v3→v4 (anti-stale-FK) :

- Les FK stockées (`objectId`, ids de champs) ne sont que des **indices** ; la résolution réelle se fait
  **par `apiName`** contre le snapshot CURRENT (`resolveCurrentObject` dans
  `src/features/field-mapping/services/field-mapping-service.ts`). Un refresh de schéma qui fait tourner
  les snapshots ne casse donc jamais le rendu — il produit au pire un état `BROKEN` calculé.
- Seules exceptions **explicitement persistées** : `compatibilityStatus` (figé à la création du FieldMapping),
  `sectionType` sérialisé dans le JSON `config` de MigrationLogic (pour reconstruction du DTO),
  les timestamps d'idempotence (`objectAutoLinkedAt`, `fieldAutoMatchedAt`), les `IntegrityIssue`
  (journal upsert/auto-résolution) et le `status` du plan.
- Principe IX : **jamais de mutation silencieuse**. La réparation d'un plan BROKEN est une action
  utilisateur explicite ; l'auto-link/auto-match ne se rejouent jamais seuls.

---

### 1. computeLinkStatus — 5 états de lien de champ

**Sémantique.** Fonction pure `computeLinkStatus(sourceType, destType, migrationLogic, sourceFieldExists, destFieldExists)`
→ `{ linkStatus, statusDetail? }`. Les 5 valeurs de `LinkStatus` :

| État | Signification |
|---|---|
| `BROKEN` | Champ source et/ou destination absent du snapshot CURRENT (résolution par apiName échouée) |
| `RED_DASHED` | Section D3 (`ERROR`) : types incompatibles — **aucune logique ne peut corriger**, même `VALIDATED` |
| `RED_SOLID` | Section D1/D2 : configuration requise, pas commencée (logique absente **ou** en `DRAFT`) |
| `ORANGE` | Logique `DEFINED` (pas validée), ou `VALIDATED`/`DEFINED` D1 avec valeurs source non mappées |
| `GREEN` | D4 (`INFORMATIONAL`, auto-validé sans logique) ou logique `VALIDATED` complète |

**Précédence stricte** (spec 012) : `BROKEN > RED_DASHED > RED_SOLID > ORANGE > GREEN`.
Détails vérifiés par les tests :

- `BROKEN` gagne sur tout, y compris D3+VALIDATED et D4. `statusDetail` distingue « source »,
  « destination », « source et destination » introuvables (messages français exacts dans le code).
- `RED_DASHED` est retourné pour D3 quel que soit le statut de la logique (une logique VALIDATED sur
  des types incompatibles reste RED_DASHED).
- **Complétude D1** : si `sourceValues` et `mappedSourceValues` sont fournis et qu'il reste
  `n > 0` valeurs source non mappées → `ORANGE` avec `statusDetail` « n valeur(s) source non liée(s) »
  (accord pluriel testé), **même si status=VALIDATED**. Si tout est mappé : VALIDATED→GREEN, DEFINED→ORANGE.
  Si VALIDATED **sans** données de complétude → GREEN (on fait confiance au statut stocké).
- D2 (`PROMPT`) : DEFINED→ORANGE, VALIDATED→GREEN.
- Statuts de logique (`MigrationLogicStatus` / enum Prisma `LogicStatus`) : `DRAFT | DEFINED | VALIDATED`.

**Résolution anti-stale-FK** (couche service `listFieldMappings`/`toDTO`) : les champs sont résolus par
`apiName` sur l'objet du snapshot CURRENT ; `sourceFieldExists`/`destFieldExists` = « résolution réussie ».
Les types utilisés sont ceux du snapshot CURRENT, avec fallback sur les types stockés du mapping.
Le snapshot de logique pour la complétude D1 est construit par `buildLogicSnapshot`
(DRAFT → `{status:'DRAFT'}` sans listes ; DEFINED/VALIDATED → picklists source/dest + `mappedSourceValues`).

- `Source v4 :` `src/features/field-mapping/lib/link-status.ts` ; enrichissement DTO :
  `src/features/field-mapping/services/field-mapping-service.ts`
- `Tests :` `tests/unit/field-mapping/type-status.test.ts` (5 états + précédence),
  `tests/unit/field-mapping/link-status-enrichment.test.ts` (pipeline buildLogicSnapshot + BROKEN + doublon 409)
- `À porter tel quel : oui`

> ⚠️ **Anomalie / écart avec la liste attendue** : aucun `driftFlag` n'existe en v4 (grep exhaustif src+tests).
> L'orthogonalité drift/linkStatus est réalisée autrement : le drift vit dans les `DriftReport` (règle 6)
> et les `IntegrityIssue` (règle 8) ; le linkStatus ne connaît que l'existence des champs dans CURRENT.
> Si la v5 veut un `driftFlag` par mapping, c'est une **nouveauté**, pas un port.

---

### 2. Compatibilité de types & getSectionType (D1–D4)

**Normalisation** (`normalizeType`) : tout `dataType` connecteur (insensible à la casse, trimé) est projeté
sur 5 types canoniques `text | number | date | picklist | boolean`. Table `TYPE_NORMALIZATION` :
SF `string/textarea/url/email/phone/id/reference/address/encryptedstring/richtext`→text ;
`int/integer/double/float/decimal/currency/percent/long`→number ; `date/datetime/time`→date ;
`picklist/multipicklist/combobox`→picklist ; `boolean/checkbox`→boolean ;
HubSpot `text`→text, `number`→number, `enumeration/enum/select`→picklist, `bool`→boolean.
**Type inconnu → fallback `text`** (le plus permissif).

**Matrice 5×5** (`checkTypeCompatibility`, lignes=source, colonnes=destination) →
`CompatibilityStatus = COMPATIBLE | WARNING | INCOMPATIBLE` :

| src \ dst | text | number | date | picklist | boolean |
|---|---|---|---|---|---|
| text | C (D4) | I | I | W (D2) | I |
| number | C (D4) | C (D4) | I | W (D2) | I |
| date | C (D4) | I | C (D4) | W (D2) | I |
| picklist | C (D4) | I | I | C (D1) | C (D1) |
| boolean | C (D4) | C (D4) | I | C (D1) | C (D4) |

**getSectionType** (dérive la section du modal de logique, ordre d'évaluation exact) :
1. **D1 `VALUE_EQUIVALENCE`** : picklist→(picklist|boolean), boolean→picklist ;
2. **D2 `PROMPT`** : tout autre →picklist (text/number/date→picklist) — prompt de classification LLM ;
3. **D4 `INFORMATIONAL`** : même type canonique, picklist→text, boolean→(text|number|boolean), number→text, date→text — copie directe auto-validée ;
4. **D3 `ERROR`** : tout le reste — incompatible, champ non migrable par le moteur.

Messages D4 (`getInformationalMessage`) : boolean→text = « Vrai ou Faux » ; boolean→number =
« Vrai=>1, Faux=>0 » ; défaut = « La valeur sera copiée. ». Les booléens sans picklist ont des valeurs
synthétisées `['True','False']` pour le modal D1 (`buildMigrationLogicContext`).

Sémantique des statuts : `LogicStatus` (Prisma) = `DRAFT | DEFINED | VALIDATED`
(action UI : save→DEFINED, validate→VALIDATED). D1 remplace atomiquement les `ValueEquivalence` ;
D2 upsert le `ClassificationPrompt` ; D3/D4 ne portent que config+status. Le `sectionType` est stocké
uniquement dans le JSON `config` (fallback de lecture : `INFORMATIONAL` si illisible).

- `Source v4 :` `src/features/field-mapping/lib/type-compatibility.ts`,
  `src/features/migration-logic/services/migration-logic-service.ts`
- `Tests :` `tests/unit/field-mapping/type-status.test.ts` (normalisation + matrice + sections, avec
  garde d'exhaustivité de TYPE_NORMALIZATION), `tests/unit/migration-logic/migration-logic-service.test.ts`
  (messages D4 + stub classify déterministe : match par sous-chaîne, fallback destValues[0], note d'erreur en mode stub)
- `À porter tel quel : oui`

> ⚠️ **Anomalie / écart** : il n'existe **pas** de valeur `INCOMPATIBLE` dans `LogicStatus`.
> `INCOMPATIBLE` existe à trois autres endroits : `CompatibilityStatus` (matrice ci-dessus),
> `IntegrityIssueType.INCOMPATIBLE_TYPE` (règle 8) et l'alias `RuleType 'INCOMPATIBLE'` ≡ `ERROR`
> dans le moteur de descriptions (règle 9). Ne pas introduire de 4e statut de logique en v5.

---

### 3. Classification des objets système Salesforce + pré-sélection

**Deux fonctions complémentaires**, toutes deux à porter :

**a) `categorise(apiName, isCustom, commonBusinessObjects, systemPrefixes, systemSuffixes)`**
→ `'custom' | 'business' | 'system'`, précédence stricte :
1. `isCustom` → **custom** (gagne sur tout : `AccountFeed__c` custom reste custom) ;
2. apiName ∈ `commonBusinessObjects` → **business** (la liste blanche bat les heuristiques :
   `Campaign` ne peut pas être happé par un préfixe) ;
3. préfixe système (métadonnées SF : `__`, `Apex`, `Auth`, `Content`, `Data`, `Entity`, `Flow`, `Login`, `Setup`) → **system** ;
4. **suffixe** système (`Feed`, `History`, `Share`, `ChangeEvent`, `Tag`) → **system** — leçon de recette :
   une vraie org SF expose ~1000+ objets internes `AccountFeed`/`AccountHistory`/`AccountShare`/
   `AccountChangeEvent`/`AccountTag` ; le filtrage préfixe-seul les laissait tous visibles ;
5. défaut → **business**. Tri d'affichage : custom < business < system, puis alphabétique.

**b) Pré-sélection à la création du plan** (`isDefaultSelected` + `initDefaultSelection`) :
sélectionné par défaut ssi objet custom (`__c`) **ou** apiName ∈ `DEFAULT_CRM_OBJECTS` =
{Account, Contact, Lead, Opportunity, Case, Campaign, Task, Event, Note, Attachment, ContentDocument, CampaignMember} (12 objets).

**Source UNIFIÉE** : `metadata.ts` construit `commonBusinessObjects: [...DEFAULT_CRM_OBJECTS]` — le bug
d'origine était deux listes divergentes (6 vs 12) : les objets classés business n'étaient pas pré-sélectionnés.
Le test verrouille l'égalité des deux ensembles « forever ».

- `Source v4 :` `src/lib/adapters/salesforce/salesforce-constants.ts` (patterns + DEFAULT_CRM_OBJECTS +
  isSystemObject + isDefaultSelected), `src/lib/adapters/metadata.ts` (getAdapterMetadata),
  `src/features/schema/services/object-selection-service.ts` (categorise + initDefaultSelection)
- `Tests :` `tests/unit/schema/object-classification.test.ts` (garde d'acceptance recette + égalité des listes),
  `tests/unit/schema/object-selection-service.test.ts` (initDefaultSelection idempotente, migrateSelection),
  `src/lib/adapters/salesforce/salesforce.test.ts` (isSystemObject/isDefaultSelected)
- `À porter tel quel : adapter (unification à finir)`

> ⚠️ **Point d'attention v5** : l'unification n'est complète que pour la liste CRM. Les préfixes/suffixes
> existent encore en **deux** exemplaires légèrement divergents :
> `SYSTEM_OBJECT_PATTERNS` (constants : préfixes incluent `Feed`/`Scratch`, suffixes `__Tag` ; + liste `exact`
> de ~35 noms, utilisée par `isSystemObject` côté adapter) vs `metadata.ts` (préfixes incluent `Data`/`__`,
> suffixes `Tag` ; utilisé par `categorise` côté sélection). En v5 : **une seule** définition.

---

### 4. Auto-link objets + auto-match champs (registre + name-based, idempotents)

**Auto-link objets** (`computeAutoLinkPairs`, **registre seul**, spec 011) : registre statique clé
`${sourceAdapter}:${destAdapter}` ; pour `salesforce:hubspot` : Account→companies, Contact→contacts,
Opportunity→deals, **Lead→contacts** (deux sources peuvent viser la même destination — dédup **par source
uniquement**, aligné sur `@@unique([planId, sourceObjectName, destinationObjectName])`). Une paire n'est créée
que si source ET destination existent dans les snapshots CURRENT et si la source n'est pas déjà mappée.
Combinaison d'adapters inconnue → aucune création (edge case spec). Régression garde-fou : Contact→contacts
serait raté par une égalité name-based naïve (« contact » ≠ « contacts ») — d'où le registre.

**Auto-match champs** (`computeAutoMatchPairs`, spec 012) : **UNION** de
(1) paires du registre par clé `${srcAdapter}:${dstAdapter}:${srcObject}:${dstObject}` (équivalences
sémantiques, ex. `Title→jobtitle`, `Website→domain`, `StageName→dealstage`) — résolution de la destination
**insensible à la casse** (leçon recette v3) ; puis (2) fallback name-based insensible à la casse pour les
champs source non couverts (ex. `Email→email`). Dédup **bilatérale** (un source par dest, un dest par source) ;
le registre a priorité sur le name-based pour une destination donnée.

**Idempotence persistée** : `plan.objectAutoLinkedAt` (auto-link : deuxième appel → no-op avec
`alreadyLinkedAt`, création des mappings + timestamp dans **une même transaction**) et
`objectMapping.fieldAutoMatchedAt` (auto-match : ne se rejoue **jamais**, même si le consultant a supprimé
manuellement des mappings auto-créés — Principe IX). Les paires déjà mappées sont comptées `skipped`
(jamais exclues silencieusement) ; les mappings créés portent `autoCreated: true` et un
`compatibilityStatus` calculé à la volée.

- `Source v4 :` `src/features/object-mapping/lib/auto-link-registry.ts`,
  `src/features/object-mapping/services/object-mapping-service.ts` (autoLinkObjects),
  `src/features/field-mapping/lib/auto-match-registry.ts`,
  `src/features/field-mapping/services/field-mapping-service.ts` (autoMatchFields)
- `Tests :` `tests/unit/object-mapping/auto-link-registry.test.ts`,
  `tests/unit/field-mapping/auto-match-registry.test.ts`
- `À porter tel quel : oui` (le registre est volontairement une carte statique au niveau appli, extensible par combinaison de connecteurs)

---

### 5. Opérateurs de filtres (11) + validation par type + isActive

**Les 11 opérateurs** (enum Prisma `FilterOperator`, labels français) : `EQUALS` (Est égal à),
`NOT_EQUALS`, `CONTAINS`, `NOT_CONTAINS`, `STARTS_WITH`, `ENDS_WITH`, `GREATER_THAN`, `LESS_THAN`,
`IS_NULL` (Est vide, **seul opérateur `needsValue: false`**), `DATE_AFTER` (Après le), `DATE_BEFORE` (Avant le).
Chaque opérateur porte `applicableTypes` (types de champ recommandés). Ensembles dérivés :
`DATE_OPERATORS` = {DATE_AFTER, DATE_BEFORE} (valeur ISO 8601 `YYYY-MM-DD` attendue) ;
`TEXT_OPERATORS` = {CONTAINS, NOT_CONTAINS, STARTS_WITH, ENDS_WITH} (string/email/phone/url).
`isValidOperator` est sensible à la casse.

**Validation** (`validateFilter`) — deux niveaux :
- **Erreurs dures** (`valid:false`) : champ source manquant/vide, opérateur manquant ou inconnu,
  **champ inexistant dans le schéma source** (FR-005, messages français exacts) ;
- **Warnings souples** (`valid:true, warning`) : opérateur date sur champ non-date, valeur date non-ISO,
  opérateur texte sur champ non-texte. Le warning est stocké sur le `FilterItem` retourné à la création.

`isActive` : booléen porté par `MigrationFilter` (toggle sans suppression) ; un filtre inactif est conservé
mais ignoré. La suppression du champ source sous-jacent est détectée par l'intégrité (`INVALID_FILTER`, règle 8).

- `Source v4 :` `src/features/filters/lib/filter-operators.ts`, `src/features/filters/lib/filter-validation.ts`,
  `src/features/filters/types.ts` (+ services `src/features/filters/services/filter-service.ts`)
- `Tests :` `tests/unit/filters/filter-operators.test.ts` (exactement 11, needsValue, ensembles),
  `tests/unit/filters/filter-validation.test.ts`
- `À porter tel quel : oui`

> ⚠️ **Anomalie / écart avec la liste attendue** : la v4 ne contient **ni `IS_NOT_NULL` ni `NOT_IN`** —
> le test l'affirme explicitement (`isValidOperator('NOT_IN') === false`, commentaire « not in v4 schema »).
> Les 11 opérateurs réels sont ceux listés ci-dessus. Par ailleurs le commentaire d'en-tête de
> `filter-validation.ts` mentionne « 9 supported operators » (obsolète) : corriger le commentaire en v5, pas le code.

---

### 6. Drift / SchemaDiff — taxonomie, live vs persisté, merge

**Taxonomie canonique** (`DRIFT_MODIFICATION_TYPES`, 12 types, sévérité par défaut) :
`OBJECT_ADDED` (info), `OBJECT_REMOVED` (critical), `FIELD_ADDED` (info), `FIELD_REMOVED` (critical),
`FIELD_TYPE_CHANGED` (critical, **rétrogradé à info** si élargissement compatible — liste conservatrice
`string→textarea`, `int/integer→double`, `single_line_text→multi_line_text`, `number→decimal`),
`FIELD_BECAME_REQUIRED` (warning), `FIELD_BECAME_OPTIONAL` (info), `FIELD_LABEL_CHANGED` (info),
`PICKLIST_VALUE_ADDED` (warning), `PICKLIST_VALUE_REMOVED` (warning), `FIELD_READONLY_CHANGED` (warning),
`FIELD_UNIQUE_CHANGED` (warning).

**`computeDrift` (pur)** : diff stored vs live. Chaque `DriftChange` porte `affectsMapping`
(true si un ObjectMapping/FieldMapping référence l'objet/champ). **FR-016** : l'inspection niveau champ est
limitée aux objets **mappés** ; les objets non mappés ne produisent que ADDED/REMOVED. Le diff picklist
n'est fait que si les deux côtés portent des métadonnées picklist. `status` = `ok | drift | unavailable` +
`severitySummary` {critical, warning, info}. Idempotent (FR-014).

**`detectLiveDrift`** : CURRENT (DB) vs schéma **live** (adapter) ; ne lève jamais — toute erreur adapter →
`buildUnavailableReport(status:'unavailable', reason)` ; échec `getFields` sur un objet = non fatal.
**`computePersistedDrift`** : PREVIOUS → CURRENT, **purement DB**, appelé après la rotation de snapshots
d'un refresh (car juste après un refresh, live == CURRENT : detectLiveDrift serait un no-op). Pas de
PREVIOUS (première récupération) → `ok` sans changes.

**`mergeDriftReports(source, destination)`** (niveau plan) : concat des changes, somme des severitySummary,
précédence de statut `drift > unavailable > ok`, `checkedAt` = max, côté absent (null) ignoré ;
deux null → null. Consommé par `PlanDriftContext` (bannière).

**Impact BROKEN** : le drift n'écrit rien sur les mappings. C'est la relecture (règle 1 : champ absent de
CURRENT → linkStatus BROKEN) et le check d'intégrité (règle 8 : BROKEN_REFERENCE → plan BROKEN) qui
matérialisent les conséquences — cohérent avec le principe transversal.

- `Source v4 :` `src/features/schema/lib/drift.ts` (pur), `src/features/schema/services/drift-service.ts`,
  `src/features/plans/plan-drift-context.tsx` (consommation)
- `Tests :` `tests/unit/schema/drift.test.ts` (taxonomie, matrice de cas, idempotence, régression recette #4),
  `tests/unit/schema/drift-service.test.ts` (detectLiveDrift mocké)
- `À porter tel quel : oui`

> ⚠️ **Trou de couverture** : `mergeDriftReports` n'a **aucun test unitaire** (grep tests/ vide).
> À combler lors du port v5 (la sémantique de merge ci-dessus est documentée depuis le code seul).

---

### 7. computeUnmappedFields + exclusions (FieldExclusion)

Fonction pure `computeUnmappedFields(sourceFields, destFields, fieldMappings, exclusions)` → rapport :

- **Côté source** : un champ est « traité » s'il est mappé **ou** exclu.
  `unmappedSourceFields` = tous − mappés − exclus.
  `sourceCoverage` = (mappés + exclus) / total × 100, **arrondi** (`Math.round`).
- **Côté destination** : seuls les champs **required** comptent.
  `unmappedRequiredDestFields` = required − mappés ; `destinationRequiredCoverage` = mappésRequired/totalRequired × 100 arrondi.
- **`isComplete`** : évalué sur les valeurs **brutes non arrondies** (=== 100 strict, pour éviter
  l'artefact 99,9 → 100). Listes vides → couverture 100.
- `fieldsRemainingToValidate` = |unmappedSource| + |unmappedRequiredDest|.
- Les `FieldExclusion` (id, sourceFieldName, reason nullable, createdAt) sont passées en pass-through dans
  le rapport (`excludedSourceFields`) — l'exclusion est une décision consultante documentée, reprise dans
  l'Article 4 du document contractuel (règle 9).

Variante service (`getUnmappedSourceFields` dans field-mapping-service) : même logique côté source,
résolue par apiName sur le snapshot CURRENT.

- `Source v4 :` `src/features/unmapped/lib/compute-unmapped.ts` (+ `src/features/unmapped/services/unmapped-service.ts`)
- `Tests :` `tests/unit/unmapped/compute-unmapped.test.ts` (dont sous-suite arrondi de couverture)
- `À porter tel quel : oui`

---

### 8. Intégrité — taxonomie, checkAndUpdatePlanStatus, DRAFT/READY/BROKEN, réparation

**Taxonomie** (enums Prisma) : `IntegrityEntityType` = OBJECT_MAPPING | FIELD_MAPPING | MIGRATION_LOGIC |
MIGRATION_FILTER ; `IntegrityIssueType` = UNMAPPED_REQUIRED_FIELD | INCOMPATIBLE_TYPE | MISSING_LOGIC |
INVALID_FILTER | BROKEN_REFERENCE | MISSING_EQUIVALENCE ; sévérité `ERROR`/`WARNING`.

**`checkIntegrity(planId)`** détecte effectivement **4 des 6 types** :
- `BROKEN_REFERENCE` (ERROR) sur OBJECT_MAPPING : objet source ou dest absent de CURRENT
  (objet absent → **skip des checks champ** de ce mapping) ; sur FIELD_MAPPING : champ source/dest absent ;
- `UNMAPPED_REQUIRED_FIELD` (WARNING) sur OBJECT_MAPPING : champ destination `isRequired && !isReadOnly` sans mapping ;
- `INCOMPATIBLE_TYPE` (ERROR) sur FIELD_MAPPING : types **actuels** (snapshot CURRENT, fallback types stockés)
  → `INCOMPATIBLE` selon la matrice 012 ;
- `INVALID_FILTER` (ERROR) sur MIGRATION_FILTER : filtre référençant un champ source disparu.

**Idempotence** : upsert par clé `@@unique([planId, entityType, entityId, issueType])` ; les issues
non redétectées sont **auto-résolues** (resolved=true + resolvedAt) — c'est le seul « auto » autorisé,
car il ne mute pas les mappings, seulement le journal.

**Transitions de statut plan** : `unresolved > 0` → **BROKEN** ; sinon **READY préservé uniquement si**
`currentStep === 'DOCUMENTS' && status === 'READY'` ; sinon **DRAFT**. `checkAndUpdatePlanStatus` =
wrapper non-fatal (le CRUD mapping ne doit jamais échouer à cause de l'intégrité), déclenché après **chaque**
create/delete de FieldMapping (et CRUD ObjectMapping).

**Réparation (Principe IX)** : `repairBrokenMappings` n'est **jamais** appelé automatiquement —
action utilisateur explicite. Supprime les ObjectMappings BROKEN_REFERENCE (cascade sur leurs FieldMappings),
puis les FieldMappings BROKEN_REFERENCE restants, puis re-run `checkIntegrity`. Résolution manuelle :
`resolveIssue` (409 si déjà résolue), `resolveAllForPlan` (retour DRAFT).

- `Source v4 :` `src/features/integrity/services/integrity-service.ts`, `src/features/integrity/types.ts`
- `Tests :` `tests/integration/integrity/integrity-check.integration.test.ts` (test d'intégration — DB requise)
- `À porter tel quel : adapter` (porter la logique telle quelle, mais : (a) `MISSING_LOGIC` et
  `MISSING_EQUIVALENCE` sont dans l'enum **sans détecteur** en v4 — décider en v5 de les implémenter ou de
  les retirer ; (b) pas de test **unitaire** pur : extraire la détection en fonction pure testable serait
  un bon investissement de port)

---

### 9. Documents — contractuel 7 articles, référence, descriptions, PDF

**Document contractuel (020)** — structure figée en 7 articles :
1. Périmètre de migration · 2. Correspondances de champs (une sous-section **par objet**) ·
3. Règles de migration (toutes les règles **non-DIRECT_COPY**) · 4. Exclusions (champs non migrés,
via `computeUnmappedFields`) · 5. Filtres de migration · 6. Conditions et réserves (clauses fixes,
renvois croisés Art. 2/4) · 7. Approbation et signature. Table des matières ancrée `#article-N`.

**Numéro de référence (FR-013)** : format `CARBO-YYYYMMDD-XXXX` (séquence 4 chiffres, **séquentielle par
jour**, compteur en mémoire de module — l'unicité inter-session est garantie par transaction DB côté service).
Fonctions pures : `generateReferenceNumber`, `generateReferenceNumberForDate` (déterministe pour tests),
`isValidReferenceNumber` (`/^CARBO-\d{8}-\d{4}$/`), `parseReferenceNumber`, `_resetCounterForTests`.

**Moteur de descriptions de règles (018)** — `describeRule(input)` pur, dispatch par `RuleType` :
`DIRECT_COPY` (« Copie directe (t → t) » / « Copie avec conversion de type (a → b) ») ;
`VALUE_EQUIVALENCE` (liste les **5 premières** paires « 'X' becomes 'Y' », puis « and N more equivalence(s) » ;
signale les valeurs source sans équivalent ; 0 paire → message dédié) ;
`INFORMATIONAL` (message verbatim, fallback si vide) ;
`ERROR`/`INCOMPATIBLE` (alias, même sortie « WARNING: … type incompatibility … exported to a CSV file ») ;
`PROMPT` (fallback pur `« <prompt> (requires review) »`, `source:'fallback'` — LLM câblé en couche service) ;
inconnu → fallback générique. Sortie : `{description, source: 'template'|'fallback'}`.

**Agrégateur** : `generatePlanDescription` (plan-description-service) parcourt les mappings, dérive le
sectionType **à la volée** via `getSectionType` (pas de colonne), génère description par champ + résumé
filtres français par opérateur (0 filtre → « Aucun filtre appliqué… » ; 1 → description ; n → « n filtres… »).
Le document technique (019, text-document-service) câble describeRule + computeUnmappedFields et persiste
`unmappedCount`/`llmCallCount`.

**Export PDF (021)** : le PDF est du **HTML print-ready** rendu en binaire A4 par
`puppeteer-core + @sparticuz/chromium` (compatible Lambda/Netlify ; jamais le paquet `puppeteer` complet).
Résolution Chromium : 1) `PUPPETEER_EXECUTABLE_PATH` (dev), 2) `chromium.executablePath()` (runtime).
CSS anti-coupure injecté (break-inside avoid sur `tr` et titres), entête titre+date, pied « Page X / Y »,
marges 25/25/20/20 mm. **Échec de lancement Chromium → la route retombe gracieusement sur
`enrichHtmlForPrint`** (HTML d'impression). `sanitizePdfFilename(planName, docType, date)` normalise le nom de fichier.

- `Source v4 :` `src/features/documents/services/contractual-document-service.ts`,
  `src/features/documents/lib/reference-number.ts`, `src/features/documents/lib/rule-description.ts`,
  `src/features/documents/services/plan-description-service.ts`,
  `src/features/documents/services/text-document-service.ts`, `src/features/documents/lib/pdf-export.ts`
- `Tests :` `tests/unit/documents/reference-number.test.ts`, `tests/unit/documents/rule-description.test.ts`
  (7 générateurs + dispatcher, dont alias INCOMPATIBLE≡ERROR), `tests/unit/documents/document-service-logic.test.ts`
  (chaîne 019/020 describeRule+computeUnmappedFields+sanitizePdfFilename), `tests/unit/documents/pdf-export.test.ts`
  (sanitizePdfFilename, enrichHtmlForPrint — pas de lancement Chromium en test)
- `À porter tel quel : oui` (attention : descriptions de règles en **anglais**, gabarits filtres/contractuel en
  **français** — mélange assumé en v4, à trancher en v5 sans changer la logique)

---

### 10. Field stats (client-side) + record preview (pagination, pas d'échantillonnage statistique)

**`computeFieldStats(records)`** (pur, **calculé côté client** sur la page de records courante — FR-002,
aucun appel serveur) : un passage, pour chaque champ rencontré dans **au moins un** record :
`nullCount` (null/undefined/**champ absent** comptent null — records creux gérés),
`distinctCount` (valeurs uniques stringifiées, suivi plafonné à **1000**),
`sampleValues` (jusqu'à **5** valeurs uniques, premières rencontrées, valeur d'origine conservée).
Champ binaire (placeholder `"[binary data]"` détecté) → sentinelle `nullCount = -1, distinctCount = -1,
sampleValues: []` pour que l'UI affiche « N/A ». 0 record → `[]`.

**Record preview (009)** : `fetchRecordPage(planId, side, objectApiName, page, pageSize=50)` —
pagination **1-indexée** via `adapter.getRecords` (contrat `PaginatedRecords` : totalCount, hasNextPage) ;
la connexion doit être `CONNECTED` (erreurs typées Plan/Connection NotFound/NotConnected) ;
**sanitisation binaire** : tout `Buffer`/`Uint8Array` → `"[binary data]"` (FR-009 — c'est ce placeholder
que computeFieldStats détecte) ; audit `RECORDS_PREVIEWED`. L'« échantillonnage » v4 = la première page
de 50 records, pas un tirage aléatoire.

- `Source v4 :` `src/lib/utils/compute-field-stats.ts`, `src/features/schema/services/record-preview-service.ts`
- `Tests :` `tests/unit/schema/compute-field-stats.test.ts`, `tests/unit/schema/record-preview-service.test.ts`
- `À porter tel quel : oui`

---

### 11. Contrat connecteur + spécificités Salesforce / HubSpot

**Interface `ConnectorAdapter`** (`src/lib/types/connector.ts`) :
- `capabilities: ConnectorCapabilities` = `{ canRead, canWrite, canWriteSchema, supportedFieldTypes? }`
  (`supportedFieldTypes` défini seulement si `canWriteSchema`) ;
- lecture : `connect`, `disconnect`, `getSchema`, `getFields`, `getRecords(page 1-indexée, pageSize)`,
  `getRecordCount`, `getFieldStats` ;
- **schema-write (022), méthodes optionnelles** (présentes ssi `canWriteSchema`) : `createObject`,
  `createField` (sans isReadOnly/isUnique), `modifyField(updates: FieldModification)` qui retourne le champ
  **confirmé par le système destination**.
- `ConnectorField` porte `isAccessible?` (false si l'utilisateur authentifié ne peut pas lire le champ,
  005 FR-003, défaut true) et `picklistValues?` (005 FR-004).

**Validation schema-write locale** (`field-validator.ts`, avant tout appel adapter, contre le snapshot
DESTINATION CURRENT) : create → nom requis, type ∈ supportedFieldTypes, unicité du nom sur l'objet,
`picklistValues` non vide obligatoire pour type picklist/enumeration ; modify → le champ doit exister,
pas de conflit de renommage, type supporté ; **pas de snapshot → on laisse passer** (l'adapter tranchera).

**Salesforce** (`canRead` seul ; jsforce, API v59.0) : OAuth2 **+ PKCE S256** (verifier stocké sur
`globalThis` pour survivre au hot-reload dev), échange de code posté **manuellement** (jsforce n'accepte pas
code_verifier), scope `full refresh_token`. **Refresh transparent** : `getValidConfig` vérifie
`tokenExpiresAt`, rafraîchit via refresh_token, **persiste** le nouveau couple dans `config` et journalise
`SF_TOKEN_REFRESHED` — les appelants ne voient jamais un token expiré. Filtrage objets système : règle 3.

**HubSpot** (`canRead + canWriteSchema`, `supportedFieldTypes: string, number, date, datetime, enumeration, bool`) :
deux modes d'auth — **Private App** (token `pat-…`, validé via `/account-info/v3/details`) et **OAuth2**
(code flow + refresh, expiration calculée avec un tampon de sécurité de 2 min). Schema-write via l'API
properties (createObject/createField/modifyField dans `hubspot-schema-write.ts`).

- `Source v4 :` `src/lib/types/connector.ts`, `src/lib/types/schema-write.ts`,
  `src/features/schema-write/services/field-validator.ts` (+ `write-service.ts`),
  `src/lib/adapters/salesforce/*` (adapter/auth/schema/records/constants),
  `src/lib/adapters/hubspot/*`, `src/lib/adapters/registry.ts`, `src/lib/adapters/demo/demo-adapter.ts`
- `Tests :` `tests/unit/types/connector-contract.test.ts` (le DemoAdapter comme implémentation de référence
  du contrat + registre), `tests/unit/schema-write/field-validator.test.ts` ; **colocalisés dans src/** :
  `src/lib/adapters/salesforce/salesforce.test.ts` (PKCE, URL d'autorisation, échange/refresh de tokens,
  mapping describe→schema/fields, SOQL, constantes), `src/lib/adapters/hubspot/__tests__/hubspot-auth.test.ts`,
  `hubspot-schema.test.ts`, `hubspot-records.test.ts`, `hubspot-schema-write.test.ts`
- `À porter tel quel : oui` (le contrat est la base du futur SDK connecteurs — stratégie bottom-up)

---

## Inventaire des tests purs à porter (Phase 1/2)

Liste à plat des fichiers `tests/unit/**` du worktree v4 qui encodent les règles ci-dessus
(**25 fichiers**) :

1. `tests/unit/documents/document-service-logic.test.ts`
2. `tests/unit/documents/pdf-export.test.ts`
3. `tests/unit/documents/reference-number.test.ts`
4. `tests/unit/documents/rule-description.test.ts`
5. `tests/unit/field-mapping/auto-match-registry.test.ts`
6. `tests/unit/field-mapping/link-status-enrichment.test.ts`
7. `tests/unit/field-mapping/type-status.test.ts`
8. `tests/unit/filters/filter-operators.test.ts`
9. `tests/unit/filters/filter-validation.test.ts`
10. `tests/unit/migration-logic/migration-logic-service.test.ts`
11. `tests/unit/object-mapping/auto-link-registry.test.ts`
12. `tests/unit/object-mapping/object-card.test.tsx` *(composant UI)*
13. `tests/unit/object-mapping/object-link.test.tsx` *(composant UI)*
14. `tests/unit/object-mapping/object-search-filter.test.tsx` *(composant UI)*
15. `tests/unit/plans/steps.test.ts` *(navigation d'étapes : getStepIndex/isForwardStep/getNextStep/normalizeStep/STEP_LABELS)*
16. `tests/unit/schema-write/field-validator.test.ts`
17. `tests/unit/schema/compute-field-stats.test.ts`
18. `tests/unit/schema/drift-service.test.ts`
19. `tests/unit/schema/drift.test.ts`
20. `tests/unit/schema/field-retrieval-service.test.ts` *(Cluster 5 : isAccessible + picklistValues)*
21. `tests/unit/schema/object-classification.test.ts`
22. `tests/unit/schema/object-selection-service.test.ts`
23. `tests/unit/schema/record-preview-service.test.ts`
24. `tests/unit/types/connector-contract.test.ts`
25. `tests/unit/unmapped/compute-unmapped.test.ts`

**Complément — tests unitaires colocalisés dans `src/` (adapters), à porter avec le contrat connecteur (règle 11) :**
`src/lib/adapters/salesforce/salesforce.test.ts`,
`src/lib/adapters/hubspot/__tests__/hubspot-auth.test.ts`,
`src/lib/adapters/hubspot/__tests__/hubspot-schema.test.ts`,
`src/lib/adapters/hubspot/__tests__/hubspot-records.test.ts`,
`src/lib/adapters/hubspot/__tests__/hubspot-schema-write.test.ts`.

**Rappel** : la règle 8 (intégrité) n'est couverte que par
`tests/integration/integrity/integrity-check.integration.test.ts` (DB requise) — prévoir en v5 l'extraction
d'un cœur pur testable unitairement.

## Récapitulatif des anomalies relevées

| # | Anomalie | Impact v5 |
|---|---|---|
| A1 | `driftFlag` introuvable en v4 (linkStatus et drift sont découplés via DriftReport/IntegrityIssue) | Ne pas « porter » un driftFlag ; décision produit si besoin |
| A2 | `LogicStatus` = DRAFT/DEFINED/VALIDATED — pas d'`INCOMPATIBLE` (qui vit dans CompatibilityStatus, IntegrityIssueType et l'alias RuleType) | Garder la séparation des trois enums |
| A3 | Filtres : pas d'`IS_NOT_NULL` ni `NOT_IN` (test l'affirme) ; commentaire « 9 operators » obsolète (11 réels) | Porter les 11 réels ; corriger le commentaire |
| A4 | `mergeDriftReports` sans test unitaire | Écrire le test au port |
| A5 | Préfixes/suffixes système SF définis en double (salesforce-constants vs metadata) avec divergences mineures ; seule la liste CRM est unifiée et gardée par test | Unifier en une seule source en v5 |
| A6 | `MISSING_LOGIC` / `MISSING_EQUIVALENCE` dans l'enum IntegrityIssueType mais jamais détectés par checkIntegrity | Implémenter ou retirer, mais trancher |
| A7 | Langue mixte des documents : descriptions de règles en anglais, gabarits contractuels/filtres en français | Trancher en v5 (cosmétique, ne pas toucher la logique) |
