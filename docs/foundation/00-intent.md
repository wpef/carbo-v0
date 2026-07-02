# 00 — Intention produit

**Statut** : document vivant du dossier de fondation v5. Remplace les specs speckit (archivées, cf. §Statut des artefacts).
**Dernière mise à jour** : 2026-07-02.

## 1. Ce qu'est Carbo

Carbo est un SaaS de **migration de données CRM guidée**, destiné aux consultants qui pilotent la migration du CRM d'un client (ex. Salesforce → HubSpot). L'outil ne se contente pas de déplacer des données : il structure la **décision de migration** et en produit la **preuve contractuelle**.

Le parcours complet, du point de vue du consultant :

1. **Créer un plan de migration** — le plan est le conteneur de tout ; rien n'existe hors d'un plan.
2. **Connecter la source** — choisir un adaptateur (Salesforce), s'authentifier (OAuth), récupérer le schéma.
3. **Sélectionner les objets** source à inclure dans le périmètre.
4. **Connecter la destination** — adaptateur HubSpot, authentification, schéma destination.
5. **Mapper les objets** — associer chaque objet source à un objet destination.
6. **Mapper les champs** — champ par champ, avec compatibilité de types, statut de lien, détection des champs non mappés.
7. **Définir la logique de migration** — règles par paire de champs (équivalence de valeurs, classification assistée par LLM, informatif, erreur).
8. **Filtrer les enregistrements** source par objet.
9. **Vérifier l'intégrité** — détecter les mappings cassés après un changement de schéma.
10. **Générer les documents** — document texte lisible pour le client + document contractuel formel avec bloc de signature, exportables en PDF.

### Pour qui

Le **consultant en migration CRM** qui doit pouvoir prouver à son client final que rien n'a été perdu ou altéré sans raison. La donnée manipulée est l'intégralité du CRM d'un client (contacts, deals, opportunités) : la fidélité, la traçabilité et l'isolation par tenant sont des exigences contractuelles, pas des options.

### Proposition de valeur

- **Le plan est le conteneur** : le consultant est guidé étape par étape (stepper), jamais laissé à se demander « et maintenant ? ».
- **Aucune perte silencieuse** : tout champ non mappé, toute transformation, tout mapping cassé est explicite, nommé, tracé.
- **Le livrable final est un document contractuel** adossé à un audit trail — c'est ce qui différencie Carbo d'un simple outil d'ETL.

## 2. Architecture en deux couches

- **Core App (couche 1)** : features génériques, agnostiques du connecteur. Aucune référence à Salesforce ou HubSpot dans le cœur.
- **Adapters (couche 2)** : implémentations spécifiques branchées via la Connector Interface. Ajouter un connecteur ne modifie pas le cœur.

Adaptateurs de la phase 1 :

| Adaptateur | Rôle | Implémente |
|---|---|---|
| Salesforce | Source | Connexion (OAuth2+PKCE, jsforce), schéma, champs, records |
| HubSpot | Destination | Connexion (Private App / OAuth), schéma, champs, records, schema write |

Un mode démo existe, scopé au connecteur (« Use Demo Data » à l'étape de connexion) — il ne remplace jamais la recette sur données réelles (cf. `04-lessons.md`, mode d'échec ③).

## 3. Roadmap en deux phases

### Phase 1 — Valider le parcours complet (périmètre courant)

Objectif : un consultant traverse tout le parcours, de la création du plan à la génération des documents contractuels, sur une vraie org Salesforce et un vrai portail HubSpot. Pas d'exécution de migration.

### Phase 2 — Mode production

- **Export/Import JSON** : sérialiser un plan en JSON portable.
- **Exécution de migration** : appliquer le mapping sur les données réelles (dry-run + execute).

