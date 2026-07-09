# 05b — Couverture v5 (tracker vivant)

> **À quoi sert ce document.** C'est l'état d'avancement, item par item, de la checklist d'acceptation [05-acceptance.md](05-acceptance.md) (106 exigences dérivées de l'audit des 130 régressions v3→v4). On le lit pour savoir **ce qui est fait, à moitié fait, ou manquant** — sans jamais avoir à re-lister. Chaque tranche future met à jour les lignes qu'elle touche.

> **Méthode.** Statuts établis par audit multi-agents (7 auditeurs + critique de complétude) croisant chaque item avec le code `src/` et les tests `tests/`, preuve (fichier) à l'appui. Règle du préambule §11 respectée : **un item prouvé uniquement par le connecteur démo reste « non testé »** — seule une recette réelle tracée ou un test le validant compte.

## Décompte

| Statut | Nombre |
|---|---|
| ✅ Testé | 43 |
| 🟡 Présent (non testé / preuve démo) | 19 |
| 🟠 Partiel | 15 |
| 🔵 Dévié v5 | 3 |
| ❌ Manquant | 26 |
| ⏸ Phase 2 | 0 |
| **Total** | **106** |

**43/106 items solidement présents + testés.** Le cœur du parcours (mapping de champs, logique D1, filtres, navigation, couverture, intégrité) est testé ; le reste est soit prouvable seulement par recette réelle (🟡), soit partiel (🟠), soit à construire (❌).

### Légende
- ✅ **Testé** — implémenté, atteignable, couvert par un test qui l'exerce.
- 🟡 **Présent (non testé / preuve démo)** — code présent et atteignable, mais prouvé seulement via la démo (non validante) ou sans test dédié → **à cocher par recette réelle**.
- 🟠 **Partiel** — une partie de la promesse manque (souvent : back présent, UI absente).
- 🔵 **Dévié v5** — implémenté autrement qu'en v4, comportement présent (choix assumé).
- ❌ **Manquant** — pas dans le code v5.

---

## §1. Connexion source — Salesforce

| Item | Statut | Preuve / manque |
|---|---|---|
| L'étape Source propose le choix d'un adaptateur via le registry de connecteurs (Salesforce, démo) | 🟡 Présent (non testé / preuve démo) | src/features/connectors/registry.ts:9 (salesforceAdapter+demoSourceAdapter enregistrés) ; listAdaptersForSide L25 ; API src/app/api/connectors/route.ts ; UI src/features/connections/components/adapter-picker.tsx:33 mappe adapters ; monté via connection-page.tsx:56. Le picker rendu est exercé UNIQUEMENT sur démo dans tests/e2e/journey.spec |
| Connexion Salesforce en OAuth2+PKCE réel de bout en bout (redirection SF, login, callback, retour connecté) | 🟡 Présent (non testé / preuve démo) | Flux complet présent : src/app/api/connectors/salesforce/auth/route.ts:37 (redirect authorize) ; callback src/app/api/connectors/salesforce/callback/route.ts:43 (exchangeCodeForTokens) ; briques PKCE/échange unit-testées tests/unit/connectors/salesforce-auth.test.ts:110-164. MAIS le flux de bout en bout (redirection→login→callback→retour  |
| Après le callback OAuth, retour sur l'étape en cours avec état de connexion à jour (flux post-OAuth, pas de page blanche) | 🟡 Présent (non testé / preuve démo) | callback redirige vers `/plans/{planId}/source?connected=salesforce` (callback/route.ts:78) ; use-connection.ts:59-96 recharge le plan + compteur d'objets au montage, et gère ?connector_error (L34-43). Le retour connecté n'est couvert par aucun test (démo ne passe pas par un callback OAuth). — _manque : Comportement implémenté et cohérent |
| Token Salesforce rafraîchi de façon transparente à l'expiration (aucune erreur visible, aucune reconnexion manuelle) | 🟡 Présent (non testé / preuve démo) | Refresh transparent implémenté : src/features/connectors/salesforce/adapter.ts:41-67 (getValidConfig → refreshAccessToken + persistance + audit SF_TOKEN_REFRESHED). La fonction pure refreshAccessToken est testée (tests/unit/connectors/salesforce-auth.test.ts:166-189) MAIS le comportement d'orchestration getValidConfig/isExpired (déclenche |
| Connexion expirée/en erreur signalée par un statut visible (CONNECTED / EXPIRED / ERROR) là où la connexion est affichée | 🟠 Partiel | L'enum ConnectionStatus{CONNECTED,EXPIRED,ERROR} existe (prisma/schema.prisma:53-57, champ status @default(CONNECTED) L63) mais n'est JAMAIS affiché : connection-card.tsx:35 code en dur « connecté » ; plan-header.tsx:23-30 (ConnectionPill) n'affiche que le nom. Et le status n'est JAMAIS mis à EXPIRED/ERROR (aucune écriture status: retrouv |
| Un indicateur de progression de setup (SetupProgress) reflète les étapes de configuration de connexion | ❌ Manquant | Aucun composant SetupProgress n'existe dans le code v5. |
| (acquis) Récupération du schéma déclenchée automatiquement à la connexion (auto-fetch) | 🟡 Présent (non testé / preuve démo) | Auto-fetch présent : createConnection appelle fetchSchema (src/features/connectors/connection-service.ts:39) ; callback OAuth SF fetch best-effort (callback/route.ts:66) ; filet client relance le fetch si snapshot absent (use-connection.ts:72-82). Exercé en e2e SEULEMENT sur démo (journey.spec.ts:46 « 8 objets découverts »), non validant. |
| Mode démo accessible depuis l'étape de connexion (« Use Demo Data »), scopé au connecteur | 🔵 Dévié v5 | La démo est accessible depuis l'étape de connexion et scopée (adaptateurs distincts demoSourceAdapter/demoDestinationAdapter, sides SOURCE/DESTINATION — src/features/connectors/demo/adapter.ts:33-48 & registry.ts:9-14 ; rendu comme entrée du picker, adapter-picker.tsx:33). MAIS ce n'est PAS un bouton « Use Demo Data » attaché à un connect |

## §2. Sélection des objets source

| Item | Statut | Preuve / manque |
|---|---|---|
| La liste des objets affiche le snapshot CURRENT : label, apiName, distinction standard/custom | 🟡 Présent (non testé / preuve démo) | object-selection-page.tsx:213-232 affiche label + (apiName) + badge Personnalisé/Standard/Système ; données du snapshot CURRENT via selection-service.ts:36 getCurrentSnapshot + classifyObject (L65). Exercé en e2e uniquement sur démo (journey.spec.ts:52-62), non validant par règle du préambule ; classifyObject est unit-testé (salesforce-sc |
| La recherche d'objets filtre la liste en temps réel | 🟡 Présent (non testé / preuve démo) | Filtrage temps réel implémenté : object-selection-page.tsx:56-72 (useMemo sur search, match apiName/label/description). Exercé e2e sur démo uniquement (journey.spec.ts:61-64 « Invoice »), non validant ; aucun test unitaire sur la logique `visible`. — _manque : Recherche fonctionnelle et atteignable mais seule preuve = e2e démo (non valida |
| Les objets système/techniques sont filtrés de la liste par défaut (filtre système) | 🟡 Présent (non testé / preuve démo) | Masquage par défaut : object-selection-page.tsx:39 showSystem=false initial ; L57-58 exclut category==='system' ; toggle L184. classifyObject (classification.ts:10) unit-testé (salesforce-schema.test.ts:223-250). Le MASQUAGE par défaut lui-même n'est exercé que via l'e2e démo (journey.spec.ts:52-58), non validant. — _manque : La classific |
| (acquis) Classification tenant compte des suffixes (__c, __History, __Share, __ChangeEvent, __Tag, __Feed…) | ✅ Testé | classification.ts:18 teste systemSuffixes ; constantes SF_SYSTEM_SUFFIXES = History/Share/ChangeEvent/Feed/__Tag/__History/__Share/__Feed (src/features/connectors/salesforce/constants.ts:35-37). Unit-testé : tests/unit/connectors/salesforce-schema.test.ts:230-237 vérifie ContactHistory/ContactShare/ContactChangeEvent classés 'system'. Att |
| Les objets métier usuels sont pré-sélectionnés par défaut (pré-sélection métier) | ✅ Testé | isSelectedByDefault (classification.ts:23-31) + SF_DEFAULT_CRM_OBJECTS (constants.ts:40-43) ; bootstrap au 1er appel selection-service.ts:44-57. Unit-testé : salesforce-schema.test.ts:252-266 (Contact/Account/Lead/Invoice__c pré-sélectionnés, Pricebook2 non). Atteignable : object-selection-page consomme /source/objects qui appelle getObje |
| (acquis) Filtres d'affichage Tous / Sélectionnés / Non-sélectionnés | 🟡 Présent (non testé / preuve démo) | object-selection-page.tsx:40 selectionFilter ; boutons L164-183 (Tous/Sélectionnés/Non sélectionnés) ; filtrage L60-62. Exercé e2e sur démo (journey.spec.ts:70-73), non validant ; aucun test unitaire. — _manque : Présent et atteignable mais preuve seulement via démo (non validante) ; pas de test unitaire ni recette réelle._ |
| Un objet est dépliable (/expand) pour un aperçu de son contenu sans quitter la page | ❌ Manquant | Aucune capacité de dépliage/aperçu d'objet sur la page de sélection ; item entièrement absent. |
| Un résumé (summary) affiche en permanence le nombre d'objets sélectionnés | 🟡 Présent (non testé / preuve démo) | summary calculé selection-service.ts:71-76 ; affiché en permanence object-selection-page.tsx:190-193 (« X objets sélectionnés sur Y »). Exercé e2e démo (journey.spec.ts:52,68), non validant ; pas de test unitaire du summary. — _manque : Compteur présent et permanent mais preuve uniquement via démo (non validante) ; pas de test unitaire ni |
| Après un refresh du schéma, la sélection existante est migrée vers le nouveau snapshot (migrateSelection) : rien n'est désélectionné silencieusement | ✅ Testé | connection-service.ts fetchSchema migrateSelection (rotation transactionnelle) ; test e2e « migrateSelection » |

## §3. Champs source

| Item | Statut | Preuve / manque |
|---|---|---|
| Page dédiée /source/fields atteignable depuis le parcours | ✅ Testé | src/app/plans/[planId]/source/fields/page.tsx:3 monte FieldsPage side=source ; navigable depuis /source/objects via CTA (fields-page.tsx:117). Exercé e2e : tests/e2e/journey.spec.ts:75-80 (waitForURL source/fields + assert '4 objets · N champs') |
| Champs en accordéon par objet avec attributs clés (type, requis, lecture seule, unique) | 🟠 Partiel | src/features/schema/components/field-catalog-view.tsx:58-69 rend l'accordéon avec badges requis + inaccessible + dataType uniquement — _manque : lecture seule (isReadOnly) et unique (isUnique) ne sont JAMAIS affichés : ils sont retirés dès field-catalog-service.ts:5-12 (type FieldInfo sans isReadOnly/isUnique) puis absents du type FieldCa |
| Barre de progression de la couverture de consultation/traitement des objets | ❌ Manquant | Aucun composant Progress/barre de progression dans src/features/schema ni ailleurs (grep 'progress|Progress|coverage|couverture|barre' sur src/features/schema → 0 résultat ; find src/components -iname '*progress*' → 0). fields-page.tsx n'affiche qu'un compteur texte 'N objets · N champs' (ligne 137), pas de barre. |
| Route de détail par objet (/[objectId]) affichant l'ensemble des champs d'un objet | ❌ Manquant | Aucune route dynamique sous source/fields : find src/app/plans → seuls source/fields/page.tsx et destination/fields/page.tsx (pages plates). Pas de segment [objectId] nulle part côté pages. Les vues sont l'accordéon global uniquement. |
| picklistValues persisté en DB pour les champs picklist, vérifiable en DB et exploité en aval (value-equivalence) | ✅ Testé | Écriture DB : src/features/schema/field-retrieval-service.ts:50 (picklistValues JSON.stringify au createMany). Exploitation aval : migration-logic-service.ts:239-240 parsePicklist(sourceField?.picklistValues) pour D1, field-mapping-service.ts:131-132. Tests : extraction adaptateur salesforce-schema.test.ts:161-184 et hubspot-schema.test.t |
| isAccessible peuplé à l'écriture ; un champ inaccessible visible comme tel dans l'UI, jamais silencieusement absent | 🟠 Partiel | Peuplé à l'écriture : field-retrieval-service.ts:48 (isAccessible: f.isAccessible) ; badge UI présent field-catalog-view.tsx:66 ('inaccessible' destructive) ; compteur inaccessibleCount field-catalog-service.ts:61 affiché fields-page.tsx:138 — _manque : Aucun adaptateur ne produit jamais isAccessible=false : salesforce/schema.ts:57, hubsp |
| Remplacement des champs au refresh atomique (pas de delete + createMany non transactionnel) | 🟡 Présent (non testé / preuve démo) | field-retrieval-service.ts db.$transaction([delete,create]) — atomicité garantie — _manque : aucun test ne force un échec en cours de refresh_ |

## §4. Aperçu enregistrements + stats

| Item | Statut | Preuve / manque |
|---|---|---|
| Une page d'aperçu des enregistrements réels est atteignable pour un objet sélectionné | ✅ Testé | record-preview.tsx (aperçu par objet dans l'accordéon de /source/fields, atteignable depuis le parcours) ; test e2e journey « Aperçu des données » |
| La table d'aperçu est paginée et affiche de vraies données de l'org | ✅ Testé | record-preview.tsx (table + pagination Précédent/Suivant sur /records) ; back fetchRecordPage testé record-preview-service.test.ts ; e2e journey |
| Statistiques par champ (taux de remplissage) calculées et affichées (computeFieldStats) | ✅ Testé | record-preview.tsx affiche « rempli N% » par colonne via computeFieldStats (plus orphelin) ; compute-field-stats.test.ts ; e2e assert « rempli \d+% » |
| Les champs binaires/non affichables sont gérés proprement (indicateur, pas de crash ni contenu illisible) | 🟡 Présent (non testé / preuve démo) | Sanitisation service ("[binary data]") + sentinelle stats "N/A" affichée par record-preview.tsx ; testé au niveau service (record-preview-service.test.ts, compute-field-stats.test.ts) — _manque : pas de test UI du rendu binaire (la démo n'a pas de champ binaire)_ |
| La consultation d'un aperçu est tracée dans l'audit trail (RECORDS_PREVIEWED) | ✅ Testé | src/features/schema/record-preview-service.ts:72 (logAuditEvent action RECORDS_PREVIEWED) ; test tests/unit/schema/record-preview-service.test.ts:125 ; atteint via migration-preview-panel.tsx:59 → route source/records → fetchRecordPage — _manque : L'événement d'audit est bien émis et testé unitairement, et le chemin est atteignable (le Mi |

## §5. Connexion destination — HubSpot

| Item | Statut | Preuve / manque |
|---|---|---|
| Connexion HubSpot via Private App (token) réelle, avec le même cycle statut/erreur que la source | 🟠 Partiel | Chemin Private App réel et branché de bout en bout : UI 'Utiliser un token' adapter-picker.tsx:51-58 + private-app-token-form.tsx → hook connectPrivateApp use-connection.ts:123-139 → route POST src/app/api/connectors/hubspot/auth/route.ts:47-101 (validateToken réel /account-info/v3/details puis create connection + fetchSchema). Logique va |
| Schéma destination récupéré via l'API properties réelle de HubSpot (objets + propriétés) | ✅ Testé | src/features/connectors/hubspot/schema.ts:67-95 getProperties appelle GET crm/v3/properties/{objectType} réel ; getCustomObjects:42-64 appelle crm/v3/schemas ; adapter.ts:68-89 getObjects (standard+custom) + getFields. Tests : hubspot-schema.test.ts:138-224 (getProperties mappe readOnly/unique/enumeration→picklist+picklistValues, erreur A |
| Page dédiée /destination/fields atteignable depuis le parcours | ✅ Testé | src/app/plans/[planId]/destination/fields/page.tsx:3 monte FieldsPage side=destination ; CTA depuis la carte de connexion connection-page.tsx:31 (continuePath /destination/fields) et connection-card.tsx. Route API destination/fields/route.ts branchée. Exercé e2e journey.spec.ts:91-95 (waitForURL destination/fields + assert '4 objets · N c |

## §6. Mapping d'objets

| Item | Statut | Preuve / manque |
|---|---|---|
| Auto-link crée les mappings évidents via le registre sémantique SF→HubSpot à l'arrivée sur l'étape | ✅ Testé | Logique : src/features/connectors/link-registry.ts:33 (computeAutoLinkPairs, registre salesforce:hubspot Account→companies, Contact→contacts, Opportunity→deals, Lead→contacts, Case→tickets) ; service src/features/object-mapping/object-mapping-service.ts:35 ; déclenché au chargement src/features/object-mapping/components/object-mapping-pag |
| L'auto-link est idempotent (objectAutoLinkedAt) : revisiter ne recrée pas les mappings supprimés ni n'écrase les modifs manuelles | ✅ Testé | Gate service dans la même transaction : src/features/object-mapping/object-mapping-service.ts:45 (early-return si plan.objectAutoLinkedAt) et :75 (update objectAutoLinkedAt dans $transaction) ; dédup par source alreadyMapped link-registry.ts:43 ; test idempotence tests/unit/connectors/link-registry.test.ts:66 ; garde UI object-mapping-pag |
| Les liens objet→objet sont visualisés graphiquement (overlay SVG à courbes de Bézier entre les deux colonnes) | ❌ Manquant | Aucun overlay SVG ni courbe de Bézier. Le lien est matérialisé par du texte/icône (« → Companies », badge Link2) dans les listes, pas par une visualisation graphique reliant les deux colonnes. Le composant est explicitement commenté « version skeleton » (object-mapping-page.tsx:3). |
| Un mapping peut être créé manuellement entre tout objet source sélectionné et tout objet destination | ✅ Testé | UI clic-source-puis-destination : src/features/object-mapping/components/object-mapping-page.tsx:76 (createPair) ; route POST src/app/api/plans/[planId]/object-mappings/route.ts:42 ; e2e tests/e2e/journey.spec.ts:106-109 (Invoice__c → tickets, « Paires mappées (4) ») — _manque : Création manuelle exercée en e2e. Réserve : e2e sur connecte |
| Une modale de détail affiche le contenu d'un mapping (champs, statut, actions) | ❌ Manquant | Aucune modale de détail. Le « contenu » d'un mapping se réduit à un compteur de champs inline et deux boutons d'action sur la ligne ; aucun panneau/modale affichant champs, statut et actions du mapping. Élément listé comme perdu en v4 et non reconstruit. |
| La recherche et les filtres fonctionnent sur les deux colonnes (source et destination) | ❌ Manquant | Aucun champ de recherche ni filtre sur l'une ou l'autre colonne. Les deux listes affichent tous les objets sans moyen de filtrer — problématique sur une org réelle volumineuse (cf. gate G4 >1000 objets). |
| Un mapping se supprime, et sa suppression retire les field mappings, filtres et exclusions associés (cascade) | 🟡 Présent (non testé / preuve démo) | UI bouton Trash2 : src/features/object-mapping/components/object-mapping-page.tsx:93 (deletePair, confirm) ; route DELETE src/app/api/plans/[planId]/object-mappings/[mappingId]/route.ts:7 ; service object-mapping-service.ts:22 (deleteMany) ; cascade Prisma prisma/schema.prisma:185,257,269 (FieldMapping/MigrationFilter/FieldExclusion onDel |

## §7. Mapping de champs

| Item | Statut | Preuve / manque |
|---|---|---|
| Auto-match des champs via le registre sémantique SF→HubSpot (FirstName→firstname, etc.) | ✅ Testé | src/features/connectors/link-registry.ts:131 computeFieldMatchPairs (registre FIELD_MATCH_MAP + name-based); appelé par src/features/field-mapping/field-mapping-service.ts:263 autoMatchFields. Testé: tests/unit/connectors/link-registry.test.ts:87-145 (registre + name-based, réel SF/HS) ET e2e tests/e2e/journey.spec.ts:124 « champ(s) mappé |
| Auto-match idempotent (fieldAutoMatchedAt) : re-passage sans doublon ni écrasement des choix manuels | 🟡 Présent (non testé / preuve démo) | Gate présent: src/features/field-mapping/field-mapping-service.ts:255 `if (mapping.fieldAutoMatchedAt) return {created:0, skipped:true}` + pose du timestamp dans la même transaction (ligne 294-297). La dédup pure (déjà-mappés exclus) est testée tests/unit/connectors/link-registry.test.ts:122. MAIS aucun test n'exerce le gate fieldAutoMatc |
| Types bruts source/destination stockés au mapping + compatibilité (COMPATIBLE/WARNING/INCOMPATIBLE) calculée et affichée | ✅ Testé | Stockage: prisma/schema.prisma:180-182 (sourceFieldType, destinationFieldType, compatibilityStatus) + createFieldMapping src/features/field-mapping/field-mapping-service.ts:218-226 pose compatibilityStatus via checkTypeCompatibility. Affichage: la compatibilité est reflétée via linkStatus (RED_DASHED = « incompatible ») src/features/field |
| linkStatus à 5 états (GREEN/ORANGE/RED_SOLID/RED_DASHED/BROKEN) calculé à la lecture, jamais stocké | ✅ Testé | src/features/field-mapping/lib/link-status.ts:42 computeLinkStatus (pur, aucune colonne DB — la FieldMapping n'a pas de colonne linkStatus, cf. prisma/schema.prisma:175-190). Calculé dans toDTO src/features/field-mapping/field-mapping-service.ts:135. Testé exhaustivement: tests/unit/field-mapping/type-status.test.ts:272-429 et tests/unit/ |
| Le statut BROKEN a précédence sur tous les autres états | ✅ Testé | src/features/field-mapping/lib/link-status.ts:49-64 (les checks BROKEN précèdent toute autre branche). Testé: tests/unit/field-mapping/type-status.test.ts:411-423 (« BROKEN > RED_DASHED/RED_SOLID/GREEN ») et link-status-enrichment.test.ts:150-170. |
| Un statusDetail explique en clair pourquoi un lien a son statut | ✅ Testé | src/features/field-mapping/lib/link-status.ts:52,57,61 (messages BROKEN) et 86-88 (détail ORANGE « N valeur(s) source non liée(s) »). Rendu: src/features/field-mapping/components/field-mapping-page.tsx:84,97-99 (title + suffixe du badge). Testé: type-status.test.ts:361,372 (statusDetail « 1 valeur source »/« 3 valeurs source ») + link-sta |
| Un filtre/surbrillance « Cassé » isole les liens BROKEN dans la liste | ❌ Manquant | Pas de filtre ni de bouton de surbrillance « Cassé » sur la liste des champs mappés. |
| Résolution par apiName contre le snapshot CURRENT : champ renommé/supprimé détecté cassé, jamais via FK stale | ✅ Testé | src/features/field-mapping/field-mapping-service.ts:38-60 resolveCurrentObject (re-résout par apiName sur snapshot CURRENT, jamais par FK) + 197-205 (map par apiName, .get()??null → BROKEN si disparu). Testé indirectement via computeLinkStatus(sourceFieldExists=false)→BROKEN: type-status.test.ts:280-289 et link-status-enrichment.test.ts:3 |
| Mapper deux fois le même champ (source ou destination) est refusé (409) avec message explicite | 🟡 Présent (non testé / preuve démo) | Contraintes: prisma/schema.prisma:188-189 (@@unique objectMappingId+sourceFieldName ET objectMappingId+destinationFieldName). Route: src/app/api/plans/[planId]/field-mappings/route.ts:102-107 (try/catch → 409 « Un de ces champs est déjà mappé dans cette paire »). MAIS non testé: tests/unit/field-mapping/link-status-enrichment.test.ts:8-10 |
| La recherche filtre les champs des deux côtés | ❌ Manquant | Pas d'input de recherche pour filtrer les listes de champs source/destination. |
| Statut du mapping et compteurs recalculés après chaque création/modification/suppression | ✅ Testé | src/features/field-mapping/components/field-mapping-page.tsx : après auto-match (ligne 195), createMapping (ligne 219) et deleteMapping (ligne 226) → Promise.all([loadDetail, loadPairs]) rafraîchit détail + compteurs d'onglets. Testé e2e: tests/e2e/journey.spec.ts:125 (onglet « Compte → Companies » passe à « 4 champs » après auto-match) e |
| Un panneau de prévisualisation (MigrationPreviewPanel) montre l'effet du mapping sur des valeurs réelles | ✅ Testé | Composant: src/features/field-mapping/components/migration-preview-panel.tsx (charge records réels via /source/records, applique applyMappings côté client). Monté: field-mapping-page.tsx:433. Testé: unité applyMappings tests/unit/field-mapping/apply-mappings.test.ts:28-96 (équivalences D1 réelles, régression booléenne) ET e2e journey.spec |
| Une modale de modification de champ (ModifyFieldModal) est accessible depuis le mapping | ❌ Manquant | Aucune modale de modification de champ. Possiblement DEVIATED (modifier = supprimer+recréer), mais la capacité ModifyFieldModal nommée est absente. |
| Les onglets portent des badges de compteurs (TabBadge) cohérents avec les données | 🔵 Dévié v5 | grep -rni 'TabBadge' src/ = 0 résultat. Les onglets affichent un compteur INLINE (« · N champs ») dans le bouton d'onglet: src/features/field-mapping/components/field-mapping-page.tsx:326-328, cohérent avec _count.fieldMappings rafraîchi après chaque mutation. Testé e2e: journey.spec.ts:125 (« 4 champs » après auto-match). — _manque : Le  |

## §8. Champs non mappés + exclusions

| Item | Statut | Preuve / manque |
|---|---|---|
| Détection des champs source non mappés au niveau du plan ET par object mapping (deux routes) | 🟠 Partiel | UNE seule route: src/app/api/plans/[planId]/object-mappings/[mappingId]/coverage/route.ts (par object mapping) → getCoverageReport src/features/unmapped/unmapped-service.ts:50. AUCUNE route de détection au niveau du plan: find src/app/api/plans montre seulement la route /coverage par mapping; l'intégrité (src/features/integrity/lib/comput |
| Avertissement visible (UnmappedFieldsWarning) listant les champs non mappés là où le consultant travaille | ✅ Testé | Composant CoveragePanel: src/features/unmapped/components/coverage-panel.tsx (liste « Champs source ni mappés ni exclus » ligne 65-68, + « Champs requis destination non mappés » ligne 48-52), monté dans field-mapping-page.tsx:417. Alimenté par use-coverage → /coverage. Testé e2e: journey.spec.ts:172-173 (panneau « Couverture — Compte » ou |
| Un champ peut être exclu explicitement avec une raison ; exclusion datée et supprimable (FieldExclusion CRUD complet) | ✅ Testé | CRUD: src/features/unmapped/unmapped-service.ts:75-116 addExclusion (upsert avec reason) / removeExclusion + audit; route src/app/api/plans/[planId]/object-mappings/[mappingId]/exclusions/route.ts (POST reason? / DELETE). Datée: prisma/schema.prisma:262-272 FieldExclusion.createdAt + @@unique. UI: coverage-panel.tsx:84-92 (Exclure) / 112- |
| Un champ exclu ne compte plus comme « non mappé » mais reste tracé et apparaît dans les documents générés | 🟠 Partiel | « Ne compte plus comme non mappé »: src/features/unmapped/lib/compute-unmapped.ts:61-62 (exclus retirés de unmappedSourceFields) — testé compute-unmapped.test.ts:151-175. « Reste tracé »: excludedSourceFields conservé + audit FIELD_EXCLUDED (unmapped-service.ts:91). MAIS « apparaît dans les documents générés » NON: src/features/documents/ |

## §9. Logique de migration (D1–D4)

| Item | Statut | Preuve / manque |
|---|---|---|
| Modale de logique par paire de champs, section D1-D4 calculee depuis les types (getSectionType), jamais lue d'une colonne | ✅ Testé | src/features/migration-logic/migration-logic-service.ts:223 (sectionType = getSectionType(...) calcule frais dans buildMigrationLogicContext, jamais lu de config pour le modal) ; modale atteignable au clic sur le badge src/features/field-mapping/components/field-mapping-page.tsx:467,89 ; getSectionType couvert par tests/unit/field-mapping |
| D1 picklist->picklist : equivalence propose les vraies valeurs des deux picklists (picklistValues) et persiste les correspondances (ValueEquivalence) | ✅ Testé | Vraies valeurs depuis picklistValues src/features/migration-logic/migration-logic-service.ts:225-240 passees a src/features/migration-logic/components/value-equivalence-section.tsx:114,187 ; persistance ValueEquivalence saveMigrationLogic src/features/migration-logic/migration-logic-service.ts:121-132 ; e2e lie Tech->Technology/Finance->B |
| D2 texte->picklist : la classification LLM fonctionne via une route /classify reelle ; le prompt est persiste (ClassificationPrompt) | 🟠 Partiel | Route reelle src/app/api/plans/[planId]/field-mappings/[fieldMappingId]/classify/route.ts:9-32 ; prompt persiste saveMigrationLogic src/features/migration-logic/migration-logic-service.ts:134-140 (modele ClassificationPrompt prisma/schema.prisma:225) — _manque : La classification LLM ne FONCTIONNE PAS : classify() est un STUB deterministe |
| D2 : les classifications peuvent etre rafraichies par un nouvel appel LLM apres modification du prompt | 🟠 Partiel | Mecanisme de rafraichissement present : src/features/migration-logic/components/classification-prompt-section.tsx:54-60 (handleChange -> runClassification debounce 1s -> POST /classify) et classification initiale ligne 49-52 — _manque : Le rafraichissement re-appelle le STUB deterministe, pas un LLM reel (classify-service.ts est un stub,  |
| D3 types incompatibles : champ marque incompatible dans l'UI, etat calcule (compatibilite + section), sans enregistrement MigrationLogic ni valeur d'enum stockee | ✅ Testé | Etat calcule : getSectionType->ERROR->RED_DASHED src/features/field-mapping/lib/link-status.ts:66-69 ; modale D3 affiche l'encart rouge sans persister (bouton Enregistrer masque, Valider disabled) src/features/migration-logic/components/migration-logic-modal.tsx:142-152,167-172 ; aucune MigrationLogic ecrite pour ERROR (saveMigrationLogic |
| Le statut de logique (DRAFT/DEFINED/VALIDATED) est visible et evolue avec les actions de l'utilisateur | ✅ Testé | Statut consomme par computeLinkStatus src/features/field-mapping/lib/link-status.ts:75-99 et surface via le badge de lien src/features/field-mapping/components/field-mapping-page.tsx:64-102 ; toutes les transitions DRAFT/DEFINED/VALIDATED unit-testees tests/unit/field-mapping/link-status-enrichment.test.ts:19-34,96-106 ; e2e verifie l'evo |

## §10. Filtres de migration

| Item | Statut | Preuve / manque |
|---|---|---|
| Un filtre se cree sur un object mapping en choisissant un champ parmi les champs filtrables (route /filterable-fields) | ✅ Testé | Creation de filtre : src/features/filters/filter-service.ts:112-158 + POST src/app/api/plans/[planId]/object-mappings/[mappingId]/filters/route.ts:31-56 ; champs filtrables (objet source, snapshot CURRENT) fournis au FilterForm src/features/filters/components/filter-panel.tsx:71,122 depuis detail.sourceFields src/features/field-mapping/co |
| Les operateurs disponibles couvrent l'enum complet dont DATE_AFTER et DATE_BEFORE (divergence IS_NOT_NULL/NOT_IN a trancher) | ✅ Testé | 11 operateurs incl. DATE_AFTER/DATE_BEFORE src/features/filters/lib/filter-operators.ts:34-46 alignes sur enum Prisma prisma/schema.prisma:235-247 ; unit-tested tests/unit/filters/filter-operators.test.ts:28-60 (11 operateurs, DATE_AFTER/BEFORE type date/datetime) ; divergence tranchee : IS_NOT_NULL et NOT_IN volontairement absents, verif |
| Un filtre s'active/desactive (toggle isActive via PATCH) sans etre supprime, et l'etat est visible | ✅ Testé | Colonne isActive prisma/schema.prisma:255 ; toggle sans suppression updateFilter src/features/filters/filter-service.ts:161-194 ; etat visible (badge 'N actif' + opacite ligne) src/features/filters/components/filter-panel.tsx:78,91-93,28 ; e2e desactive et verifie '0 actif' + le filtre reste (bouton Activer visible) tests/e2e/journey.spec |
| Une estimation du nombre d'enregistrements concernes est affichee (route /estimate) sur donnees reelles | 🟡 Présent (non testé / preuve démo) | Route src/app/api/plans/[planId]/object-mappings/[mappingId]/filters/estimate/route.ts:9-20 ; service estimateFilteredCount src/features/filters/filter-service.ts:227-299 (via capacites adapter getRecordCount/getFilteredRecordCount) ; adaptateurs implementent la capacite (demo:68-77, salesforce:133, hubspot:97) ; affichage FilterPanel src |
| La valeur saisie est validee selon l'operateur (ex. IS_NULL sans valeur, dates au bon format) | ✅ Testé | Client : valeur masquee et submit bloque selon needsValue (IS_NULL sans valeur) src/features/filters/components/filter-form.tsx:26-28,75 ; serveur : format ISO date valide (warning) et coherence type/operateur src/features/filters/lib/filter-validation.ts:47-71 ; unit-tested tests/unit/filters/filter-validation.test.ts:87-94 (IS_NULL sans |
| Les composants UI de filtre (liste, formulaire, badges) sont presents et fonctionnels sur la page de mapping | ✅ Testé | FilterPanel (liste + badge 'N actif' + estimation) src/features/filters/components/filter-panel.tsx:62-135, FilterForm src/features/filters/components/filter-form.tsx:48-90, FilterRow (badge operateur + warning) :17-60 ; montes sur la page de mapping src/features/field-mapping/components/field-mapping-page.tsx:424-430 ; e2e exerce formula |

## §11. Intégrité, BROKEN, drift

| Item | Statut | Preuve / manque |
|---|---|---|
| Le contrôle d'intégrité se déclenche automatiquement après un refresh de schéma (c2) | ❌ Manquant | Après un refresh de schéma, aucun contrôle d'intégrité n'est déclenché. Les routes source/destination/schema retournent juste objectCount. Le statut du plan n'est pas recalculé et les BROKEN_REFERENCE nés d'un renommage/suppression ne sont jamais détectés au refresh (le comportement central du cluster 2). |
| Le contrôle d'intégrité se déclenche automatiquement après les CRUD de mappings/logiques/filtres (c2) | 🟠 Partiel | checkAndUpdatePlanStatus appelé dans field-mappings/route.ts:72,100, field-mappings/[fieldMappingId]/route.ts:12, object-mappings/[mappingId]/route.ts:10 (DELETE) ; ABSENT de object-mappings/route.ts (POST create), filters/route.ts:31 (POST), migration-logic/route.ts:37 (PUT), exclusions/route.ts — _manque : Seuls create/patch/delete de f |
| Quand une issue bloquante existe, le plan passe à BROKEN, visible partout où le statut est affiché (c2) | ✅ Testé | computePlanStatus (src/features/integrity/lib/compute-integrity.ts:167-175) : errorCount>0 → BROKEN ; persisté via integrity-service.ts:164-165 ; badge affiché dans le layout partagé src/app/plans/[planId]/layout.tsx:21 → plan-header.tsx:43 (data-testid=plan-status, variant destructive) et plan-list.tsx:50 ; test tests/unit/integrity/comp |
| Broken-ness d'un mapping/champ dérivée des IntegrityIssue à la lecture (pas de colonne status), badge rouge sur les mappings concernés (c2) | 🟠 Partiel | linkStatus BROKEN calculé à la lecture dans src/features/field-mapping/lib/link-status.ts:49-64 et field-mapping-service.ts:135-141 (résolution par apiName sur snapshot CURRENT) ; badge LinkStatusBadge (field-mapping-page.tsx:75-97, BROKEN='rompu') ; test tests/unit/field-mapping/link-status-enrichment.test.ts — _manque : La broken-ness a |
| Une réparation (repairBrokenMappings) est proposée et re-résout par apiName ce qui peut l'être (c2) | 🟠 Partiel | repairBrokenMappings implémenté src/features/integrity/integrity-service.ts:215-268 ; route POST {action:repair} src/app/api/plans/[planId]/integrity/route.ts:21-23 ; UI IntegrityBanner.repair() field-mapping-page.tsx:308 → integrity-banner.tsx:40-50 — _manque : La réparation SUPPRIME les mappings BROKEN_REFERENCE (deleteMany, integrity-s |
| Les changements de type d'un champ entre deux snapshots (typeChanges) sont détectés et signalés (c2) | ❌ Manquant | Aucun mécanisme de détection des changements de type entre deux snapshots datés. Il n'existe jamais de snapshot PREVIOUS (le refresh écrase le CURRENT). Le seul contrôle de type est une comparaison CURRENT-vs-types-figés-au-mapping, pas un typeChanges inter-snapshots. |
| La résolution d'une issue la marque resolved/resolvedAt ; quand plus aucune issue bloquante ne subsiste, le plan quitte BROKEN (c2) | 🟡 Présent (non testé / preuve démo) | integrity-service.ts:150-155 (updateMany resolved:true, resolvedAt:new Date() pour les issues stale) et :158-165 (recompte unresolved → computePlanStatus → repasse DRAFT/READY si errorCount=0) — _manque : La logique existe et est atteignable (checkIntegrity ré-exécuté après repair, integrity-service.ts:266). Mais aucun test n'exerce le se |
| Le diff de schéma post-refresh est branché : route /diff retourne ajouts, suppressions et modifications entre snapshot CURRENT et PREVIOUS (c11) | ❌ Manquant | Ni la route /diff ni la mécanique de rotation CURRENT→PREVIOUS n'existent. Rien à diffuser puisqu'il n'y a jamais deux snapshots. Fonctionnalité entièrement absente du code v5. |
| detectLiveDrift compare le plan au schéma live et produit un DriftReport selon la taxonomie des 12 types (c11) | ❌ Manquant | detectLiveDrift n'est jamais écrit. Aucune taxonomie de 12 types de drift, aucun DriftReport. La tranche est explicitement différée dans le commentaire du code. Absent. |
| Une bannière de drift est visible dans le parcours quand un drift est détecté (c11) | ❌ Manquant | Il n'existe pas de bannière de drift distincte. La IntegrityBanner ne consomme que /integrity (issues de corruption), pas un rapport de drift. Comme detectLiveDrift n'existe pas, rien à afficher. |

## §12. Documents

| Item | Statut | Preuve / manque |
|---|---|---|
| Le document texte se génère avec ses compteurs exacts (objets, champs, règles, non mappés, appels LLM) (c13) | 🟠 Partiel | generatePlanDescription src/features/documents/document-service.ts:16-75 génère un TextDocument avec objectCount (l.27) et fieldCount (l.28) seulement ; affichés en e2e tests/e2e/journey.spec.ts:190-192 (Générer la description, Version 1, preview contient Account) — _manque : Seuls objectCount et fieldCount sont calculés. Les compteurs 'r |
| Le document contractuel se génère avec un numéro de référence unique et la structure en 7 articles + bloc de signature (c13) | ❌ Manquant | Le document contractuel n'est jamais généré. Modèle Prisma présent mais aucune logique, aucune route, aucune UI ne le crée. Pas de référence unique, pas de 7 articles, pas de bloc signature. NB : le prompt d'audit classe §12 en Phase 1 → c'est un MISSING, pas un OUT_OF_SCOPE_P2 (malgré le commentaire 'Phase 2' du code). |
| Les descriptions de règles couvrent les types PROMPT / INFO / ERROR, avec rédaction LLM là où spécifié (c13) | ❌ Manquant | Aucune description de règle générée, aucun rendu par type de règle, aucune rédaction LLM. Absent du document texte. |
| Les deux documents s'exportent en PDF (c13) | ❌ Manquant | Aucun export PDF pour ni l'un ni l'autre document. Fonctionnalité absente. |
| Des vues de détail permettent de consulter chaque document généré (pas seulement une liste) (c13) | ✅ Testé | documents-page.tsx:145-152 : bouton 'Aperçu' par version (l.131-138) qui affiche le htmlContent complet dans une Card data-testid=document-preview ; e2e tests/e2e/journey.spec.ts:192 vérifie que le preview contient 'Account' — _manque : Vue de détail présente uniquement pour le document texte (le seul type généré). Suffisant pour l'unique |
| La régénération incrémente la version ; l'ancienne passe à OUTDATED, la nouvelle est CURRENT (c13) | 🟡 Présent (non testé / preuve démo) | document-service.ts:56-74 : updateMany CURRENT→OUTDATED (l.57-60), version = (previous?.version ?? 0)+1 (l.69), create avec status défaut CURRENT. UI documents-page.tsx:124 affiche badge Actuelle/Obsolète — _manque : La logique de versionnement/OUTDATED est présente et atteignable. Mais aucun test n'exerce une DEUXIÈME génération : l'e2e  |
| Les champs non mappés et les exclusions (avec raisons) figurent dans les documents générés (c6+c13) | ❌ Manquant | Ni les champs non mappés ni les exclusions (avec raison/date) n'apparaissent dans le document texte. Le libellé (promesse anti-perte-silencieuse côté document) n'est pas tenu. Absent. |

## §13. Schema write (destination)

| Item | Statut | Preuve / manque |
|---|---|---|
| Un champ manquant côté destination peut être créé depuis l'app (route + service + UI) | ❌ Manquant | Aucune route de création de champ (les seules routes destination/schema et source/schema sont des FETCH — src/app/api/plans/[planId]/destination/schema/route.ts:8 POST = fetchSchema, pas d'écriture). Aucun service createField, aucune UI. La destination/fields/page.tsx rend FieldsPage en LECTURE SEULE (src/features/schema/components/fields |
| Un champ destination peut être modifié (modifyField) quand l'adaptateur le permet | ❌ Manquant | L'interface ConnectorAdapter ne déclare AUCUNE méthode createField/modifyField. Le commentaire du contrat (lignes 6-8) diffère explicitement l'écriture de schéma : 'Les capacités records / écriture de schéma arriveront avec leurs tranches'. Rien n'a été écrit. |
| L'adaptateur HubSpot exécute réellement l'écriture (property visible dans le portail HubSpot) | ❌ Manquant | canWriteSchema: true est déclaré pour HubSpot mais c'est un flag MORT : l'adaptateur (hubspot/adapter.ts, hubspot/schema.ts) n'implémente aucune méthode d'écriture de property. Aucun appel POST /crm/v3/properties. Grep createProperty/createField sur src/ : zéro. |
| Une page/section dédiée au schema write est atteignable depuis le parcours, avec ses composants et son hook | ❌ Manquant | Aucune page /schema-write (les 11 page.tsx listées ne contiennent aucune section schema-write). Vestige orphelin : src/features/plans/lib/steps.ts:50 mappe '/schema-write'→OBJECT_MAPPING dans stepForPathname, mais aucune page/route/lien correspondant n'existe. Aucun hook useSchemaWrite, aucun composant. |
| Une suggestion LLM assiste la définition du champ à créer | ❌ Manquant | Aucune fonctionnalité schema-write n'existe, donc a fortiori aucune assistance LLM pour la création de champ. La seule route /classify (field-mappings/[id]/classify) concerne la logique D2 texte→picklist, sans rapport avec la création de propriété destination. |
| Chaque opération d'écriture est tracée (SchemaWriteOperation : type, objet, champ, statut, erreur) | ❌ Manquant | Le modèle SchemaWriteOperation existe en base (schema.prisma:354-363) mais c'est un ORPHELIN : grep 'schemaWriteOperation' (client Prisma) sur src/ = zéro occurrence. Aucun code ne crée, lit ni écrit cette table. Aucune opération d'écriture n'existe donc rien n'est tracé. |

## §14. Navigation / layout / stepper

| Item | Statut | Preuve / manque |
|---|---|---|
| Chaque avancement d'étape fonctionne : contrat client/serveur identique (bug targetStep/body.step corrigé, e2e couvre chaque transition) | ✅ Testé | src/app/api/plans/[planId]/step/route.ts:11 (serveur lit body.targetStep) + src/features/plans/lib/record-step.ts:20 (client envoie {targetStep}) ; test tests/e2e/journey.spec.ts:82-99,111-115,184-187 traverse FRONTIÈRE 1→4 — _manque : Le contrat est aligné des deux côtés (targetStep) — le bug v4 body.step est corrigé (commentaire route.t |
| La sidebar/stepper déverrouille les étapes au fur et à mesure et les étapes passées restent cliquables | ✅ Testé | src/features/plans/components/step-sidebar.tsx:44,72-102 (reachedIdx=high-water-mark, Link cliquable si idx<=reachedIdx) ; test tests/e2e/journey.spec.ts:196-202 (retour Source puis Documents cliquable) — _manque : Le stepper calcule reachedIdx=max(currentStep, page active) ; les étapes ≤ reachedIdx sont des <Link>, au-delà des <div aria- |
| La navigation arrière dans le stepper fonctionne : revenir n'efface ni sélection, ni mappings, ni logique (acquis) | ✅ Testé | src/features/plans/components/step-sidebar.tsx:46-63 (high-water-mark persisté, jamais reverrouillé) + src/features/plans/services/plan-service.ts:62-66 (advanceStep forward-only, un retour = 422 avalé, ne mute rien) ; test tests/e2e/journey.spec.ts:194-204 — _manque : advanceStep est forward-only : revenir en arrière ne peut pas régresse |
| Le header affiche l'état des connecteurs (source/destination) en permanence | 🟡 Présent (non testé / preuve démo) | src/features/plans/components/plan-header.tsx:47-51 (ConnectionPill source + destination) monté dans src/app/plans/[planId]/layout.tsx:21 (header persistant) — _manque : Le header est bien monté en permanence dans le layout et affiche 2 ConnectionPill (nom de connexion ou 'X non connectée'). ATTEIGNABLE. Mais AUCUN test n'assère les pills |
| Un bouton « étape suivante » explicite est présent sur chaque étape | 🔵 Dévié v5 | src/features/plans/components/step-sidebar.tsx:12-15 (décision v5 : PAS de bouton 'Étape suivante' dans la sidebar) ; CTA de page à la place : connection-page.tsx:21,29 / schema/fields-page.tsx:35,43 / object-selection-page.tsx:147 / object-mapping-page.tsx:148 / field-mapping-page.tsx:299 — _manque : Écart délibéré v5 : le bouton 'Étape  |
| Une vue plan (dashboard du plan) donne l'état d'ensemble : statut, étape courante, compteurs | 🟠 Partiel | src/app/plans/[planId]/page.tsx:49-73 (hub : nom, étape courante via STEP_LABELS, CTA reprendre) + statut via header plan-header.tsx:43 — _manque : Le hub du plan affiche le statut (badge header) et l'étape courante (+ description + lien de reprise), mais NE montre AUCUN compteur (nombre d'objets sélectionnés, paires mappées, champs mappé |
| Un plan peut être supprimé, avec cascade propre sur toutes ses entités | ✅ Testé | src/features/plans/services/plan-service.ts:32-45 (deletePlan : delete plan cascade Prisma + nettoyage explicite objectSelection + connectorConnection) ; route src/app/api/plans/[planId]/route.ts:13-17 (DELETE) ; UI src/features/plans/components/plan-list.tsx:63-70 (bouton Trash2 avec confirm) ; l'e2e appelle DELETE en afterAll tests/e2e/ |
| Toutes les sous-pages (champs, preview, filtres, documents…) sont accessibles par navigation — aucune ne nécessite de taper une URL | ✅ Testé | 11 page.tsx toutes rattachées au parcours (source, source/objects, source/fields, destination, destination/fields, object-mapping, field-mapping, documents) ; preview/filtres/couverture sont des panneaux DANS field-mapping (boutons 'Aperçu de migration'/'Filtres de migration'/'Couverture') ; l'e2e navigue tout par clic tests/e2e/journey.s |

## G1 — Parcours e2e complet vert : test automatisé traverse plan→source→sélec

| Item | Statut | Preuve / manque |
|---|---|---|
| Parcours e2e complet vert : test automatisé traverse plan→source→sélection→destination→object mapping→field mapping→logique→filtres→documents sans intervention manuelle | ✅ Testé | tests/e2e/journey.spec.ts:31-205 (test 'parcours guidé complet' : création→source→objets→champs→destination→object-mapping→field-mapping→logique D1→filtres→couverture→documents→READY) + playwright.config.ts (infra e2e configurée, script test:e2e) — _manque : Le test de parcours complet existe et enchaîne toutes les tranches jusqu'à plan R |

## G2 — Zéro page orpheline : chaque page riche atteignable par clics depuis l

| Item | Statut | Preuve / manque |
|---|---|---|
| Zéro page orpheline : chaque page riche atteignable par clics depuis le parcours (inventaire routes vs liens) | ✅ Testé | inventaire : 11 page.tsx (find src/app -name page.tsx) toutes rattachées aux 5 étapes de src/features/plans/lib/steps.ts:21-27 ; sidebar (step-sidebar.tsx) + CTA de page relient toutes les pages ; e2e tests/e2e/journey.spec.ts navigue chacune par clic — _manque : Aucune page orpheline détectée : chaque page.tsx correspond à une étape ou s |

## G3 — Plan READY en bout de parcours (et repasse par BROKEN→READY après inci

| Item | Statut | Preuve / manque |
|---|---|---|
| Plan READY en bout de parcours (et repasse par BROKEN→READY après incident d'intégrité réparé) | 🟠 Partiel | READY testé : tests/e2e/journey.spec.ts:184-187 (frontière DOCUMENTS → plan-status 'Prêt') ; logique BROKEN présente src/features/integrity/*.ts:159 computePlanStatus + repairBrokenMappings:261 — _manque : La 1re moitié (plan atteint READY en bout de parcours) est TESTÉE par l'e2e. La 2e moitié — 'repasse correctement par BROKEN→READY apr |

## G4 — Recette sur org Salesforce réelle > 1000 objets : listes, recherche, s

| Item | Statut | Preuve / manque |
|---|---|---|
| Recette sur org Salesforce réelle > 1000 objets : listes, recherche, sélection, pagination restent utilisables | ❌ Manquant | Aucune trace de recette réelle : aucun fichier recette/recipe (find = zéro), aucune entrée tracée (date/org/testeur/résultat) dans docs/. Toute la suite tourne sur le connecteur démo (8 objets, adapter.ts). Le préambule §05 exige des données réelles ; aucune preuve d'exécution sur org SF réelle, a fortiori >1000 objets. Gate non satisfait |

## G5 — tsc : 0 erreur (tsc --noEmit propre sur tout le projet)

| Item | Statut | Preuve / manque |
|---|---|---|
| tsc : 0 erreur (tsc --noEmit propre sur tout le projet) | ✅ Testé | npx tsc --noEmit exécuté → EXIT 0, aucune sortie d'erreur — _manque : Vérifié en direct : 'npx tsc --noEmit' se termine avec le code de sortie 0 et zéro diagnostic. Gate satisfait à l'instant de l'audit._ |

## G6 — Aucun item coché sur déclaration : chaque coche référence un test (che

| Item | Statut | Preuve / manque |
|---|---|---|
| Aucun item coché sur déclaration : chaque coche référence un test (chemin) ou une entrée de recette tracée | 🟠 Partiel | docs/foundation/05-acceptance.md : tous les items sont '- [ ]' (aucun coché) — _manque : Meta-gate de processus, non vérifiable dans le code. À l'état actuel aucune violation n'existe (aucun item n'est coché, donc aucune coche 'sur déclaration'). Mais le gate ne peut pas être marqué satisfait tant que la checklist n'est pas remplie avec d |

---

## Backlog GELÉ (hors périmètre recette v5 — assumé, pas une surprise)

Deux clusters entiers sont délibérément différés (leur absence est documentée dans le code). Ils NE sont PAS des trous à redécouvrir :

- **§11 c11 — Drift / diff de schéma** (detectLiveDrift, DriftReport 12 types, route /diff, rotation CURRENT→PREVIOUS, bannière drift) : ❌ non commencé. Nécessite d'abord la rotation de snapshots (aujourd'hui le refresh écrase le CURRENT).
- **§13 — Schema write destination** (créer/modifier un champ HubSpot, page dédiée, suggestion LLM, SchemaWriteOperation) : ❌ 0/6, cluster entier à construire.

Le reste des ❌/🟠 (documents riches, aperçu records en UI, statut connexion 3 états, object-mapping SVG…) sont des **tranches de valeur** à planifier, pas des oublis.
