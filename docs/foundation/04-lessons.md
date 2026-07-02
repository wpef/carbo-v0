# 04 — Leçons des cycles précédents

**Statut** : document vivant du dossier de fondation v5.
**Dernière mise à jour** : 2026-07-02.
**Sources** : `.specify/regression-audit-v3-v4.md`, `.specify/recovery-decisions.md`, `.specify/recovery-test-strategy.md`, recettes utilisateur v3/v4.

Ce document consigne les erreurs essuyées sur v1→v4 et ce qu'elles **imposent** à la v5. Ce ne sont pas des recommandations : chaque contre-mesure est une règle de méthode.

## a. Chronologie des cycles

| Cycle | Période | Méthode | Issue |
|---|---|---|---|
| v1–v2 | mars–avril 2026 | Speckit, specs feature par feature (000-022) | Itérations initiales ; specs progressivement enrichies |
| **v3** | avril–mai 2026 | Speckit + itérations de recette | **Référence validée en recette utilisateur.** ~130 raffinements accumulés (comportements, UI, algorithmes) |
| **v4** | mai–juin 2026 | Régénération **from-scratch** par speckit depuis les specs | Échec : ~130 régressions vs v3 (59 hautes / 55 moyennes / 16 basses, 14/14 domaines touchés) alors que **92 % étaient couvertes par les specs** → échec d'implémentation, pas de spécification |
| v4-récupération | juin 2026 | Remédiation ciblée en 16 clusters + port depuis v3 ; 796 tests verts | Techniquement « au niveau » mais la recette réelle révèle un parcours non câblé (cf. mode ①). Jugement final : rien de testé bout-en-bout, pas de logique entre parcours |
| **v5** | juillet 2026 → | Reconstruction from-scratch **sans speckit**, parcours d'abord | Cycle courant |

**Revirement 1 (juin 2026)** : abandon de l'objectif « projet regénérable depuis les specs ». Découverte que les specs se contredisent entre elles (cf. mode ④) → « on fait évoluer, le code = source de vérité ».

**Revirement 2 (2026-07-02)** : la v4 même récupérée reste jugée mauvaise — rien n'est testé bout-en-bout, les sous-parcours ne s'articulent pas. Décision : **reconstruction v5 from-scratch**, specs archivées (tag `v5`), méthode inversée : le **parcours d'abord** (walking skeleton + test e2e Playwright dès le premier commit), puis tranches verticales dans l'ordre du parcours. Réemploi depuis v4 : schéma Prisma réconcilié + tests de logique pure ; tout le reste en lecture seule.

## b. Les 5 modes d'échec documentés

### ① La régénération LLM rate l'assemblage (« construit mais pas câblé »)

**Description.** Chaque feature est générée riche et plausible isolément, mais rien ne garantit qu'elle est *atteignable* depuis le parcours. Le mode d'échec dominant de la v4 récupérée n'était pas des features manquantes mais des features **orphelines** : pages jamais liées depuis la navigation, stepper court-circuitant des sous-parcours entiers, plan qui n'atteignait jamais le statut READY.

