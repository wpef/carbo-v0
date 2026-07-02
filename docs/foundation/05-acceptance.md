# 05 — Checklist d'acceptation v5

**Statut** : document normatif du dossier de fondation v5.
**Dernière mise à jour** : 2026-07-02.
**Source** : `.specify/regression-audit-v3-v4.md` (audit v3→v4 : 130 régressions en 16 clusters, dont 59 hautes) et `.specify/recovery-decisions.md`.

## Préambule — origine et règles d'usage

**Origine.** La régénération v4 a droppé ~130 raffinements validés en recette v3, dont 92 % étaient déjà spécifiés — un échec d'implémentation, pas de spécification. Cette checklist est la transcription de l'audit en **garantie négative** : la v5 n'est pas acceptée tant qu'un comportement listé ici est absent. C'est le « on ne reperd pas le taff ».

**Usage.** La checklist sert de **grille de recette par tranche verticale** : chaque tranche du parcours (source → sélection → champs → destination → mappings → logique → filtres → intégrité → documents) est recettée avec les items de sa section, cochés sur **DONNÉES RÉELLES** — org Salesforce réelle, portail HubSpot réel. L'adaptateur démo ne valide jamais un item (cf. `04-lessons.md`, mode d'échec ③).

**La règle.** Une tranche n'est « faite » que si chacun de ses items est vérifié par :
- un **test automatisé** (e2e ou unitaire) qui exerce le comportement, OU
- une **recette réelle tracée** (qui a testé, quand, sur quelle org, résultat).

**Jamais sur déclaration.** Un item coché sans référence de test ni trace de recette est réputé non fait.

**Notation.** Chaque item porte sa sévérité d'origine dans l'audit — (H) haute, (M) moyenne, (B) basse — au niveau du cluster dont il provient, et la référence du cluster (c1–c16). Les items marqués **(acquis)** sont des acquis de recette post-audit (recovery-decisions) sans sévérité d'origine : même règle de vérification.

---

## 1. Connexion source — Salesforce (clusters 1, 14)

> Perdu en v4 : les connecteurs réels n'ont jamais été générés — seul l'adaptateur démo existait, alors que OAuth2+PKCE, jsforce et le refresh transparent étaient intégralement spécifiés.

- [ ] (H, c1) L'étape Source propose le choix d'un adaptateur via le registry de connecteurs (Salesforce, démo).
- [ ] (H, c1) La connexion Salesforce s'effectue en OAuth2+PKCE réel de bout en bout : redirection vers SF, login, callback, retour dans l'app connecté.
- [ ] (H, c1) Après le callback OAuth, l'utilisateur revient sur l'étape en cours avec l'état de connexion à jour (flux post-OAuth, pas de page blanche ni d'état perdu).
- [ ] (H, c1) Le token Salesforce est rafraîchi de façon transparente à l'expiration : aucune erreur visible, aucune reconnexion manuelle pendant une session de travail.
- [ ] (H, c1) Une connexion expirée ou en erreur est signalée par un statut visible (CONNECTED / EXPIRED / ERROR) là où la connexion est affichée.
- [ ] (H, c1) Un indicateur de progression de setup (SetupProgress) reflète les étapes de la configuration de connexion.
- [ ] (acquis) La récupération du schéma se déclenche automatiquement à la connexion (auto-fetch) — l'utilisateur n'a pas à trouver un bouton « fetch schema ».
- [ ] (H, c1) Le mode démo est accessible depuis l'étape de connexion (« Use Demo Data »), scopé au connecteur — et n'est utilisé pour valider **aucun** item de cette checklist.

## 2. Sélection des objets source (cluster 9)

> Perdu en v4 : recherche, filtre système, pré-sélection métier, migration de sélection au refresh — la page était réduite à une liste brute.

- [ ] (H, c9) La liste des objets affiche le snapshot CURRENT : label, apiName, distinction standard/custom.
- [ ] (H, c9) La recherche d'objets filtre la liste en temps réel.
- [ ] (H, c9) Les objets système/techniques sont filtrés de la liste par défaut (filtre système).
- [ ] (acquis) La classification des objets Salesforce tient compte des suffixes (`__c`, `__History`, `__Share`, `__ChangeEvent`, `__Tag`, `__Feed`…) pour distinguer objets métier et objets techniques.
- [ ] (H, c9) Les objets métier usuels sont pré-sélectionnés par défaut (pré-sélection métier).
- [ ] (acquis) Des filtres d'affichage Tous / Sélectionnés / Non-sélectionnés permettent de restreindre la liste.
- [ ] (H, c9) Un objet est dépliable (/expand) pour un aperçu de son contenu sans quitter la page.
- [ ] (H, c9) Un résumé (summary) affiche en permanence le nombre d'objets sélectionnés.
- [ ] (H, c9) Après un refresh du schéma, la sélection existante est migrée vers le nouveau snapshot (migrateSelection) : rien n'est désélectionné silencieusement.