(Phase 3 en horizon lointain : gestion de projets multi-plans, nouveaux adaptateurs, suggestions d'auto-mapping — hors périmètre de fondation.)

## 4. Périmètre exact de la phase 1

Capacités dérivées des dossiers de specs archivés (`specs/000` à `specs/022` + `specs/adapters/`) :

**Fondation**
- **000 Connector Interface** — types et interfaces abstraites pour tous les connecteurs.

**Plan & connexions**
- **001 Migration Plan** — créer / lister / supprimer des plans ; le plan est le conteneur de tout.
- **002 Source Connection** — dans un plan, connexion à la source (choix d'adaptateur, authentification).
- **003 Source Schema Retrieval** — récupération de la liste des objets source ; diff post-refresh et détection de drift.
- **004 Source Object Selection** — sélection des objets source dans le périmètre (avec filtre des objets système, recherche, pré-sélection métier).
- **005 Source Field Retrieval** — récupération des champs des seuls objets sélectionnés (y compris accessibilité et valeurs de picklist).
- **006 Destination Connection** — connexion à la destination.
- **007 Destination Schema Retrieval** — objets destination.
- **008 Destination Field Retrieval** — champs destination.

**Prévisualisation de données (à la demande, dans le contexte du plan)**
- **009 Record Preview** — aperçu paginé des enregistrements de tout objet connecté.
- **010 Field Stats** — statistiques par champ : nulls, valeurs distinctes, échantillons.

**Mapping**
- **011 Object Mapping** — association objet source → objet destination (auto-link à la première connexion, registre sémantique SF→HS).
- **012 Field Mapping** — champ source → propriété destination, compatibilité de types, statut de lien à 5 états (précédence BROKEN).
- **013 Migration Logic** — règles de logique par paire (équivalence de valeurs, prompt de classification LLM, informatif, erreur ; sections D1–D4 dérivées des types).
- **015 Migration Filters** — filtres sur les enregistrements source, par objet, avec toggle d'activation.
- **016 Unmapped Fields Detection** — alerte explicite sur tout champ non mappé (Principe III), avec exclusions justifiées.
- **017 Mapping Integrity Check** — détection des mappings cassés après changement de schéma ; le plan passe en BROKEN ; réparation humaine, jamais automatique.

**Documents**
- **018 Rule Description Engine** — traduction des règles en langage naturel (templates + LLM Claude).
- **019 Text Document Generation** — document lisible pour le client.
- **020 Contractual Document Generation** — document contractuel formel avec bloc de signature.
- **021 PDF Export** — conversion HTML → PDF (Puppeteer serverless-compatible).

**Écriture de schéma (optionnel, gated par capability)**
- **022 Schema Write** — création d'objets/propriétés dans la destination si l'adaptateur le permet (HubSpot).

**Transverse**
- **Navigation de workflow** : stepper vertical dans le plan (étapes, progression, retour sur étape complétée), home = liste des plans avec leur statut.

## 5. Digest de la constitution (v1.4.0)

> Note : la constitution en vigueur compte **9 principes** (la v1.1.0 initiale en comptait 7 ; VIII et IX ont été ajoutés par amendements). Le workflow speckit qu'elle impose (§Development Workflow) est caduc en v5 — le Principe I est réinterprété : les exigences vivent dans ce dossier de fondation et dans les tests validés avant implémentation.

- **I. Spec-First** — Pas d'implémentation sans exigences approuvées : user stories priorisées, scénarios d'acceptance, critères de succès mesurables et agnostiques de la techno.
- **II. Lisibilité avant l'ingéniosité** — Code compréhensible par un nouveau développeur en moins d'une heure ; pas d'abstraction sans nom explicite, pas de magie ; Next.js + TypeScript est le standard.
- **III. Fidélité de la donnée** — Aucune transformation, troncature ou perte silencieuse ; chaque règle nommée et tracée ; la donnée source originale conservée ; un champ sans correspondance lève une erreur explicite.
- **IV. Tests fonctionnels sur données réelles** — Chemins critiques couverts par des tests sur données de forme réaliste (pas de fixture 1 ligne, pas de lorem ipsum) ; unitaires réservés aux fonctions pures ; tests écrits avant l'implémentation sur les chemins critiques.
- **V. Idempotence des opérations** — Toute migration rejouable sans effet de bord ; runs partiels reprenables ; toute opération destructive explicite et confirmée.
- **VI. Traçabilité par défaut** — Chaque opération significative loguée dans un audit trail persistant, qui alimente directement les documents contractuels.
- **VII. Observabilité développeur** — Logs console explicites (erreurs, warnings, étapes clés) ; le terminal doit suffire à suivre l'exécution complète sans debugger.
- **VIII. Modularité et isolation** — Chaque feature est un module isolé à interface publique explicite ; un module validé n'est plus modifié en interne (Open/Closed) ; user stories atomiques, testables et validables indépendamment.
- **IX. Human-in-the-loop sur opérations destructives ou ambiguës** — L'automation ne décide jamais à la place du consultant sur du destructif ou de l'ambigu ; auto-match/auto-link seulement à la première connexion ou sur trigger explicite ; les mappings cassés sont marqués, jamais auto-réparés ; tout effet auto-* est visible et défaisable.

### Standards techniques (rappel)

Next.js 14+ App Router + TypeScript + Tailwind + shadcn/ui ; Route Handlers (pas de backend séparé) ; Neon Postgres via Prisma ; tenancy **DB-per-tenant** (une base Neon isolée par consultant, tolérance mono-base tant qu'il n'y a qu'un tenant) ; hosting Netlify (amendé 2026-06-15, remplace Vercel) ; Vitest + Playwright avec Postgres réel en intégration ; jsforce v3 (SF), @hubspot/api-client, @anthropic-ai/sdk (descriptions LLM), Puppeteer + @sparticuz/chromium (PDF).

## 6. Statut des artefacts

| Artefact | Statut | Usage |
|---|---|---|
| `specs/` (000-022, adapters/, connectors/, roadmap.md) | **Archive figée** au tag `v5` — ne plus modifier | Base de connaissance : exigences détaillées, scénarios d'acceptance, contrats. À consulter, jamais à faire évoluer. |
| `docs/foundation/` | **Documentation vivante** | Source de vérité de l'intention, des leçons et de la méthode v5. |
| Code v4 récupéré | **Référence de lecture seule** (worktree `keen-matsumoto-22c856`) | Réemploi ciblé : schéma Prisma réconcilié + tests de logique pure ; le reste se lit, ne se copie pas en bloc. |
| Code v3 | **Référence recette** (worktree `v3-recette-ref`) | Comportements validés par l'utilisateur en recette réelle ; source des algorithmes éprouvés (registres sémantiques, computeLinkStatus, etc.). |
| `.specify/` (constitution, audits, décisions de récupération) | Archive de gouvernance | Contexte historique ; la constitution reste normative sur ses principes, pas sur le workflow speckit. |