**Preuves.**
- Recette réelle v4-récupérée : features complètes inaccessibles depuis le stepper ; le plan ne devenait jamais READY.
- Audit v3→v4 : `specs/022` avait 52 tâches listées, **0 cochée** — un domaine entier jamais généré, sans que rien ne l'ait signalé.
- Le schéma Prisma v4 contenait `objectAutoLinkedAt` et `fieldAutoMatchedAt` (structure anticipant l'auto-mapping) mais la logique qui remplit ces champs n'a jamais été écrite : la carcasse existait, le câblage non.

**Contre-mesure v5.** Méthode inversée : **walking skeleton d'abord** — le parcours complet (créer plan → connecter → sélectionner → mapper → documents) existe squelettique dès le premier commit, avec un test e2e Playwright qui le traverse. Toute feature s'ajoute ensuite comme **tranche verticale** insérée dans ce parcours. Definition-of-done d'une tranche : elle est **atteignable depuis le parcours** (pas de page orpheline, pas de route sans lien entrant).

### ② Tests au mauvais niveau (unitaires verts, parcours mort)

**Description.** Une couverture unitaire massive ne dit rien de la vie du parcours. Les tests validaient des fonctions, jamais l'enchaînement.

**Preuves.**
- **785 tests unitaires verts pendant que le parcours entier était gelé** par un bug trivial : la route `step/route.ts` lisait `body.step` alors que les 4 clients envoyaient `targetStep` → chaque avancement d'étape renvoyait 400 dès la première transition. Aucun test n'existait au niveau parcours pour l'attraper.
- Fin de récupération : 796 tests verts, et pourtant verdict « rien de testé bout-en-bout ».

**Contre-mesure v5.** Le **test e2e Playwright du parcours est le premier test du projet** et reste le gate permanent : e2e vert = condition de done de chaque tranche. Pyramide assumée : e2e parcours > intégration (routes + DB réelle) > unitaires (fonctions pures uniquement, Principe IV). Tout contrat client↔route est exercé par un test qui traverse réellement les deux côtés.

### ③ Vérification sur données démo au lieu de réelles

**Description.** L'adaptateur démo (données propres, petites, bien formées) faisait passer des vérifications que les données réelles invalidaient immédiatement.

**Preuves.** Recette sur une vraie org Salesforce de **1123 objets** :
- classification des objets système par préfixe seul → **0 objet masqué** (le filtre paraissait fonctionner en démo, où la liste est courte et propre) ;
- listes de valeurs par défaut divergentes entre démo et réel ;
- plus généralement, tous les trous de volumétrie/forme (pagination, champs inaccessibles, picklists volumineuses) invisibles en démo.

**Contre-mesure v5.** **Recette sur la vraie org SF à chaque jalon** — pas seulement en fin de phase. Le mode démo sert au développement, jamais à la validation. Conforme au Principe IV (données de forme réaliste) et à la leçon d'outillage : fixtures partagées calquées sur les formes SF/HubSpot réelles.

### ④ Specs contradictoires entre elles sur le data-model

**Description.** Chaque spec, écrite feature par feature, modélisait les entités partagées à sa façon. La « source de vérité » était en réalité plurielle et incohérente — la régénération ne pouvait que produire un schéma incohérent.

**Preuves** (`.specify/recovery-decisions.md` §3) :
- `SchemaSnapshot` modélisé **3 façons incompatibles** (spec 002 : `data Json`+`side` ; specs 003/005 : normalisé `role`/`status`+objets ; le code avait fait une fusion tierce) ;
- `ObjectSelection` : table séparée (spec 004) **vs** champ `isSelected` sur SchemaObject (spec 005) ;
- `id` en `cuid()` (specs) vs `uuid()` (code) ; `PlanStep.MAPPING` vs `OBJECT_MAPPING` ; `fieldApiName` vs `sourceFieldName` ; taxonomies `IntegrityIssue` divergentes.

**Contre-mesure v5.** **Un seul data-model canonique** : le schéma Prisma réconcilié pendant la récupération v4 est repris comme point de départ et vit dans le code — c'est le seul endroit où les entités sont définies. Les specs archivées se consultent pour le *comportement*, jamais pour le *modèle*. Toute évolution du modèle se fait par migration Prisma, pas par prose.

### ⑤ Auto-déclaration de complétude (« marqué fait » ≠ réellement là)

**Description.** Les agents/tâches se déclaraient terminés sans vérification indépendante. Le statut « fait » était une déclaration, pas une observation.

**Preuves.**
- Re-audit **adversarial** de la récupération v4 : **6 clusters sur 16** marqués faits avaient des trous confirmés.
- v4 initiale : `ObjectField.isAccessible` — colonne présente dans le schéma mais **jamais peuplée** par le `createMany` du service ; la feature paraissait exister à la lecture du schéma.

**Contre-mesure v5.** Definition-of-done vérifiable, jamais déclarative : une tranche est done quand (1) le **test e2e du parcours est vert** en l'incluant, (2) les **tests métier — validés par l'utilisateur avant implémentation** — sont verts, (3) la tranche est **atteignable depuis le parcours**. La recette utilisateur sur vraie org à chaque jalon est le contrôle externe ; aucun statut « fait » n'est accepté sur la seule foi de l'exécutant.

## c. Leçons opérationnelles (environnement)

- **Node 22 obligatoire en dev local** — le Node 18 du système ne fait pas tourner le projet.
- **Port 3001 obligatoire** — les callbacks OAuth Salesforce et HubSpot sont enregistrés dessus.
- **DB de test = branche Neon distante**, configurée via `.env.test` (gitignoré). Postgres réel, jamais de mock/SQLite (enums, Json, `@db.Text` natifs).
- **Tests d'intégration séquentiels** : `--no-file-parallelism`, timeout 30 s (DB distante partagée).
- **Le serveur lancé par les outils preview MCP n'est pas joignable par le navigateur de l'utilisateur** — pour une recette utilisateur, lancer `next dev -p 3001` en tâche Bash background.
- **Déploiement** : Netlify + Neon (Netlify remplace Vercel depuis 2026-06-15) ; `prisma generate` + `prisma db push` requis au déploiement.
- **Secrets LLM** : `ANTHROPIC_API_KEY` à provisionner (routes /classify, descriptions de règles) avec timeouts sur l'environnement hébergé.
- **Git** : `master` = specs canoniques + tags `vN` ; implémentations sur `implement/phase-N-vM` ; pas de trailer Co-Authored-By dans les commits (contrainte plan Netlify mono-contributeur).