## 3. Champs source (clusters 5, 15)

> Perdu en v4 : pages dédiées absentes, et surtout `isAccessible`/`picklistValues` non persistés — une violation directe du principe « pas de perte silencieuse ».

- [ ] (H, c15) Une page dédiée aux champs source (`/source/fields`) est atteignable depuis le parcours.
- [ ] (H, c15) Les champs sont présentés en accordéon par objet, avec les attributs clés (type, requis, lecture seule, unique).
- [ ] (H, c15) Une barre de progression indique la couverture de consultation/traitement des objets.
- [ ] (H, c15) Une route de détail par objet (`/[objectId]`) affiche l'ensemble des champs d'un objet.
- [ ] (H, c5) Après récupération des champs, `picklistValues` est persisté en base pour les champs picklist — vérifiable en DB, et exploité en aval (value-equivalence).
- [ ] (H, c5) `isAccessible` est **peuplé à l'écriture** des champs : un champ inaccessible pour l'utilisateur connecté est visible comme tel dans l'UI, jamais silencieusement absent (Constitution : pas de perte silencieuse).
- [ ] (H, c5) Le remplacement des champs au refresh est atomique : un échec en cours de route ne laisse jamais un objet sans champs (pas de delete + createMany non transactionnel).

## 4. Aperçu des enregistrements et statistiques (cluster 8)

> Perdu en v4 : le domaine 009/010 entier (pages, table, pagination, stats) n'a jamais été généré.

- [ ] (H, c8) Une page d'aperçu des enregistrements réels est atteignable pour un objet sélectionné.
- [ ] (H, c8) La table d'aperçu est paginée et affiche de vraies données de l'org.
- [ ] (H, c8) Des statistiques par champ (taux de remplissage) sont calculées et affichées (computeFieldStats).
- [ ] (H, c8) Les champs binaires/non affichables sont gérés proprement (indicateur, pas de crash ni de contenu illisible).
- [ ] (H, c8) La consultation d'un aperçu est tracée dans l'audit trail.

## 5. Connexion destination — HubSpot (clusters 1, 15)

> Perdu en v4 : même cause que la source — l'adaptateur HubSpot réel (Private App, properties API) n'existait pas.

- [ ] (H, c1) La connexion HubSpot s'effectue via Private App (token) réelle, avec le même cycle statut/erreur que la source.
- [ ] (H, c1) Le schéma destination est récupéré via l'API properties réelle de HubSpot (objets + propriétés).
- [ ] (H, c15) Une page dédiée aux champs destination (`/destination/fields`) est atteignable depuis le parcours.

## 6. Mapping d'objets (cluster 10)

> Perdu en v4 : l'auto-link (le schéma avait le timestamp `objectAutoLinkedAt` mais la logique n'a jamais été écrite), l'overlay SVG, la modale de détail.

- [ ] (H, c10) À l'arrivée sur l'étape, un auto-link crée les mappings évidents via le registre sémantique SF→HubSpot (Account→company, Contact→contact, Opportunity→deal…).
- [ ] (acquis) L'auto-link est **idempotent** (`objectAutoLinkedAt`) : revisiter la page ne recrée pas les mappings supprimés et n'écrase pas les mappings modifiés à la main.
- [ ] (H, c10) Les liens objet→objet sont visualisés graphiquement (overlay SVG à courbes de Bézier entre les deux colonnes).
- [ ] (H, c10) Un mapping peut être créé manuellement entre tout objet source sélectionné et tout objet destination.
- [ ] (H, c10) Une modale de détail affiche le contenu d'un mapping (champs, statut, actions).
- [ ] (H, c10) La recherche et les filtres fonctionnent sur les deux colonnes (source et destination).
- [ ] (H, c10) Un mapping se supprime, et sa suppression retire les field mappings, filtres et exclusions associés (cascade).

## 7. Mapping de champs (clusters 16, 3)

> Perdu en v4 : le linkStatus 5 états (spec 012 FR-007) réduit à 3 états de compatibilité, la résolution par apiName remplacée par des FK stales, l'auto-match jamais écrit.

- [ ] (M, c16) Un auto-match des champs s'exécute via le registre sémantique SF→HubSpot (FirstName→firstname, etc.).
- [ ] (acquis) L'auto-match est **idempotent** (`fieldAutoMatchedAt`) : re-passage sans doublon ni écrasement des choix manuels.
- [ ] (M, c16) Les types bruts source/destination sont stockés au mapping et la compatibilité (COMPATIBLE / WARNING / INCOMPATIBLE) est calculée et affichée.
- [ ] (H, c3) Chaque lien champ→champ affiche un **linkStatus à 5 états** (GREEN / ORANGE / RED_SOLID / RED_DASHED / BROKEN), **calculé à la lecture** — jamais stocké.
- [ ] (H, c3) Le statut BROKEN a **précédence** sur tous les autres états.
- [ ] (H, c3) Un `statusDetail` explique en clair pourquoi un lien a son statut.
- [ ] (H, c3) Un filtre/surbrillance « Cassé » isole les liens BROKEN dans la liste.
- [ ] (H, c3) La résolution se fait **par apiName** contre le snapshot CURRENT : un champ renommé/supprimé côté CRM est détecté comme cassé, jamais résolu via une FK stale vers un vieux snapshot.
- [ ] (M, c16) Mapper deux fois le même champ (source ou destination) est refusé (409) avec message explicite.
- [ ] (M, c16) La recherche filtre les champs des deux côtés.
- [ ] (M, c16) Le statut du mapping et les compteurs sont recalculés après chaque création/modification/suppression (pas d'état périmé à l'écran).
- [ ] (M, c16) Un panneau de prévisualisation (MigrationPreviewPanel) montre l'effet du mapping sur des valeurs réelles.
- [ ] (M, c16) Une modale de modification de champ (ModifyFieldModal) est accessible depuis le mapping.
- [ ] (M, c16) Les onglets portent des badges de compteurs (TabBadge) cohérents avec les données.

## 8. Champs non mappés et exclusions (cluster 6)

> Perdu en v4 : la détection des champs non mappés et le CRUD des exclusions — le cœur de la promesse « aucune perte silencieuse » côté consultant.

- [ ] (H, c6) La détection des champs source non mappés fonctionne au niveau du plan **et** par object mapping (deux routes).
- [ ] (H, c6) Un avertissement visible (UnmappedFieldsWarning) liste les champs non mappés là où le consultant travaille.
- [ ] (H, c6) Un champ peut être **exclu explicitement** avec une raison ; l'exclusion est datée et supprimable (FieldExclusion CRUD complet).
- [ ] (H, c6) Un champ exclu ne compte plus comme « non mappé » mais reste tracé et apparaît dans les documents générés.

## 9. Logique de migration (cluster 4)

> Perdu en v4 : la modale D1–D4 entière — structurellement impossible sans le modèle `ClassificationPrompt` (trou data-model comblé, cf. `03-data-model.md` §8).

- [ ] (H, c4) La modale de logique s'ouvre par paire de champs et affiche la **section D1–D4 calculée** depuis les types (`getSectionType`), jamais lue d'une colonne.
- [ ] (H, c4) D1 (picklist→picklist) : l'équivalence de valeurs propose les **vraies valeurs** des deux picklists (depuis `picklistValues`) et persiste les correspondances (ValueEquivalence).
- [ ] (H, c4) D2 (texte→picklist) : la classification LLM fonctionne via une route `/classify` réelle ; le prompt est persisté (ClassificationPrompt).
- [ ] (H, c4) D2 : les classifications peuvent être **rafraîchies** par un nouvel appel LLM après modification du prompt.
- [ ] (H, c4) D3 (types incompatibles) : le champ est marqué incompatible dans l'UI — état calculé (compatibilité + section), sans enregistrement MigrationLogic ni valeur d'enum stockée.
- [ ] (H, c4) Le statut de logique (DRAFT / DEFINED / VALIDATED) est visible et évolue avec les actions de l'utilisateur.

## 10. Filtres de migration (cluster 12)

> Perdu en v4 : le toggle `isActive` (colonne absente), les champs filtrables, l'estimation, une partie des opérateurs.

- [ ] (H, c12) Un filtre se crée sur un object mapping en choisissant un champ parmi les champs **filtrables** (route /filterable-fields).
- [ ] (H, c12) Les opérateurs disponibles couvrent l'enum complet, dont DATE_AFTER et DATE_BEFORE. (⚠️ `IS_NOT_NULL`/`NOT_IN` : divergence V1 ouverte, cf. `03-data-model.md` §7 — trancher avant de cocher.)
- [ ] (H, c12) Un filtre s'active/désactive (toggle `isActive` via PATCH) sans être supprimé, et l'état est visible.
- [ ] (H, c12) Une estimation du nombre d'enregistrements concernés est affichée (route /estimate) sur données réelles.
- [ ] (H, c12) La valeur saisie est validée selon l'opérateur (ex. IS_NULL sans valeur, dates au bon format).
- [ ] (H, c12) Les composants UI de filtre (liste, formulaire, badges) sont présents et fonctionnels sur la page de mapping.

## 11. Intégrité, statut BROKEN et drift (clusters 2, 11)

> Perdu en v4 : `PlanStatus.BROKEN` absent de l'enum, contrôle jamais auto-déclenché, diff post-refresh non branché, `detectLiveDrift` (spec 003 FR-012..016) jamais écrit.

- [ ] (H, c2) Le contrôle d'intégrité se déclenche **automatiquement** après un refresh de schéma.
- [ ] (H, c2) Le contrôle d'intégrité se déclenche automatiquement après les CRUD de mappings/logiques/filtres.
- [ ] (H, c2) Quand une issue bloquante existe, le plan passe à **BROKEN**, visible partout où le statut du plan est affiché.
- [ ] (H, c2) La broken-ness d'un mapping/champ est **dérivée des IntegrityIssue** à la lecture (pas de colonne status) et s'affiche en badge rouge sur les mappings concernés.
- [ ] (H, c2) Une réparation (repairBrokenMappings) est proposée et re-résout par apiName ce qui peut l'être.
- [ ] (H, c2) Les changements de **type** d'un champ entre deux snapshots (typeChanges) sont détectés et signalés.
- [ ] (H, c2) La résolution d'une issue la marque resolved/resolvedAt ; quand plus aucune issue bloquante ne subsiste, le plan quitte BROKEN.
- [ ] (H, c11) Le diff de schéma post-refresh est **branché** : la route /diff retourne ajouts, suppressions et modifications entre snapshot CURRENT et PREVIOUS.
- [ ] (H, c11) `detectLiveDrift` compare le plan au schéma live et produit un DriftReport selon la taxonomie des 12 types (spec 003 FR-012..016).
- [ ] (H, c11) Une bannière de drift est visible dans le parcours quand un drift est détecté.

## 12. Documents (cluster 13)

> Perdu en v4 : export PDF, descriptions de règles PROMPT/INFO/ERROR avec LLM, vues détail, structure contractuelle en 7 articles.

- [ ] (H, c13) Le document texte se génère avec ses compteurs exacts (objets, champs, règles, non mappés, appels LLM).
- [ ] (H, c13) Le document contractuel se génère avec un numéro de référence unique et la **structure en 7 articles** + bloc de signature.
- [ ] (H, c13) Les descriptions de règles couvrent les types PROMPT / INFO / ERROR, avec rédaction LLM là où spécifié.
- [ ] (H, c13) Les deux documents s'**exportent en PDF**.
- [ ] (H, c13) Des vues de détail permettent de consulter chaque document généré (pas seulement une liste).
- [ ] (H, c13) La régénération incrémente la version ; l'ancienne passe à OUTDATED, la nouvelle est CURRENT.
- [ ] (H, c6+c13) Les champs non mappés et les exclusions (avec raisons) figurent dans les documents générés.

## 13. Schema write — destination (cluster 7 : 0/52 tâches en v4)

> Perdu en v4 : le domaine 022 entier — 52 tâches listées dans la spec, zéro générée.

- [ ] (H, c7) Un champ manquant côté destination peut être **créé** depuis l'app (route + service + UI).
- [ ] (H, c7) Un champ destination peut être **modifié** (modifyField) quand l'adaptateur le permet.
- [ ] (H, c7) L'adaptateur HubSpot exécute réellement l'écriture (création de property visible dans le portail HubSpot).
- [ ] (H, c7) Une page/section dédiée au schema write est atteignable depuis le parcours, avec ses composants et son hook.
- [ ] (H, c7) Une suggestion LLM assiste la définition du champ à créer.
- [ ] (H, c7) Chaque opération d'écriture est tracée (SchemaWriteOperation : type, objet, champ, statut, erreur éventuelle).

## 14. Navigation, layout, stepper (cluster 14)

> Perdu en v4 : le BUG BLOQUANT `targetStep`/`body.step` gelait le parcours dès la première transition (chaque avancement renvoyait 400) ; header, vue plan, suppression et sous-pages absents.

- [ ] (H, c14) **Chaque avancement d'étape fonctionne** : le contrat client/serveur de la route de step est identique des deux côtés (le bug `targetStep`/`body.step` gelait tout le parcours en v4 — un test e2e doit couvrir chaque transition).
- [ ] (H, c14) La sidebar/stepper déverrouille les étapes au fur et à mesure et les étapes passées restent cliquables.
- [ ] (acquis) La **navigation arrière** dans le stepper fonctionne : revenir à une étape antérieure n'efface ni sélection, ni mappings, ni logique.
- [ ] (H, c14) Le header affiche l'état des connecteurs (source/destination) en permanence.
- [ ] (H, c14) Un bouton « étape suivante » explicite est présent sur chaque étape.
- [ ] (H, c14) Une vue plan (dashboard du plan) donne l'état d'ensemble : statut, étape courante, compteurs.
- [ ] (H, c14) Un plan peut être supprimé, avec cascade propre sur toutes ses entités.
- [ ] (H, c14) Toutes les sous-pages (champs, preview, filtres, documents…) sont accessibles par navigation — aucune ne nécessite de taper une URL.

---

## 15. Gates transverses (bloquants pour la release)

- [ ] **G1 — Parcours e2e complet vert** : un test automatisé traverse création de plan → source → sélection → destination → object mapping → field mapping → logique → filtres → documents, sans intervention manuelle.
- [ ] **G2 — Zéro page orpheline** : chaque page riche de l'app est atteignable par clics depuis le parcours (inventaire des routes vs liens de navigation).
- [ ] **G3 — Plan READY en bout de parcours** : à l'issue du parcours complet, le plan atteint le statut READY (et repasse correctement par BROKEN → READY après un incident d'intégrité réparé).
- [ ] **G4 — Recette sur org Salesforce réelle** comportant **> 1000 objets** : listes, recherche, sélection et pagination restent utilisables (pas de recette uniquement sur org de dev quasi vide).
- [ ] **G5 — `tsc` : 0 erreur** (`tsc --noEmit` propre sur tout le projet).
- [ ] **G6 — Aucun item coché sur déclaration** : chaque coche de ce document référence un test (chemin du fichier) ou une entrée de recette tracée (date, org, testeur, résultat).

**Total : 106 items** (100 items de parcours — 86 issus des clusters H, 8 du cluster M, 6 acquis de recette — + 6 gates transverses).

---

## Annexe — Traçabilité clusters d'audit → sections

Garantie de couverture : chacun des 16 clusters de l'audit est absorbé par au moins une section.

| Cluster (audit §3) | Sévérité | Section(s) |
|---|---|---|
| c1 — Connecteurs réels SF/HubSpot | H | §1, §5 |
| c2 — Statut BROKEN + intégrité auto-déclenchée | H | §11 |
| c3 — linkStatus 5 états + résolution apiName | H | §7 |
| c4 — Migration-logic D1/D2/D3/D4 | H | §9 |
| c5 — isAccessible & picklistValues non persistés | H | §3 |
| c6 — Détection champs non-mappés | H | §8, §12 |
| c7 — Schema-write 022 | H | §13 |
| c8 — Record preview + field stats | H | §4 |
| c9 — Sélection objets source | H | §2 |
| c10 — Object mapping 011 | H | §6 |
| c11 — Schema diff & live drift | H | §11 |
| c12 — Filtres migration | H | §10 |
| c13 — Documents | H | §12 |
| c14 — Navigation/Layout/Stepper | H | §14 (+ §1 header) |
| c15 — Pages dédiées champs source+dest | H | §3, §5 |
| c16 — Field mapping 012 | M | §7 |

Angles morts assumés (audit §5, non couverts par cette checklist, à traiter séparément) : reconnexion/reconfiguration des connecteurs, stratégie de persistance/chiffrement des tokens OAuth, inventaire exhaustif de l'audit trail, couverture de tests v4 vs v3, migrations Prisma/DB partagée.
